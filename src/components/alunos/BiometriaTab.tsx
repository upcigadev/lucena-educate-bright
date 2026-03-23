import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScanFace, Send, Wifi, Monitor, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BiometriaTabProps {
  aluno?: { nome: string; matricula: string; class_id?: string };
  disabled?: boolean;
}

export function BiometriaTab({ aluno, disabled }: BiometriaTabProps) {
  const [loading, setLoading] = useState(false);
  const ipDispositivo = '10.0.0.201'; // Fixo para demo

  const handleEnroll = async () => {
    if (!aluno || !aluno.nome || !aluno.matricula) {
      toast.error('Preencha o Nome e Matrícula primeiro!');
      return;
    }

    setLoading(true);
    try {
      // 1. Salvar no SQLite
      const saveRes = await window.electronAPI.createStudent({
        name: aluno.nome,
        matricula: aluno.matricula,
        class_id: aluno.class_id,
      });

      if (!saveRes.success || !saveRes.id) {
        toast.error(`Falha ao gravar aluno no banco: ${saveRes.error}`);
        setLoading(false);
        return;
      }

      // 2. Comunicar com Aparelho
      const enrollRes = await window.electronAPI.enrollUserDevice({
        ip: ipDispositivo,
        id: saveRes.id,
        name: aluno.nome,
        matricula: aluno.matricula,
      });

      if (!enrollRes.success) {
        toast.error(`Falha de comunicação com o aparelho: ${enrollRes.error}`);
        setLoading(false);
        return;
      }

      toast.success('Câmara ativada no terminal! Posicione o aluno.');
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
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
          <div className="relative aspect-[16/9] w-full rounded-xl bg-muted/50 flex flex-col items-center justify-center gap-4 border border-border">
            <div className="h-16 w-16 rounded-2xl bg-primary/5 border-2 border-dashed border-primary/20 flex items-center justify-center">
              <Monitor className="h-8 w-8 text-primary/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">Terminal de Reconhecimento Facial</p>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                Posicione o aluno em frente ao terminal de reconhecimento facial instalado na parede.
              </p>
            </div>
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
            disabled={disabled || loading}
            onClick={handleEnroll}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {loading ? 'Processando...' : 'Enviar Comando de Cadastro para o Aparelho'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Ao clicar, o terminal será ativado para capturar a face do aluno. Aguarde a confirmação no dispositivo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
