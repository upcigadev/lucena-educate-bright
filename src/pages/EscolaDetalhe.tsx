import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, TrendingUp, UserCog, BookOpen, ArrowLeft, ArrowRight, Plus, Pencil, School, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';

const SERIES_OPTIONS = [
  'Creche', 'Pré-Escola', '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano',
  '6º Ano', '7º Ano', '8º Ano', '9º Ano',
  '1ª Série - Ensino Médio', '2ª Série - Ensino Médio', '3ª Série - Ensino Médio',
];

const TURMA_LETRAS = ['A', 'B', 'C', 'D', 'E', 'U - Única'];

interface Serie { id: string; nome: string; horario_inicio: string | null; tolerancia_min: number | null; }
interface Turma { id: string; nome: string; sala: string | null; serie_id: string; }
interface Escola {
  id: string; nome: string; inep: string | null; endereco: string | null; telefone: string | null;
  horario_inicio: string | null; tolerancia_min: number | null; limite_max: string | null;
}

export default function EscolaDetalhe() {
  const { escolaId } = useParams();
  const navigate = useNavigate();
  const { perfil, escolaAtiva } = useAuthStore();
  const [escola, setEscola] = useState<Escola | null>(null);
  const [series, setSeries] = useState<Serie[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAlunos, setTotalAlunos] = useState(0);
  const [diretorNome, setDiretorNome] = useState('—');

  // Edit escola sheet
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editForm, setEditForm] = useState({ nome: '', inep: '', endereco: '', telefone: '' });

  // Schedule config dialog
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ horario_inicio: '', tolerancia_min: '', limite_max: '' });
  const [applyToAll, setApplyToAll] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  // Per-serie override dialog
  const [perSerieOpen, setPerSerieOpen] = useState(false);
  interface SerieSchedule { id: string; nome: string; horario_inicio: string; tolerancia_min: string; }
  const [serieSchedules, setSerieSchedules] = useState<SerieSchedule[]>([]);
  const [savingPerSerie, setSavingPerSerie] = useState(false);

  // Serie sheet
  const [serieSheetOpen, setSerieSheetOpen] = useState(false);
  const [serieForm, setSerieForm] = useState({ nome: '', horario_inicio: '', tolerancia_min: '' });

  // Delete serie
  const [deleteSerieOpen, setDeleteSerieOpen] = useState(false);
  const [serieToDelete, setSerieToDelete] = useState<Serie | null>(null);
  const [deletingSerie, setDeletingSerie] = useState(false);

  // Turma sheet
  const [turmaSheetOpen, setTurmaSheetOpen] = useState(false);
  const [turmaSerieId, setTurmaSerieId] = useState('');
  const [turmaForm, setTurmaForm] = useState({ letra: '', sala: '' });

  const load = async () => {
    if (!escolaId) return;

    if (perfil?.papel === 'DIRETOR' && escolaId !== escolaAtiva) {
      toast.error('Acesso negado: Você só pode visualizar a sua própria escola.');
      navigate('/dashboard');
      return;
    }

    setLoading(true);
    const { data: escolaData } = await db.escolas.getById(escolaId);
    const { data: seriesData } = await db.series.listByEscola(escolaId);
    const { data: turmasData } = await db.turmas.listByEscola(escolaId);
    const { data: alunoCount } = await db.alunos.countByEscola(escolaId);
    const { data: diretor } = await db.diretores.getByEscola(escolaId);
    setEscola(escolaData as Escola | null);
    setSeries((seriesData as Serie[]) || []);
    setTurmas((turmasData as Turma[]) || []);
    setTotalAlunos(alunoCount as number || 0);
    setDiretorNome((diretor as any)?.nome || '—');
    setLoading(false);
  };

  useEffect(() => { load(); }, [escolaId]);

  const openEditEscola = () => {
    if (!escola) return;
    setEditForm({ nome: escola.nome, inep: escola.inep || '', endereco: escola.endereco || '', telefone: escola.telefone || '' });
    setEditSheetOpen(true);
  };

  const saveEscola = async () => {
    if (!escolaId || !editForm.nome.trim()) return;
    await db.escolas.update(escolaId, { nome: editForm.nome, inep: editForm.inep || null, endereco: editForm.endereco || null, telefone: editForm.telefone || null });
    toast.success('Escola atualizada.');
    setEditSheetOpen(false);
    load();
  };

  const openSchedule = () => {
    if (!escola) return;
    setScheduleForm({
      horario_inicio: escola.horario_inicio || '',
      tolerancia_min: escola.tolerancia_min != null ? String(escola.tolerancia_min) : '',
      limite_max: escola.limite_max || '',
    });
    setApplyToAll(true); // default: apply to all
    setScheduleOpen(true);
  };

  // Called when user unchecks "Apply to all" — pre-fill per-serie list
  const handleApplyToAllChange = (checked: boolean) => {
    setApplyToAll(checked);
    if (!checked) {
      setSerieSchedules(series.map(s => ({
        id: s.id,
        nome: s.nome,
        horario_inicio: s.horario_inicio || scheduleForm.horario_inicio || '',
        tolerancia_min: s.tolerancia_min != null ? String(s.tolerancia_min) : scheduleForm.tolerancia_min || '',
      })));
      setScheduleOpen(false);
      setPerSerieOpen(true);
    }
  };

  const saveSchedule = async () => {
    if (!escolaId) return;
    setSavingSchedule(true);
    try {
      const horario_inicio = scheduleForm.horario_inicio || null;
      const tolerancia_min = scheduleForm.tolerancia_min ? Number(scheduleForm.tolerancia_min) : null;
      const limite_max = scheduleForm.limite_max || null;

      await db.escolas.update(escolaId, { horario_inicio, tolerancia_min, limite_max });

      if (applyToAll) {
        await db.escolas.applyScheduleToAll(escolaId, horario_inicio, tolerancia_min, limite_max);
        toast.success('Horários salvos e aplicados a todas as turmas da escola.');
      } else {
        toast.success('Horário padrão da escola salvo.');
      }
      setScheduleOpen(false);
      load();
    } finally {
      setSavingSchedule(false);
    }
  };

  const savePerSerie = async () => {
    if (!escolaId) return;
    setSavingPerSerie(true);
    try {
      // Save escola defaults too
      const horario_inicio = scheduleForm.horario_inicio || null;
      const tolerancia_min = scheduleForm.tolerancia_min ? Number(scheduleForm.tolerancia_min) : null;
      const limite_max = scheduleForm.limite_max || null;
      await db.escolas.update(escolaId, { horario_inicio, tolerancia_min, limite_max });
      // Save each serie individually
      for (const ss of serieSchedules) {
        await db.series.update(ss.id, {
          horario_inicio: ss.horario_inicio || null,
          tolerancia_min: ss.tolerancia_min ? Number(ss.tolerancia_min) : null,
        });
      }
      toast.success('Horários personalizados por série salvos.');
      setPerSerieOpen(false);
      load();
    } finally {
      setSavingPerSerie(false);
    }
  };

  const saveSerie = async () => {
    if (!escolaId || !serieForm.nome) return;
    await db.series.insert({ escola_id: escolaId, nome: serieForm.nome, horario_inicio: serieForm.horario_inicio || null, tolerancia_min: serieForm.tolerancia_min ? Number(serieForm.tolerancia_min) : null });
    toast.success('Série criada.');
    setSerieSheetOpen(false);
    setSerieForm({ nome: '', horario_inicio: '', tolerancia_min: '' });
    load();
  };

  const saveTurma = async () => {
    if (!escolaId || !turmaSerieId || !turmaForm.letra) return;
    const serie = series.find(s => s.id === turmaSerieId);
    const nomeCompleto = serie ? `${serie.nome} ${turmaForm.letra}` : turmaForm.letra;

    // Duplicate check
    const jaExiste = turmas.some(t => t.nome === nomeCompleto);
    if (jaExiste) {
      toast.error(`Turma "${nomeCompleto}" já existe nesta escola.`);
      return;
    }

    try {
      await db.turmas.insert({ escola_id: escolaId, serie_id: turmaSerieId, nome: nomeCompleto, sala: turmaForm.sala || null });
      toast.success('Turma criada.');
      setTurmaSheetOpen(false);
      setTurmaForm({ letra: '', sala: '' });
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar turma.');
    }
  };

  const getTurmasBySerie = (serieId: string) => turmas.filter(t => t.serie_id === serieId);

  const confirmDeleteSerie = async () => {
    if (!serieToDelete) return;
    setDeletingSerie(true);
    try {
      await db.series.delete(serieToDelete.id);
      toast.success(`Série "${serieToDelete.nome}" removida com sucesso.`);
      setDeleteSerieOpen(false);
      setSerieToDelete(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover série.');
    } finally {
      setDeletingSerie(false);
    }
  };

  const [freqGeral, setFreqGeral] = useState(0);
  useEffect(() => {
    if (!escolaId) return;
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      db.frequencias.countByEscola(escolaId, today),
      db.alunos.countByEscola(escolaId),
    ]).then(([{ data: fc }, { data: total }]) => {
      const f = (fc as any) || { total: 0, presentes: 0 };
      const t = Number(total) || 0;
      setFreqGeral(t > 0 ? Math.round(((f.presentes) / t) * 100) : 0);
    }).catch(() => {});
  }, [escolaId]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!escola) {
    return <div className="text-center py-20 text-muted-foreground"><p>Escola não encontrada.</p><Button variant="link" onClick={() => navigate('/escolas')}>Voltar</Button></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/escolas" className="hover:text-foreground transition-colors flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Escolas</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{escola.nome}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><School className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{escola.nome}</h1>
            {escola.inep && <p className="text-sm text-muted-foreground">INEP: {escola.inep}</p>}
            {escola.horario_inicio && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                Início padrão: {escola.horario_inicio}
                {escola.tolerancia_min != null && ` · Tolerância: ${escola.tolerancia_min} min`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openSchedule}>
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Configurar Horários
          </Button>
          <Button variant="outline" size="sm" onClick={openEditEscola}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar Escola
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total de Alunos</p><p className="text-2xl font-bold tabular-nums text-card-foreground">{totalAlunos}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Frequência Geral</p><p className="text-2xl font-bold tabular-nums text-card-foreground">{freqGeral}%</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center"><UserCog className="h-5 w-5 text-violet-600" /></div><div><p className="text-sm text-muted-foreground">Diretor(a)</p><p className="text-base font-semibold text-card-foreground">{diretorNome}</p></div></CardContent></Card>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Séries e Turmas</h2></div>
        <Button size="sm" onClick={() => { setSerieForm({ nome: '', horario_inicio: '', tolerancia_min: '' }); setSerieSheetOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Série</Button>
      </div>

      {series.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">Nenhuma série cadastrada</p><p className="text-sm">Adicione a primeira série desta escola.</p></CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {series.map(serie => {
            const serieTurmas = getTurmasBySerie(serie.id);
            return (
              <AccordionItem key={serie.id} value={serie.id} className="border rounded-lg px-4 bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant="secondary" className="text-xs font-semibold">{serie.nome}</Badge>
                    <span className="text-sm text-muted-foreground">{serieTurmas.length} turma{serieTurmas.length !== 1 ? 's' : ''}</span>
                    {serie.horario_inicio && <span className="text-xs text-muted-foreground">• Início: {serie.horario_inicio}</span>}
                  </div>
                  {perfil?.papel === 'SECRETARIA' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSerieToDelete(serie); setDeleteSerieOpen(true); }}
                      className="mr-2 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      title="Excluir série"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2 pb-2">
                    {serieTurmas.map(turma => (
                      <Button key={turma.id} variant="outline" size="sm" className="group" onClick={() => navigate(`/escolas/${escolaId}/turma/${turma.id}`)}>
                        {turma.nome}
                        {turma.sala && <span className="ml-1.5 text-xs text-muted-foreground">Sala {turma.sala}</span>}
                        <ArrowRight className="h-3.5 w-3.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Button>
                    ))}
                    <Button variant="ghost" size="sm" className="text-primary" onClick={() => { setTurmaSerieId(serie.id); setTurmaForm({ letra: '', sala: '' }); setTurmaSheetOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Turma
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* ── Edit Escola Sheet ─────────────────────────────────── */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Escola</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label>INEP</Label><Input value={editForm.inep} onChange={e => setEditForm({ ...editForm, inep: e.target.value })} /></div>
            <div className="space-y-2"><Label>Endereço</Label><Input value={editForm.endereco} onChange={e => setEditForm({ ...editForm, endereco: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={editForm.telefone} onChange={e => setEditForm({ ...editForm, telefone: e.target.value })} /></div>
            <Button onClick={saveEscola} className="w-full" disabled={!editForm.nome.trim()}>Salvar</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Configure Schedules Dialog ────────────────────────── */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Configurar Horários Padrão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sch-inicio">Hora de Início</Label>
              <Input
                id="sch-inicio"
                type="time"
                value={scheduleForm.horario_inicio}
                onChange={e => setScheduleForm({ ...scheduleForm, horario_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-tol">Tolerância para Atraso (min)</Label>
              <Input
                id="sch-tol"
                type="number"
                min={0}
                max={120}
                placeholder="Ex: 15"
                value={scheduleForm.tolerancia_min}
                onChange={e => setScheduleForm({ ...scheduleForm, tolerancia_min: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-limite">Limite Máximo de Entrada</Label>
              <Input
                id="sch-limite"
                type="time"
                value={scheduleForm.limite_max}
                onChange={e => setScheduleForm({ ...scheduleForm, limite_max: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
              <Checkbox
                id="apply-all"
                checked={applyToAll}
                onCheckedChange={(v) => handleApplyToAllChange(!!v)}
              />
              <label htmlFor="apply-all" className="text-sm cursor-pointer leading-snug">
                Aplicar a todas as séries e turmas existentes desta escola
                {!applyToAll && <span className="block text-xs text-primary">Desmarque para configurar por série →</span>}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setScheduleOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveSchedule} disabled={savingSchedule}>
              {savingSchedule ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Per-Serie Override Dialog ─────────────────────────── */}
      <Dialog open={perSerieOpen} onOpenChange={setPerSerieOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Horários por Série</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-1">
            Configure o horário máximo de entrada individualmente para cada série desta escola.
          </p>
          <div className="space-y-4">
            {serieSchedules.map((ss, idx) => (
              <div key={ss.id} className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold">{ss.nome}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Máx. entrada</Label>
                    <Input
                      type="time"
                      value={ss.horario_inicio}
                      onChange={e => setSerieSchedules(prev => prev.map((s, i) => i === idx ? { ...s, horario_inicio: e.target.value } : s))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tolerância (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={ss.tolerancia_min}
                      onChange={e => setSerieSchedules(prev => prev.map((s, i) => i === idx ? { ...s, tolerancia_min: e.target.value } : s))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setPerSerieOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={savePerSerie} disabled={savingPerSerie}>
              {savingPerSerie ? 'Salvando…' : 'Salvar por Série'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Nova Série Sheet ──────────────────────────────────── */}

      <Sheet open={serieSheetOpen} onOpenChange={setSerieSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Nova Série</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome da Série *</Label>
              <Select value={serieForm.nome} onValueChange={v => setSerieForm({ ...serieForm, nome: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a série" /></SelectTrigger>
                <SelectContent>{SERIES_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Horário de Início</Label><Input type="time" value={serieForm.horario_inicio} onChange={e => setSerieForm({ ...serieForm, horario_inicio: e.target.value })} /></div>
            <div className="space-y-2"><Label>Tolerância (min)</Label><Input type="number" min={0} value={serieForm.tolerancia_min} onChange={e => setSerieForm({ ...serieForm, tolerancia_min: e.target.value })} /></div>
            <Button onClick={saveSerie} className="w-full" disabled={!serieForm.nome}>Salvar</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Nova Turma Sheet ──────────────────────────────────── */}
      <Sheet open={turmaSheetOpen} onOpenChange={setTurmaSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Nova Turma</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Letra da Turma *</Label>
              <Select value={turmaForm.letra} onValueChange={v => setTurmaForm({ ...turmaForm, letra: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TURMA_LETRAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Número da Sala</Label><Input type="number" min={1} value={turmaForm.sala} onChange={e => setTurmaForm({ ...turmaForm, sala: e.target.value.replace(/\D/g, '') })} placeholder="Ex: 101" /></div>
            <Button onClick={saveTurma} className="w-full" disabled={!turmaForm.letra}>Salvar</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete Serie Confirmation Dialog ──────────────────── */}
      <Dialog open={deleteSerieOpen} onOpenChange={setDeleteSerieOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir Série</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a série <strong>{serieToDelete?.nome}</strong>?
            {getTurmasBySerie(serieToDelete?.id ?? '').length > 0 && (
              <span className="block mt-1 text-destructive font-medium">
                ⚠️ As {getTurmasBySerie(serieToDelete?.id ?? '').length} turma(s) desta série também serão removidas e os alunos desvinculados.
              </span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteSerieOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteSerie} disabled={deletingSerie}>
              {deletingSerie ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
