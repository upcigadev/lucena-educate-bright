import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '@/lib/mock-db';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, CalendarIcon, Clock, GraduationCap, Users, TrendingUp, Pencil, Trash2, Plus, X, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { SendNotificationModal } from '@/components/shared/SendNotificationModal';

type StatusType = 'presente' | 'atrasado' | 'falta' | 'justificada';

interface FreqAluno {
  id: string;
  nome: string;
  matricula: string;
  iniciais: string;
  idfaceUserId: string | null;
  status: StatusType;
  horaEntrada: string | null;
}

interface TurmaRow {
  id: string;
  nome: string;
  sala: string | null;
  escola_id: string;
  serie_id: string;
  horario_inicio: string | null;
  tolerancia_min: number | null;
  limite_max: string | null;
}

interface ProfessorOption { id: string; nome: string; }
interface AlunoOption { id: string; nome_completo: string; matricula: string; idface_user_id: string | null; turma_id: string | null; }

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  presente:   { label: 'Presente',        className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
  atrasado:   { label: 'Atrasado',        className: 'bg-amber-500/15 text-amber-700 border-amber-200' },
  falta:      { label: 'Falta',           className: 'bg-destructive/15 text-destructive border-destructive/20' },
  justificada:{ label: 'Falta Justificada', className: 'bg-blue-500/15 text-blue-700 border-blue-200' },
};

const avatarColors = [
  'bg-primary/15 text-primary', 'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',  'bg-cyan-100 text-cyan-700',
];

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Recomputes the attendance status from hora_entrada and the turma schedule.
 * horario_inicio = greatest arrival time to be Presente.
 * Arriving after horario_inicio = Atrasado.
 */
function computeStatus(
  horaEntrada: string,
  horarioInicio: string | null
): 'presente' | 'atrasado' {
  if (!horarioInicio) return 'presente';
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return toMins(horaEntrada.slice(0, 5)) <= toMins(horarioInicio.slice(0, 5)) ? 'presente' : 'atrasado';
}

export default function TurmaDetalhe() {
  const { escolaId, turmaId } = useParams();
  const navigate = useNavigate();
  const { perfil } = useAuthStore();
  const [date, setDate] = useState<Date>(new Date());
  const [turma, setTurma] = useState<TurmaRow | null>(null);
  const [escola, setEscola] = useState<{ nome: string } | null>(null);
  const [freqAlunos, setFreqAlunos] = useState<FreqAluno[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit turma
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ nome: '', sala: '', horario_inicio: '', tolerancia_min: '', limite_max: '' });
  const [saving, setSaving] = useState(false);

  // Professor management
  const [profOpen, setProfOpen] = useState(false);
  const [allProfessores, setAllProfessores] = useState<ProfessorOption[]>([]);
  const [selectedProfIds, setSelectedProfIds] = useState<string[]>([]);
  const [savingProfs, setSavingProfs] = useState(false);

  // Aluno management
  const [alunoOpen, setAlunoOpen] = useState(false);
  const [escolaAlunos, setEscolaAlunos] = useState<AlunoOption[]>([]);
  const [turmaAlunoIds, setTurmaAlunoIds] = useState<string[]>([]);
  const [savingAlunos, setSavingAlunos] = useState(false);
  const [alunoSearch, setAlunoSearch] = useState('');

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Notification to responsible
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifDestinatario, setNotifDestinatario] = useState<{ id: string; nome: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!turmaId || !escolaId) return;

    if (perfil?.papel === 'PROFESSOR') {
      const { data: myTurmas } = await db.turmas.listByProfessor(perfil.id);
      const owns = ((myTurmas || []) as any[]).some(t => t.id === turmaId);
      if (!owns) {
        toast.error('Acesso negado: Turma não vinculada.');
        navigate('/minhas-turmas');
        return;
      }
    }

    setLoading(true);
    try {
      const { data: t } = await db.turmas.getById(turmaId);
      const { data: e } = await db.escolas.getById(escolaId);
      setTurma(t as TurmaRow | null);
      setEscola(e as any);

      const dateStr = format(date, 'yyyy-MM-dd');
      const { data: alunos } = await db.alunos.listByTurma(turmaId);
      const { data: freqs } = await db.frequencias.listByTurmaAndDate(turmaId, dateStr);
      const freqMap = new Map((freqs || []).map((f: any) => [f.aluno_id, f]));

      // Recompute status from hora_entrada and current schedule; heal stale DB records.
      const horarioInicio = (t as TurmaRow | null)?.horario_inicio ?? null;
      const corrections: Promise<any>[] = [];

      const mapped: FreqAluno[] = ((alunos || []) as AlunoOption[]).map(a => {
        const freq = freqMap.get(a.id) as any;
        let status: StatusType = 'falta';
        if (freq?.hora_entrada) {
          const recomputed = computeStatus(freq.hora_entrada, horarioInicio);
          status = recomputed;
          // Heal stale DB record if status differs
          if (freq.status !== recomputed) {
            corrections.push(db.frequencias.updateStatus(freq.id, recomputed));
          }
        } else if (freq?.status && freq.status !== 'falta') {
          status = freq.status as StatusType;
        }
        return {
          id: a.id,
          nome: a.nome_completo,
          matricula: a.matricula,
          iniciais: getInitials(a.nome_completo),
          idfaceUserId: a.idface_user_id || null,
          status,
          horaEntrada: freq?.hora_entrada || null,
        };
      });

      // Fire DB corrections in background (don't block UI)
      if (corrections.length > 0) Promise.all(corrections).catch(console.warn);

      setFreqAlunos(mapped);
    } finally {
      setLoading(false);
    }
  }, [turmaId, escolaId, date, perfil, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Real-time refresh via WebSocket ──────────────────────────────
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const socket = io('http://localhost:3000', {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
    });

    socket.on('device:accessLog', (payload: any) => {
      if (payload?.type !== 'log') return;
      // Wait a brief moment so GlobalDeviceMonitor has time to persist the
      // frequency record in SQLite before we re-query the database.
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        loadData();
      }, 800);
    });

    return () => {
      socket.disconnect();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [loadData]);

  // ── Edit turma ────────────────────────────────────────────────
  const openEdit = () => {
    if (!turma) return;
    setEditForm({
      nome: turma.nome,
      sala: turma.sala || '',
      horario_inicio: turma.horario_inicio || '',
      tolerancia_min: turma.tolerancia_min != null ? String(turma.tolerancia_min) : '',
      limite_max: turma.limite_max || '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!turmaId) return;
    setSaving(true);
    try {
      await db.turmas.update(turmaId, {
        nome: editForm.nome || undefined,
        sala: editForm.sala || null,
        horario_inicio: editForm.horario_inicio || null,
        tolerancia_min: editForm.tolerancia_min ? Number(editForm.tolerancia_min) : null,
        limite_max: editForm.limite_max || null,
      });
      toast.success('Turma atualizada.');
      setEditOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  // ── Delete turma ──────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!turmaId || !escolaId) return;
    setDeleting(true);
    try {
      await db.turmas.delete(turmaId);
      toast.success('Turma excluída.');
      navigate(`/escolas/${escolaId}`);
    } finally {
      setDeleting(false);
    }
  };

  // ── Professor management ──────────────────────────────────────
  const openProfManagement = async () => {
    const { data: all } = await db.professores.list();
    const { data: current } = await db.turma_professores.listProfessoresCompleto(turmaId!);
    setAllProfessores((all as ProfessorOption[]) || []);
    setSelectedProfIds(((current as any[]) || []).map(p => p.professor_id));
    setProfOpen(true);
  };

  const saveProfs = async () => {
    setSavingProfs(true);
    try {
      await db.turma_professores.setProfessores(turmaId!, selectedProfIds);
      toast.success('Professores atualizados.');
      setProfOpen(false);
      loadData();
    } finally {
      setSavingProfs(false);
    }
  };

  const toggleProf = (id: string) =>
    setSelectedProfIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Aluno management ──────────────────────────────────────────
  const openAlunoManagement = async () => {
    if (!turma) return;
    setAlunoSearch('');
    const { data: todos } = await db.alunos.listByEscola(turma.escola_id);
    setEscolaAlunos((todos as AlunoOption[]) || []);
    setTurmaAlunoIds(((todos as AlunoOption[]) || []).filter(a => a.turma_id === turmaId).map(a => a.id));
    setAlunoOpen(true);
  };

  const toggleAluno = (id: string) =>
    setTurmaAlunoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveAlunos = async () => {
    setSavingAlunos(true);
    try {
      // Assign alunos in `turmaAlunoIds` to this turma; unassign others from this turma
      for (const a of escolaAlunos) {
        const shouldBeInTurma = turmaAlunoIds.includes(a.id);
        const isInTurma = a.turma_id === turmaId;
        if (shouldBeInTurma && !isInTurma) {
          await db.alunos.update(a.id, { turma_id: turmaId });
        } else if (!shouldBeInTurma && isInTurma) {
          await db.alunos.update(a.id, { turma_id: null });
        }
      }
      toast.success('Alunos da turma atualizados.');
      setAlunoOpen(false);
      loadData();
    } finally {
      setSavingAlunos(false);
    }
  };

  const counts = {
    presentes: freqAlunos.filter(a => a.status === 'presente').length,
    atrasados: freqAlunos.filter(a => a.status === 'atrasado').length,
    faltas: freqAlunos.filter(a => a.status === 'falta').length,
    justificadas: freqAlunos.filter(a => a.status === 'justificada').length,
  };

  // ── Notify responsible ─────────────────────────────────────
  const openNotifResponsavel = async (alunoId: string, alunoNome: string) => {
    try {
      const vinculosRes = await db.alunoResponsaveis.listByAluno(alunoId);
      const vinculos = (vinculosRes.data || []) as Array<{ responsavel_id: string; usuario_id?: string; nome?: string }>;
      if (vinculos.length === 0) {
        toast.error('Este aluno não possui responsável cadastrado.');
        return;
      }
      // Take first responsible
      const first = vinculos[0];
      // The listByAluno query already joins usuarios, so nome and usuario_id are available
      const respUsuarioId = (first as any).usuario_id ?? null;
      const respNome = (first as any).nome ?? 'Responsável';
      if (!respUsuarioId) {
        toast.error('Responsável sem utilizador vinculado.');
        return;
      }
      setNotifDestinatario({ id: respUsuarioId, nome: respNome });
      setNotifOpen(true);
    } catch (e) {
      toast.error('Erro ao buscar responsável.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const turmaName = turma?.nome || 'Turma';
  const escolaName = escola?.nome || 'Escola';
  const totalAlunos = freqAlunos.length;
  const freqPct = totalAlunos > 0 ? Math.round(((counts.presentes + counts.atrasados) / totalAlunos) * 100) : 0;
  const filteredEscolaAlunos = escolaAlunos.filter(a =>
    !alunoSearch || a.nome_completo.toLowerCase().includes(alunoSearch.toLowerCase()) || a.matricula.includes(alunoSearch)
  );

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-wrap">
        <Link to="/escolas" className="hover:text-foreground transition-colors">Escolas</Link>
        <span>/</span>
        <Link to={`/escolas/${escolaId}`} className="hover:text-foreground transition-colors">{escolaName}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{turmaName}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link to={`/escolas/${escolaId}`}><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{turmaName}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {turma?.sala ? `Sala ${turma.sala}` : escolaName}
              {turma?.horario_inicio && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Máx. entrada: {turma.horario_inicio}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={openAlunoManagement}>
            <Users className="h-3.5 w-3.5 mr-1.5" /> Alunos
          </Button>
          <Button variant="outline" size="sm" onClick={openProfManagement}>
            <GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Professores
          </Button>
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar Turma
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center"><GraduationCap className="h-5 w-5 text-violet-600" /></div><div><p className="text-sm text-muted-foreground">Professores</p><p className="text-base font-semibold text-card-foreground">{freqAlunos.length > 0 ? totalAlunos : '—'}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total de Alunos</p><p className="text-2xl font-bold tabular-nums text-card-foreground">{totalAlunos}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Frequência do Dia</p><p className="text-2xl font-bold tabular-nums text-card-foreground">{freqPct}%</p></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Presentes', val: counts.presentes, pct: totalAlunos > 0 ? Math.round(counts.presentes / totalAlunos * 100) : 0, color: 'bg-emerald-500/10 text-emerald-600' },
          { label: 'Atrasados', val: counts.atrasados, pct: null, color: 'bg-amber-500/10 text-amber-600' },
          { label: 'Faltas',    val: counts.faltas,    pct: null, color: 'bg-destructive/10 text-destructive' },
          { label: 'Justificadas', val: counts.justificadas, pct: null, color: 'bg-blue-500/10 text-blue-600' },
        ].map(({ label, val, pct, color }) => (
          <Card key={label}><CardContent className="p-4 flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}><span className="font-bold text-sm">{val}</span></div>
            <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold tabular-nums">{pct != null ? `${pct}%` : val}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Attendance table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Chamada do Dia</CardTitle></CardHeader>
        <CardContent>
          {freqAlunos.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-muted-foreground text-sm">Nenhum aluno nesta turma.</p>
              <Button size="sm" variant="outline" onClick={openAlunoManagement}><Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Alunos</Button>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-12">Foto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Matrícula</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Hora de Entrada</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {freqAlunos.map((aluno, idx) => {
                  const cfg = statusConfig[aluno.status];
                  const colorClass = avatarColors[idx % avatarColors.length];
                  return (
                    <TableRow key={aluno.id}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={aluno.idfaceUserId ? `http://localhost:3000/api/device/photo/${aluno.idfaceUserId}` : ''}
                            className="object-cover"
                          />
                          <AvatarFallback className={cn('text-xs font-semibold', colorClass)}>{aluno.iniciais}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell><span className="font-medium">{aluno.nome}</span><span className="block text-xs text-muted-foreground sm:hidden">{aluno.matricula}</span></TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm tabular-nums">{aluno.matricula}</TableCell>
                      <TableCell><Badge variant="outline" className={cn('text-xs font-medium', cfg.className)}>{cfg.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        {aluno.horaEntrada
                          ? <span className="inline-flex items-center gap-1 text-sm tabular-nums"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{aluno.horaEntrada}</span>
                          : <span className="text-sm text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          title="Notificar Responsável"
                          onClick={(e) => { e.stopPropagation(); openNotifResponsavel(aluno.id, aluno.nome); }}
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Turma Sheet ─────────────────────────────────── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Turma</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Nome da Turma</Label><Input value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label>Número da Sala</Label><Input value={editForm.sala} onChange={e => setEditForm({ ...editForm, sala: e.target.value })} placeholder="Ex: 101" /></div>
            <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horários</p>
              <div className="space-y-2"><Label className="text-xs">Máx. horário de entrada (Presente até)</Label><Input type="time" value={editForm.horario_inicio} onChange={e => setEditForm({ ...editForm, horario_inicio: e.target.value })} /></div>
              <div className="space-y-2"><Label className="text-xs">Tolerância (min) — informativo</Label><Input type="number" min={0} value={editForm.tolerancia_min} onChange={e => setEditForm({ ...editForm, tolerancia_min: e.target.value })} /></div>
              <div className="space-y-2"><Label className="text-xs">Limite máximo (Atrasado até)</Label><Input type="time" value={editForm.limite_max} onChange={e => setEditForm({ ...editForm, limite_max: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={saveEdit} disabled={saving}>{saving ? 'Salvando…' : 'Salvar Alterações'}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Professor Management Sheet ────────────────────────── */}
      <Sheet open={profOpen} onOpenChange={setProfOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Gerenciar Professores</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            {allProfessores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum professor cadastrado.</p>
            ) : allProfessores.map(p => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                  selectedProfIds.includes(p.id) ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/40'
                )}
                onClick={() => toggleProf(p.id)}
              >
                <span className="text-sm font-medium">{p.nome}</span>
                {selectedProfIds.includes(p.id) && <Badge variant="secondary" className="text-xs">Vinculado</Badge>}
              </div>
            ))}
            <Button className="w-full mt-4" onClick={saveProfs} disabled={savingProfs}>{savingProfs ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Aluno Management Sheet ────────────────────────────── */}
      <Sheet open={alunoOpen} onOpenChange={setAlunoOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Gerenciar Alunos da Turma</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            <Input
              placeholder="Buscar aluno…"
              value={alunoSearch}
              onChange={e => setAlunoSearch(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Clique para adicionar ou remover da turma. Alunos de outras turmas são mostrados em cinza.</p>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredEscolaAlunos.map(a => {
                const isSelected = turmaAlunoIds.includes(a.id);
                const inOtherTurma = a.turma_id !== null && a.turma_id !== turmaId && !isSelected;
                return (
                  <div
                    key={a.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm',
                      isSelected ? 'border-primary/50 bg-primary/5' : inOtherTurma ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/40'
                    )}
                    onClick={() => !inOtherTurma && toggleAluno(a.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={a.idface_user_id ? `http://localhost:3000/api/device/photo/${a.idface_user_id}` : ''} className="object-cover" />
                        <AvatarFallback className="text-[10px]">{getInitials(a.nome_completo)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{a.nome_completo}</span>
                        <span className="text-xs text-muted-foreground ml-2">{a.matricula}</span>
                      </div>
                    </div>
                    {isSelected && <X className="h-4 w-4 text-primary shrink-0" />}
                    {inOtherTurma && <span className="text-xs text-muted-foreground">Outra turma</span>}
                  </div>
                );
              })}
            </div>
            <Button className="w-full" onClick={saveAlunos} disabled={savingAlunos}>{savingAlunos ? 'Salvando…' : `Salvar (${turmaAlunoIds.length} alunos)`}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation Dialog ───────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir Turma</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a turma <strong>{turmaName}</strong>? Os alunos serão desvinculados mas não removidos do sistema.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Notification Modal ───────────────────────────── */}
      {notifDestinatario && (
        <SendNotificationModal
          open={notifOpen}
          onClose={() => { setNotifOpen(false); setNotifDestinatario(null); }}
          destinatarioId={notifDestinatario.id}
          destinatarioNome={notifDestinatario.nome}
          defaultTitulo="Informação sobre frequência"
        />
      )}
    </div>
  );
}
