import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wifi, WifiOff, RefreshCw, Send, MonitorSmartphone, ImageIcon } from 'lucide-react';
import { db } from '@/lib/mock-db';
import { useAuthStore } from '@/stores/authStore';

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'disconnected';

export default function IoTConfig() {
  const { escolaAtiva } = useAuthStore();
  const [escolas, setEscolas] = useState<{id: string, nome: string}[]>([]);
  const [escolaId, setEscolaId] = useState<string>(escolaAtiva || '');
  const [ip, setIp] = useState('');
  const [capturaTimeout, setCapturaTimeout] = useState<number>(5);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [syncing, setSyncing] = useState(false);

  // Photo sync state
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<{ current: number; total: number; fetched: number; failed: number } | null>(null);

  useEffect(() => {
    db.escolas.list().then(res => {
      const listas = (res.data || []).map((e: any) => ({ id: e.id, nome: e.nome }));
      setEscolas(listas);
      if (!escolaId && listas.length > 0) {
        setEscolaId(escolaAtiva || listas[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (escolaId) {
      db.iotConfig.getByEscola(escolaId).then(res => {
        if (res.data?.ip_address) {
          setIp(res.data.ip_address);
          setStatus('connected');
        } else {
          setIp('');
          setStatus('idle');
        }
        setCapturaTimeout((res.data as any)?.captura_timeout ?? 5);
      });
    }
  }, [escolaId]);

  const handleTestConnection = async () => {
    if (!ip.trim()) { toast.error('Informe o endereço IP do equipamento.'); return; }
    if (!escolaId) { toast.error('Selecione uma escola primeiro.'); return; }
    
    setStatus('testing');
    try {
      const response = await fetch('http://localhost:3000/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
      
      if (!response.ok) throw new Error('Falha na comunicação');
      
      await db.iotConfig.upsert({ escola_id: escolaId, ip_address: ip, ativo: true, captura_timeout: capturaTimeout });
      
      setStatus('connected');
      toast.success('Conexão bem-sucedida e IP salvo com sucesso!');
    } catch (err) {
      console.error(err);
      setStatus('disconnected');
      toast.error('Erro na conexão. Verifique o IP e o aparelho.');
    }
  };

  const handleSync = async () => {
    if (status !== 'connected') { toast.error('Conecte-se ao terminal antes de sincronizar.'); return; }
    if (!ip.trim()) { toast.error('Configure o IP do equipamento antes de sincronizar.'); return; }
    if (!escolaId) { toast.error('Selecione uma escola antes de sincronizar.'); return; }

    setSyncing(true);
    try {
      const { data: alunos } = await db.alunos.listByEscola(escolaId);
      const toDeviceTime = (t: any) => {
        if (!t) return null;
        const s = String(t);
        return s.length >= 5 ? s.slice(0, 5) : s;
      };

      const users = (alunos || [])
        .filter((a: any) => a?.matricula != null)
        .map((a: any) => ({
          id: String(a.matricula),
          name: String(a.nome_completo || a.matricula),
          begin_time: toDeviceTime(a?.horario_inicio),
          end_time: toDeviceTime(a?.limite_max ?? a?.horario_fim),
        }));

      const response = await fetch('http://localhost:3000/api/sync-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, users }),
      });

      if (!response.ok) throw new Error('Falha na comunicação para sincronizar usuários.');

      const payload = await response.json();
      if (!payload?.success) throw new Error(payload?.error || 'Falha ao sincronizar usuários no aparelho.');

      const created = payload?.data?.created ?? 0;
      const failedCount = payload?.data?.failedCount ?? 0;
      toast.success(
        `Sincronização concluída. Enviados: ${created}. Falhas: ${failedCount}.`
      );
    } catch (err) {
      console.error(err);
      toast.error('Falha ao sincronizar alunos com o terminal.');
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Busca as fotos de todos os alunos cadastrados no equipamento e salva
   * como avatar_url no SQLite local. Faz requisições sequenciais para não
   * sobrecarregar o hardware.
   */
  const handleSyncPhotos = async () => {
    if (status !== 'connected') { toast.error('Conecte-se ao terminal antes de sincronizar fotos.'); return; }
    if (!ip.trim()) { toast.error('Configure o IP do equipamento.'); return; }
    if (!escolaId) { toast.error('Selecione uma escola.'); return; }

    setSyncingPhotos(true);
    setPhotoProgress(null);

    try {
      // Busca todos os alunos da escola que possuem idface_user_id OU matricula
      const { data: alunos } = await db.alunos.listByEscola(escolaId);
      const candidates = (alunos || []).filter((a: any) => a?.matricula != null);

      if (candidates.length === 0) {
        toast.info('Nenhum aluno encontrado para buscar fotos.');
        setSyncingPhotos(false);
        return;
      }

      // Monta a lista para o backend: prefere idface_user_id, fallback para matricula
      const users = candidates.map((a: any) => ({
        matricula: String(a.matricula),
        internalUserId: a.idface_user_id ?? a.matricula,
      }));

      setPhotoProgress({ current: 0, total: users.length, fetched: 0, failed: 0 });
      toast.info(`Buscando fotos de ${users.length} alunos no equipamento…`);

      // Chama o endpoint de sincronização em lote (sequencial no backend)
      const response = await fetch('http://localhost:3000/api/sync-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, users }),
      });

      if (!response.ok) throw new Error('Falha na comunicação com o servidor local.');
      const payload = await response.json();
      if (!payload?.success) throw new Error(payload?.error || 'Erro ao buscar imagens.');

      const results: { matricula: string; image: string | null }[] = payload.data?.results ?? [];
      let saved = 0;
      let skipped = 0;

      // Salva cada foto recebida no SQLite
      for (let i = 0; i < results.length; i++) {
        const { matricula, image } = results[i];
        setPhotoProgress({
          current: i + 1,
          total: results.length,
          fetched: payload.data.fetched,
          failed: payload.data.failed,
        });

        if (!image) { skipped++; continue; }

        // Encontra o aluno pelo matricula para obter o id do banco
        const aluno = candidates.find((a: any) => String(a.matricula) === String(matricula));
        if (aluno?.id) {
          await db.alunos.update(aluno.id, { avatar_url: image });
          saved++;
        }
      }

      toast.success(`Fotos sincronizadas! ${saved} salvas, ${skipped} sem foto no equipamento.`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Falha ao sincronizar fotos: ${err.message}`);
    } finally {
      setSyncingPhotos(false);
      // Mantém o progresso visível por 3s depois
      setTimeout(() => setPhotoProgress(null), 3000);
    }
  };

  const statusCfg: Record<ConnectionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ElementType }> = {
    idle: { label: 'Aguardando', variant: 'secondary', icon: WifiOff },
    testing: { label: 'Testando...', variant: 'secondary', icon: RefreshCw },
    connected: { label: 'Conectado', variant: 'default', icon: Wifi },
    disconnected: { label: 'Desconectado', variant: 'destructive', icon: WifiOff },
  };

  const currentStatus = statusCfg[status];
  const photoProgressPct = photoProgress
    ? Math.round((photoProgress.current / photoProgress.total) * 100)
    : 0;

  return (
    <div>
      <PageHeader title="Configuração IoT" description="Gerencie a conexão com o terminal de biometria facial" />
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><MonitorSmartphone className="h-5 w-5 text-primary" /></div>
                <div><CardTitle className="text-base">Terminal de Biometria Facial (iDFace)</CardTitle><CardDescription className="text-xs mt-0.5">Control iD — Reconhecimento facial via rede local</CardDescription></div>
              </div>
              <Badge variant={currentStatus.variant} className="gap-1.5"><currentStatus.icon className={`h-3 w-3 ${status === 'testing' ? 'animate-spin' : ''}`} />{currentStatus.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Escola</Label>
              <Select value={escolaId} onValueChange={setEscolaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a escola para configurar..." /></SelectTrigger>
                <SelectContent>
                  {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-ip" className="text-sm font-medium">Endereço IP do Equipamento</Label>
              <Input id="device-ip" placeholder="192.168.0.201" value={ip} onChange={e => setIp(e.target.value)} className="font-mono" />
              <p className="text-xs text-muted-foreground">Informe o IP fixo do terminal iDFace na rede local da escola.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="captura-timeout" className="text-sm font-medium">Tempo de Captura Facial (segundos)</Label>
              <Input
                id="captura-timeout"
                type="number"
                min={1}
                max={30}
                value={capturaTimeout}
                onChange={e => setCapturaTimeout(Math.min(30, Math.max(1, Number(e.target.value) || 5)))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">Contagem regressiva exibida no terminal ao iniciar a captura (padrão: 5s).</p>
            </div>
            {status === 'connected' && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-medium text-primary">Dispositivo identificado</p>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div><span className="font-medium text-foreground">Modelo:</span> iDFace Max</div>
                  <div><span className="font-medium text-foreground">Firmware:</span> v2.8.1</div>
                  <div><span className="font-medium text-foreground">Faces cadastradas:</span> 142</div>
                  <div><span className="font-medium text-foreground">Último sync:</span> 22/03/2026</div>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleTestConnection} disabled={status === 'testing'} className="flex-1">
                {status === 'testing' ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                Testar Conexão e Salvar
              </Button>
              <Button variant="outline" onClick={handleSync} disabled={status !== 'connected' || syncing} className="flex-1">
                {syncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Sincronizar Alunos com o Aparelho
              </Button>
            </div>

            {/* ── Sync Photos ─────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Importar Fotos do Equipamento</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Busca a foto biométrica cadastrada de cada aluno no iDFace e salva localmente para exibição na tabela. Operação sequencial — não sobrecarrega o hardware.
                </p>
              </div>

              {photoProgress && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Buscando {photoProgress.current}/{photoProgress.total}</span>
                    <span>{photoProgress.fetched} obtidas · {photoProgress.failed} falhas</span>
                  </div>
                  <Progress value={photoProgressPct} className="h-2" />
                </div>
              )}

              <Button
                variant="outline"
                onClick={handleSyncPhotos}
                disabled={status !== 'connected' || syncingPhotos}
                className="w-full gap-2"
              >
                {syncingPhotos
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <ImageIcon className="h-4 w-4" />}
                {syncingPhotos ? 'Importando fotos…' : 'Importar Fotos dos Alunos'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Endpoint Webhook (Eventos)</CardTitle>
            <CardDescription className="text-xs">Configure este endpoint no painel do Control iD para receber eventos de presença.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Notificações DAO (logs de acesso):</p>
                <code className="text-xs break-all text-foreground font-mono">http://&lt;IP-DO-PC&gt;:3000/dao</code>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Foto de acesso (imagem biométrica):</p>
                <code className="text-xs break-all text-foreground font-mono">http://&lt;IP-DO-PC&gt;:3000/access_photo?user_id={`{user_id}`}</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
