import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Wifi, WifiOff, RefreshCw, Send, MonitorSmartphone } from 'lucide-react';

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'disconnected';

export default function IoTConfig() {
  const [ip, setIp] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [syncing, setSyncing] = useState(false);

  const handleTestConnection = async () => {
    if (!ip.trim()) {
      toast.error('Informe o endereço IP do equipamento.');
      return;
    }
    setStatus('testing');
    // Simula teste de conexão
    await new Promise(r => setTimeout(r, 1800));
    setStatus('connected');
    toast.success('Conexão estabelecida com sucesso!');
  };

  const handleSync = async () => {
    if (status !== 'connected') {
      toast.error('Conecte-se ao terminal antes de sincronizar.');
      return;
    }
    setSyncing(true);
    await new Promise(r => setTimeout(r, 2500));
    setSyncing(false);
    toast.success('Alunos sincronizados com o terminal iDFace.');
  };

  const statusConfig: Record<ConnectionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ElementType }> = {
    idle: { label: 'Aguardando', variant: 'secondary', icon: WifiOff },
    testing: { label: 'Testando...', variant: 'secondary', icon: RefreshCw },
    connected: { label: 'Conectado', variant: 'default', icon: Wifi },
    disconnected: { label: 'Desconectado', variant: 'destructive', icon: WifiOff },
  };

  const currentStatus = statusConfig[status];

  return (
    <div>
      <PageHeader title="Configuração IoT" description="Gerencie a conexão com o terminal de biometria facial" />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Terminal Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <MonitorSmartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Terminal de Biometria Facial (iDFace)</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Control iD — Reconhecimento facial via rede local</CardDescription>
                </div>
              </div>
              <Badge
                variant={currentStatus.variant}
                className="gap-1.5"
              >
                <currentStatus.icon className={`h-3 w-3 ${status === 'testing' ? 'animate-spin' : ''}`} />
                {currentStatus.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* IP Input */}
            <div className="space-y-2">
              <Label htmlFor="device-ip" className="text-sm font-medium">
                Endereço IP do Equipamento
              </Label>
              <Input
                id="device-ip"
                placeholder="192.168.0.201"
                value={ip}
                onChange={e => setIp(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Informe o IP fixo do terminal iDFace na rede local da escola.
              </p>
            </div>

            {/* Connection info when connected */}
            {status === 'connected' && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-medium text-primary">Dispositivo identificado</p>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Modelo:</span> iDFace Max
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Firmware:</span> v2.8.1
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Faces cadastradas:</span> 142
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Último sync:</span> 22/03/2026
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleTestConnection}
                disabled={status === 'testing'}
                className="flex-1"
              >
                {status === 'testing' ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="mr-2 h-4 w-4" />
                )}
                Testar Conexão e Salvar
              </Button>
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={status !== 'connected' || syncing}
                className="flex-1"
              >
                {syncing ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Sincronizar Alunos com o Aparelho
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Endpoint Webhook (Eventos)</CardTitle>
            <CardDescription className="text-xs">
              Configure este endpoint no painel do Control iD para receber eventos de presença.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-3">
              <code className="text-xs break-all text-muted-foreground">
                https://rpzbzdffequiunyhgafj.supabase.co/functions/v1/presenca-evento
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
