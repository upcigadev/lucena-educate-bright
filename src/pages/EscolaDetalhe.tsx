import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '@/lib/mock-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, TrendingUp, UserCog, BookOpen, ArrowLeft, ArrowRight, Plus, Pencil, School } from 'lucide-react';
import { toast } from 'sonner';

const SERIES_OPTIONS = [
  'Creche', 'Pré-Escola', '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano',
  '6º Ano', '7º Ano', '8º Ano', '9º Ano',
  '1ª Série - Ensino Médio', '2ª Série - Ensino Médio', '3ª Série - Ensino Médio',
];

const TURMA_LETRAS = ['A', 'B', 'C', 'D', 'E', 'U - Única'];

interface Serie { id: string; nome: string; horario_inicio: string | null; tolerancia_min: number | null; }
interface Turma { id: string; nome: string; sala: string | null; serie_id: string; }
interface Escola { id: string; nome: string; inep: string | null; endereco: string | null; telefone: string | null; }

export default function EscolaDetalhe() {
  const { escolaId } = useParams();
  const navigate = useNavigate();
  const [escola, setEscola] = useState<Escola | null>(null);
  const [series, setSeries] = useState<Serie[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editForm, setEditForm] = useState({ nome: '', inep: '', endereco: '', telefone: '' });
  const [serieSheetOpen, setSerieSheetOpen] = useState(false);
  const [serieForm, setSerieForm] = useState({ nome: '', horario_inicio: '', tolerancia_min: '' });
  const [turmaSheetOpen, setTurmaSheetOpen] = useState(false);
  const [turmaSerieId, setTurmaSerieId] = useState('');
  const [turmaForm, setTurmaForm] = useState({ letra: '', sala: '' });

  const load = () => {
    if (!escolaId) return;
    setLoading(true);
    const { data: escolaData } = db.escolas.getById(escolaId);
    const { data: seriesData } = db.series.listByEscola(escolaId);
    const { data: turmasData } = db.turmas.listByEscola(escolaId);
    setEscola(escolaData as Escola | null);
    setSeries((seriesData as Serie[]) || []);
    setTurmas((turmasData as Turma[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [escolaId]);

  const openEditEscola = () => {
    if (!escola) return;
    setEditForm({ nome: escola.nome, inep: escola.inep || '', endereco: escola.endereco || '', telefone: escola.telefone || '' });
    setEditSheetOpen(true);
  };

  const saveEscola = () => {
    if (!escolaId || !editForm.nome.trim()) return;
    db.escolas.update(escolaId, { nome: editForm.nome, inep: editForm.inep || null, endereco: editForm.endereco || null, telefone: editForm.telefone || null });
    toast.success('Escola atualizada.');
    setEditSheetOpen(false);
    load();
  };

  const saveSerie = () => {
    if (!escolaId || !serieForm.nome) return;
    db.series.insert({ escola_id: escolaId, nome: serieForm.nome, horario_inicio: serieForm.horario_inicio || null, tolerancia_min: serieForm.tolerancia_min ? Number(serieForm.tolerancia_min) : null });
    toast.success('Série criada.');
    setSerieSheetOpen(false);
    setSerieForm({ nome: '', horario_inicio: '', tolerancia_min: '' });
    load();
  };

  const saveTurma = () => {
    if (!escolaId || !turmaSerieId || !turmaForm.letra) return;
    const serie = series.find(s => s.id === turmaSerieId);
    const nomeCompleto = serie ? `${serie.nome} ${turmaForm.letra}` : turmaForm.letra;
    db.turmas.insert({ escola_id: escolaId, serie_id: turmaSerieId, nome: nomeCompleto, sala: turmaForm.sala || null });
    toast.success('Turma criada.');
    setTurmaSheetOpen(false);
    setTurmaForm({ letra: '', sala: '' });
    load();
  };

  const getTurmasBySerie = (serieId: string) => turmas.filter(t => t.serie_id === serieId);

  const totalAlunos = 347;
  const freqGeral = 91.2;
  const diretorNome = 'Maria Helena Costa';

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
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openEditEscola}><Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar Escola</Button>
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
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs font-semibold">{serie.nome}</Badge>
                    <span className="text-sm text-muted-foreground">{serieTurmas.length} turma{serieTurmas.length !== 1 ? 's' : ''}</span>
                    {serie.horario_inicio && <span className="text-xs text-muted-foreground">• Início: {serie.horario_inicio}</span>}
                  </div>
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
    </div>
  );
}
