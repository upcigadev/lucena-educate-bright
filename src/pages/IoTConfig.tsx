import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wifi, Settings } from 'lucide-react';

interface Escola { id: string; nome: string; }
interface IoTConfig { id: string; escola_id: string; modo_verificacao: string; ativo: boolean; }
interface EventLog { id: string; dispositivo_id: string; matricula: string; evento: string; timestamp_evento: string; status_processamento: string; erro: string | null; created_at: string; }

export default function IoTConfig() {
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [configs, setConfigs] = useState<IoTConfig[]>([]);
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [selectedEscola, setSelectedEscola] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: e } = await supabase.from('escolas').select('id, nome').order('nome');
      setEscolas(e as Escola[] || []);
      const { data: c } = await supabase.from('escola_iot_config').select('*');
      setConfigs(c as IoTConfig[] || []);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedEscola) return;
    const loadLogs = async () => {
      const { data } = await supabase
        .from('iot_evento_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs(data as EventLog[] || []);
    };
    loadLogs();
  }, [selectedEscola]);

  const getConfig = (escolaId: string) => configs.find(c => c.escola_id === escolaId);

  const updateConfig = async (escolaId: string, field: string, value: any) => {
    const existing = getConfig(escolaId);
    if (existing) {
      const { error } = await supabase.from('escola_iot_config').update({ [field]: value }).eq('id', existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('escola_iot_config').insert({ escola_id: escolaId, [field]: value });
      if (error) { toast.error(error.message); return; }
    }
    const { data: c } = await supabase.from('escola_iot_config').select('*');
    setConfigs(c as IoTConfig[] || []);
    toast.success('Configuração atualizada.');
  };

  const config = selectedEscola ? getConfig(selectedEscola) : null;

  return (
    <div>
      <PageHeader title="Configuração IoT" description="Gerencie dispositivos Control iD por escola" />

      <div className="mb-6">
        <Select value={selectedEscola} onValueChange={setSelectedEscola}>
          <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecione a escola" /></SelectTrigger>
          <SelectContent>
            {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedEscola && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" /> Modo de Verificação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Integração ativa</Label>
                  <p className="text-xs text-muted-foreground">Habilita o recebimento de eventos IoT</p>
                </div>
                <Switch
                  checked={config?.ativo ?? true}
                  onCheckedChange={v => updateConfig(selectedEscola, 'ativo', v)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Modo</Label>
                <Select
                  value={config?.modo_verificacao ?? 'entrada'}
                  onValueChange={v => updateConfig(selectedEscola, 'modo_verificacao', v)}
                >
                  <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada apenas</SelectItem>
                    <SelectItem value="entrada_saida">Entrada e Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Endpoint Webhook:</p>
                <code className="text-[11px] break-all">
                  https://rpzbzdffequiunyhgafj.supabase.co/functions/v1/presenca-evento
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="h-4 w-4" /> Últimos Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dispositivo</TableHead>
                        <TableHead>Matrícula</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">{log.dispositivo_id}</TableCell>
                          <TableCell>{log.matricula}</TableCell>
                          <TableCell>
                            <Badge variant={log.evento === 'entrada' ? 'default' : 'secondary'}>
                              {log.evento}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(log.timestamp_evento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status_processamento === 'processado' ? 'default' : 'destructive'}>
                              {log.status_processamento}
                            </Badge>
                            {log.erro && <p className="text-[10px] text-destructive mt-0.5">{log.erro}</p>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedEscola && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wifi className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Selecione uma escola para configurar a integração IoT.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
