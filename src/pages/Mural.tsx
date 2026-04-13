import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Send, Users, School, BookOpen, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { enviarComunicadoEmMassa, type AlvoComunicado } from '@/lib/notification-service';
import { Progress } from '@/components/ui/progress';

interface TurmaOption { id: string; nome: string; }
interface EscolaOption { id: string; nome: string; }

interface HistoricoItem {
  titulo: string;
  mensagem: string;
  data_envio: string;
  total_destinatarios: number;
}

export default function Mural() {
  const { perfil, escolaAtiva } = useAuthStore();
  const isSecretaria = perfil?.papel === 'SECRETARIA';

  const [escolas, setEscolas] = useState<EscolaOption[]>([]);
  const [escolaFiltro, setEscolaFiltro] = useState<string>('');
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  // Form
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [alvo, setAlvo] = useState<AlvoComunicado>('escola');
  const [turmaId, setTurmaId] = useState('');

  // Send state
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ feitas: number; total: number } | null>(null);
  const [enviadas, setEnviadas] = useState<number | null>(null);

  // ── Escola efetiva: para SECRETARIA usa o seletor; para os outros usa escolaAtiva ──
  const escolaEfetiva = isSecretaria ? escolaFiltro : (escolaAtiva ?? '');

  // Carrega lista de escolas (somente para SECRETARIA)
  useEffect(() => {
    if (!isSecretaria) return;
    db.escolas.list().then(({ data }) => {
      setEscolas(((data || []) as any[]).map(e => ({ id: e.id, nome: e.nome })));
    });
  }, [isSecretaria]);

  // Carrega turmas sempre que a escola efetiva muda
  const loadTurmas = useCallback(async () => {
    if (!escolaEfetiva) { setTurmas([]); return; }
    const { data } = await db.turmas.listByEscola(escolaEfetiva);
    setTurmas(((data || []) as any[]).map(x => ({ id: x.id, nome: x.nome })));
  }, [escolaEfetiva]);

  useEffect(() => { loadTurmas(); }, [loadTurmas]);

  // Reseta turmaId quando a escola muda
  useEffect(() => { setTurmaId(''); }, [escolaEfetiva]);

  const reloadHistorico = useCallback(async () => {
    if (!perfil) return;
    const { data } = await db.mural.listComunicadosEnviados(perfil.id);
    setHistorico((data || []) as HistoricoItem[]);
  }, [perfil]);

  useEffect(() => { reloadHistorico(); }, [reloadHistorico]);

  const handleEnviar = async () => {
    if (!perfil) return;
    if (!titulo.trim()) { toast.error('O título é obrigatório.'); return; }
    if (!mensagem.trim()) { toast.error('A mensagem é obrigatória.'); return; }
    if (alvo === 'turma' && !turmaId) { toast.error('Selecione a turma.'); return; }
    if (!escolaEfetiva && alvo !== 'turma') { toast.error('Selecione a escola de destino.'); return; }

    setSending(true);
    setProgress(null);
    setEnviadas(null);
    try {
      const result = await enviarComunicadoEmMassa({
        remetente_id: perfil.id,
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        alvo,
        escola_id: escolaEfetiva || null,
        turma_id: alvo === 'turma' ? turmaId : null,
        onProgress: (feitas, total) => setProgress({ feitas, total }),
      });

      setEnviadas(result.enviadas);
      toast.success(`Comunicado enviado para ${result.enviadas} destinatário(s)!`);
      setTitulo('');
      setMensagem('');
      setTurmaId('');
      reloadHistorico();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar comunicado.');
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const alvoLabels: Record<AlvoComunicado, string> = {
    escola:       'Toda a Escola (Professores + Responsáveis)',
    professores:  'Apenas Professores',
    responsaveis: 'Apenas Responsáveis',
    turma:        'Turma Específica',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Mural de Comunicados
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Envie comunicados em massa para professores e responsáveis.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Formulário */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo Comunicado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Seletor de Escola — somente SECRETARIA */}
            {isSecretaria && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5 text-muted-foreground" />
                  Escola de Destino *
                </Label>
                <Select value={escolaFiltro} onValueChange={setEscolaFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a escola" />
                  </SelectTrigger>
                  <SelectContent>
                    {escolas.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Destinatários */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Destinatários</Label>
              <RadioGroup value={alvo} onValueChange={v => setAlvo(v as AlvoComunicado)} className="space-y-2">
                {(Object.keys(alvoLabels) as AlvoComunicado[]).map(key => (
                  <div key={key} className="flex items-center gap-2">
                    <RadioGroupItem value={key} id={`alvo-${key}`} />
                    <Label htmlFor={`alvo-${key}`} className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                      {key === 'escola'       && <School className="h-3.5 w-3.5 text-muted-foreground" />}
                      {key === 'professores'  && <Users  className="h-3.5 w-3.5 text-muted-foreground" />}
                      {key === 'responsaveis' && <Users  className="h-3.5 w-3.5 text-muted-foreground" />}
                      {key === 'turma'        && <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                      {alvoLabels[key]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Turma (se selecionado) */}
            {alvo === 'turma' && (
              <div className="space-y-2">
                <Label>Turma *</Label>
                {isSecretaria && !escolaFiltro ? (
                  <p className="text-sm text-muted-foreground italic">Selecione uma escola primeiro.</p>
                ) : turmas.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhuma turma encontrada para esta escola.</p>
                ) : (
                  <Select value={turmaId} onValueChange={setTurmaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                    <SelectContent>
                      {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Reunião de Pais — Março"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                placeholder="Escreva o comunicado aqui…"
                rows={5}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">{mensagem.length}/1000</p>
            </div>

            {/* Progresso de envio */}
            {sending && progress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Enviando…</span>
                  <span>{progress.feitas} / {progress.total}</span>
                </div>
                <Progress value={progress.total > 0 ? (progress.feitas / progress.total) * 100 : 0} className="h-2" />
              </div>
            )}

            {enviadas !== null && !sending && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Comunicado enviado para <strong>{enviadas}</strong> destinatário(s).
              </div>
            )}

            <Button onClick={handleEnviar} className="w-full gap-2" disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? 'Enviando…' : 'Enviar Comunicado'}
            </Button>
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimos Comunicados</CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum comunicado enviado ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {historico.map((h, i) => (
                  <div key={i} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug line-clamp-1">{h.titulo}</p>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {h.total_destinatarios} dest.
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{h.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {(() => {
                        try { return format(new Date(h.data_envio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
                        catch { return h.data_envio; }
                      })()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
