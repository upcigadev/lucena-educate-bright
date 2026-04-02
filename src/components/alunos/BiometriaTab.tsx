import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScanFace, Send, Wifi, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/mock-db';
import { io } from 'socket.io-client';

interface BiometriaTabProps {
  aluno?: {
    matricula: string;
    escola_id: string;
    nome_completo?: string;
  };
}

export function BiometriaTab({ aluno }: BiometriaTabProps) {
  const [loading, setLoading] = useState(false);
  const [fotoRecente, setFotoRecente] = useState<string | null>(null);

  useEffect(() => {
    const socket = io('http://localhost:3000', { reconnectionAttempts: 5, reconnectionDelay: 2000 });

    socket.on('device:accessLog', (payload: any) => {
      if (payload?.type === 'photo' && payload?.data) {
        if (typeof payload.data === 'string') {
          setFotoRecente(payload.data);
          return;
        }

        // Fallback: tenta converter caso o payload venha como objeto/bytes.
        try {
          const raw = payload.data?.data ?? payload.data;
          if (raw) {
            const base64 = btoa(new Uint8Array(raw).reduce((data: string, byte: number) => data + String.fromCharCode(byte), ''));
            setFotoRecente(base64);
          }
        } catch {
          // Mantém foto anterior se não for possível converter.
        }
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleCapture = async () => {
    if (!aluno?.matricula || !aluno?.escola_id) {
      toast.error('Preencha pelo menos a escola e matrícula antes de registrar a biometria.');
      return;
    }

    setLoading(true);
    toast.info('Aguardando leitura no aparelho...');

    try {
      const configIot = await db.iotConfig.getByEscola(aluno.escola_id);
      if (!configIot?.data?.ip_address) {
        setLoading(false);
        return toast.error("Equipamento não configurado", {
          description: "Por favor, vá em 'Configuração IoT' e salve o IP do aparelho para esta escola antes de capturar a biometria."
        });
      }
      
      const ip_address = configIot.data.ip_address;

      const alunoDbRes = await db.alunos.getByMatricula(aluno.matricula, aluno.escola_id);
      const alunoDb = alunoDbRes.data || null;

      const toDeviceTime = (t: string | null | undefined) => {
        if (!t) return null;
        // O Control iD costuma aceitar HH:MM (sem segundos).
        const s = String(t);
        return s.length >= 5 ? s.slice(0, 5) : s;
      };

      // O aparelho precisa do usuário cadastrado antes de permitir o `remote_enroll`.
      // Por isso, criamos o usuário (ou garantimos que ele exista) e depois acionamos a captura.
      const nomeParaRegistro = (aluno.nome_completo || aluno.matricula).trim();

      const beginTime = toDeviceTime(alunoDb?.horario_inicio);
      // "Limite máximo para registrar presença" => fim de acesso para o aparelho.
      const endTime = toDeviceTime(alunoDb?.limite_max ?? alunoDb?.horario_fim);

      const regResponse = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: ip_address,
          userData: {
            id: aluno.matricula,
            name: nomeParaRegistro,
            begin_time: beginTime,
            end_time: endTime
          },
        }),
      });

      if (!regResponse.ok) {
        throw new Error('Falha na comunicação com a API da ponte (register).');
      }

      const regData = await regResponse.json();
      if (!regData.success) {
        throw new Error(regData.error || 'Erro ao cadastrar usuário no aparelho');
      }

      const internalId = regData.data?.internalUserId;
      if (!internalId) {
        throw new Error('O aparelho não retornou o ID interno do usuário.');
      }

      // Armazenamos o ID interno retornado pelo iDFace para casar o próximo webhook corretamente.
      if (alunoDb?.id) {
        await db.alunos.update(alunoDb.id, { idface_user_id: String(internalId) });
      }

      const response = await fetch('http://localhost:3000/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: ip_address,
          internalUserId: String(internalId),
          countdown: (configIot.data as any)?.captura_timeout ?? 5,
        })
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação com a API da ponte.');
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro na captura do aparelho');
      }

      toast.success('Leitura solicitada ao aparelho com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(`Falha ao iniciar captura: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-4 mt-3">
      <Card className="border-dashed border-2">
        <CardContent className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ScanFace className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Biometria Facial</h4>
                <p className="text-xs text-muted-foreground">Terminal externo iDFace</p>
              </div>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/15 gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Dispositivo Pronto
            </Badge>
          </div>

          <Separator />

          {/* Device illustration area */}
          <div className="relative aspect-[16/9] w-full rounded-xl bg-muted/50 flex flex-col items-center justify-center overflow-hidden border border-border">
            {fotoRecente ? (
              <img
                src={fotoRecente.includes('data:image') ? fotoRecente : `data:image/jpeg;base64,${fotoRecente}`}
                alt="Face Capturada"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <div className="h-16 w-16 rounded-2xl bg-primary/5 border-2 border-dashed border-primary/20 flex items-center justify-center mb-4">
                  <Monitor className="h-8 w-8 text-primary/40" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Terminal de Reconhecimento Facial</p>
                  <p className="text-xs text-muted-foreground max-w-[260px]">
                    Posicione o aluno em frente ao terminal de reconhecimento facial instalado na parede.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Connection info */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 border border-border">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Conexão</span>
            </div>
            <span className="text-xs font-medium text-foreground">iDFace — Porta Principal</span>
          </div>

          {/* Main action button */}
          <Button 
            size="lg" 
            className="w-full gap-2 text-base font-semibold h-12"
            onClick={handleCapture}
            disabled={loading}
          >
            <Send className="h-5 w-5" />
            {loading ? 'Iniciando captura...' : 'Enviar Comando de Cadastro para o Aparelho'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Ao clicar, o terminal será ativado para capturar a face do aluno. Aguarde a confirmação no dispositivo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
