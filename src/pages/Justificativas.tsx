import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CheckCircle, XCircle, Clock, CalendarIcon, AlertTriangle, Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

interface JustificativaRow {
  id: string;
  frequencia_id: string | null;
  aluno_id: string | null;
  responsavel_id: string;
  tipo: string;
  descricao: string | null;
  arquivo_url: string | null;
  status: string;
  observacao_diretor: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
  // joined
  aluno_nome?: string;
  aluno_matricula?: string;
  responsavel_nome?: string;
  data_falta?: string;
}

interface AlunoOption {
  id: string;
  nome_completo: string;
}

interface ResponsavelRow {
  id: string; // responsavel.id
  usuario_id: string;
}

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  pendente:  { label: 'Pendente',  variant: 'secondary',   icon: Clock },
  aprovada:  { label: 'Aprovada',  variant: 'default',     icon: CheckCircle },
  rejeitada: { label: 'Rejeitada', variant: 'destructive', icon: XCircle },
  // Retrocompat with old uppercase values
  Pendente:  { label: 'Pendente',  variant: 'secondary',   icon: Clock },
  Aprovada:  { label: 'Aprovada',  variant: 'default',     icon: CheckCircle },
  Reprovada: { label: 'Rejeitada', variant: 'destructive', icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.pendente;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function formatDateRange(inicio: string | null, fim: string | null, fallback: string | null): string {
  const fmt = (d: string) => {
    try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; }
  };
  if (inicio && fim) return `${fmt(inicio)} → ${fmt(fim)}`;
  if (inicio) return fmt(inicio);
  if (fallback) return fmt(fallback + 'T00:00:00');
  return '—';
}

// ───────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────

export default function Justificativas() {
  const { perfil, escolaAtiva } = useAuthStore();
  const isResponsavel = perfil?.papel === 'RESPONSAVEL';
  const isDiretor = perfil?.papel === 'DIRETOR';
  const isSecretaria = perfil?.papel === 'SECRETARIA';
  const podeAprovar = isDiretor || isSecretaria;

  // ── Data ────────────────────────────────────────────────────
  const [justificativas, setJustificativas] = useState<JustificativaRow[]>([]);
  const [pendentes, setPendentes] = useState<JustificativaRow[]>([]);
  const [meuFilhos, setMeusFilhos] = useState<AlunoOption[]>([]);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── New justificativa form ───────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>('');
  const [tipo, setTipo] = useState('Atestado Médico');
  const [descricao, setDescricao] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Detail / approval sheet ──────────────────────────────────
  const [detailSheet, setDetailSheet] = useState<JustificativaRow | null>(null);
  const [observacao, setObservacao] = useState('');
  const [approving, setApproving] = useState(false);

  // ── Load data ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!perfil) return;
    setLoading(true);
    try {
      if (isResponsavel) {
        // Load filhos
        const alunosRes = await db.alunos.listByResponsavelUsuarioId(perfil.id);
        const filhos = (alunosRes.data || []) as AlunoOption[];
        setMeusFilhos(filhos);
        if (filhos.length > 0 && !selectedAlunoId) setSelectedAlunoId(filhos[0].id);

        // Load responsavel entity id
        const respRows = await db.responsaveis.list();
        const resp = ((respRows.data || []) as ResponsavelRow[]).find(r => r.usuario_id === perfil.id);
        setResponsavelId(resp?.id || null);

        // Load justificativas do responsável
        const jRes = await db.justificativas.listByResponsavel(perfil.id);
        setJustificativas((jRes.data || []) as JustificativaRow[]);
      } else if (podeAprovar) {
        const escola = escolaAtiva;
        if (escola) {
          const [allRes, pendRes] = await Promise.all([
            db.justificativas.listByEscola(escola),
            db.justificativas.listPendentes(escola),
          ]);
          setJustificativas((allRes.data || []) as JustificativaRow[]);
          setPendentes((pendRes.data || []) as JustificativaRow[]);
        } else {
          // Secretaria sem escola ativa — lista tudo
          const allRes = await db.justificativas.list();
          setJustificativas((allRes.data || []) as JustificativaRow[]);
          setPendentes([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [perfil, escolaAtiva, isResponsavel, podeAprovar, selectedAlunoId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Submit new justificativa ─────────────────────────────────
  const handleSubmit = async () => {
    if (!responsavelId) {
      toast.error('Responsável não encontrado. Contacte o administrador.');
      return;
    }
    if (!selectedAlunoId) {
      toast.error('Selecione um aluno.');
      return;
    }
    if (!dateRange?.from) {
      toast.error('Selecione o período da falta.');
      return;
    }
    if (!descricao.trim()) {
      toast.error('A descrição é obrigatória.');
      return;
    }
    setSubmitting(true);
    try {
      await db.justificativas.insert({
        responsavel_id: responsavelId,
        aluno_id: selectedAlunoId,
        tipo,
        descricao: descricao.trim(),
        data_inicio: format(dateRange.from, 'yyyy-MM-dd'),
        data_fim: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : format(dateRange.from, 'yyyy-MM-dd'),
      });
      toast.success('Justificativa enviada! Aguarda aprovação do Diretor.');
      setSheetOpen(false);
      setDescricao('');
      setDateRange(undefined);
      loadData();
    } catch (err) {
      toast.error('Erro ao enviar justificativa.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Approve / reject ─────────────────────────────────────────
  const handleApproval = async (justificativa: JustificativaRow, approved: boolean) => {
    setApproving(true);
    try {
      const newStatus = approved ? 'aprovada' : 'rejeitada';
      await db.justificativas.update(justificativa.id, {
        status: newStatus,
        observacao_diretor: observacao || null,
      });

      // 🎁 Bonus UX: notificar o responsável automaticamente ao aprovar
      if (approved && perfil && justificativa.responsavel_id) {
        try {
          // Busca o usuario_id do responsável
          const respRows = await db.responsaveis.list();
          const resp = ((respRows.data || []) as ResponsavelRow[]).find(r => r.id === justificativa.responsavel_id);
          if (resp?.usuario_id) {
            await db.notificacoes.insert({
              remetente_id: perfil.id,
              destinatario_id: resp.usuario_id,
              titulo: 'Justificativa Aprovada ✅',
              mensagem: `A justificativa de falta do(a) aluno(a) ${justificativa.aluno_nome ?? ''} foi aprovada.${observacao ? ` Observação: ${observacao}` : ''}`,
            });
          }
        } catch (e) {
          console.warn('Erro ao enviar notificação de aprovação:', e);
        }
      }

      toast.success(approved ? 'Justificativa aprovada!' : 'Justificativa rejeitada.');
      setDetailSheet(null);
      setObservacao('');
      loadData();
    } catch (err) {
      toast.error('Erro ao atualizar justificativa.');
    } finally {
      setApproving(false);
    }
  };

  // ── Table columns ────────────────────────────────────────────
  const columns: Column<JustificativaRow>[] = [
    { key: 'aluno_nome', header: 'Aluno', render: r => r.aluno_nome || '—' },
    {
      key: 'data_inicio', header: 'Período',
      render: r => formatDateRange(r.data_inicio, r.data_fim, r.data_falta ?? null),
    },
    { key: 'tipo', header: 'Tipo' },
    {
      key: 'status', header: 'Status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'created_at', header: 'Enviada em',
      render: r => {
        try { return format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }); }
        catch { return r.created_at; }
      },
    },
  ];

  if (!isResponsavel) {
    columns.splice(1, 0, { key: 'responsavel_nome', header: 'Responsável', render: r => r.responsavel_nome || '—' });
  }

  const openNew = () => {
    setDescricao('');
    setTipo('Atestado Médico');
    setDateRange(undefined);
    if (meuFilhos.length > 0) setSelectedAlunoId(meuFilhos[0].id);
    setSheetOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Justificativas de Falta"
        description={isResponsavel ? 'Envie justificativas para as faltas dos seus filhos' : 'Gerencie justificativas de falta'}
        actionLabel={isResponsavel ? 'Justificar Falta' : undefined}
        onAction={isResponsavel ? openNew : undefined}
      />

      {/* Painel de Pendentes — apenas para Diretor/Secretaria */}
      {podeAprovar && pendentes.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Justificativas Pendentes
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {pendentes.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendentes.map(j => (
              <div
                key={j.id}
                className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-white dark:bg-card px-4 py-3 gap-3 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{j.aluno_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {j.tipo} · {formatDateRange(j.data_inicio, j.data_fim, j.data_falta ?? null)}
                    {j.responsavel_nome && ` · Resp: ${j.responsavel_nome}`}
                  </p>
                  {j.descricao && (
                    <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">{j.descricao}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => { setDetailSheet(j); setObservacao(''); }}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => { setDetailSheet(j); setObservacao(''); }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          data={justificativas}
          columns={columns}
          onRowClick={(row) => { setDetailSheet(row); setObservacao(row.observacao_diretor || ''); }}
          searchPlaceholder="Buscar justificativa…"
        />
      )}

      {/* ── Nova Justificativa (Responsável) ────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Nova Justificativa</SheetTitle></SheetHeader>
          <div className="space-y-5 mt-5">

            {/* Aluno */}
            {meuFilhos.length > 0 ? (
              <div className="space-y-2">
                <Label>Aluno *</Label>
                <Select value={selectedAlunoId} onValueChange={setSelectedAlunoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                  <SelectContent>
                    {meuFilhos.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aluno vinculado à sua conta.</p>
            )}

            {/* Período (DateRangePicker) */}
            <div className="space-y-2">
              <Label>Período da Falta *</Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dateRange && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to
                        ? `${format(dateRange.from, 'dd/MM/yyyy')} → ${format(dateRange.to, 'dd/MM/yyyy')}`
                        : format(dateRange.from, 'dd/MM/yyyy')
                    ) : (
                      'Selecione o período'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      if (range?.from && range?.to) setDatePopoverOpen(false);
                    }}
                    locale={ptBR}
                    initialFocus
                    className="pointer-events-auto"
                    disabled={{ after: new Date() }}
                  />
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => { setDateRange(undefined); setDatePopoverOpen(false); }}
                    >
                      Limpar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Para um único dia, selecione apenas a data de início.
              </p>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo de Justificativa *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Atestado Médico">Atestado Médico</SelectItem>
                  <SelectItem value="Consulta Médica">Consulta Médica</SelectItem>
                  <SelectItem value="Viagem">Viagem</SelectItem>
                  <SelectItem value="Luto">Luto</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição / Motivo *</Label>
              <Textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva o motivo da(s) falta(s)…"
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{descricao.length}/500</p>
            </div>

            <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar Justificativa'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Detalhes / Aprovação ────────────────────────────── */}
      <Sheet open={!!detailSheet} onOpenChange={(v) => { if (!v) { setDetailSheet(null); setObservacao(''); } }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Detalhes da Justificativa</SheetTitle></SheetHeader>
          {detailSheet && (
            <div className="space-y-5 mt-5">
              <div className="space-y-3">
                <InfoRow label="Aluno" value={detailSheet.aluno_nome || '—'} />
                <InfoRow label="Responsável" value={detailSheet.responsavel_nome || '—'} />
                <InfoRow label="Tipo" value={detailSheet.tipo} />
                <InfoRow
                  label="Período"
                  value={formatDateRange(detailSheet.data_inicio, detailSheet.data_fim, detailSheet.data_falta ?? null)}
                />
                {detailSheet.descricao && (
                  <InfoRow label="Descrição" value={detailSheet.descricao} />
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={detailSheet.status} />
                </div>
                {detailSheet.observacao_diretor && (
                  <InfoRow label="Observação do Diretor" value={detailSheet.observacao_diretor} />
                )}
              </div>

              {/* Painel de aprovação — apenas para Diretor/Secretaria quando pendente */}
              {podeAprovar && (detailSheet.status === 'pendente' || detailSheet.status === 'Pendente') && (
                <div className="space-y-3 border-t pt-5">
                  <p className="text-sm font-medium text-foreground">Decisão</p>
                  <div className="space-y-2">
                    <Label>Observação (opcional)</Label>
                    <Textarea
                      value={observacao}
                      onChange={e => setObservacao(e.target.value)}
                      placeholder="Adicione uma observação…"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleApproval(detailSheet, true)}
                      disabled={approving}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 gap-1.5"
                      onClick={() => handleApproval(detailSheet, false)}
                      disabled={approving}
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bell className="h-3 w-3" />
                    Ao aprovar, o responsável recebe uma notificação automática.
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}
