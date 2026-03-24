import { useEffect, useState } from 'react';
import { db } from '@/lib/mock-db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, ChevronDown, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

const SERIES_OPTIONS = [
  'Creche', 'Pré-Escola', '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano',
  '6º Ano', '7º Ano', '8º Ano', '9º Ano',
  '1ª Série - Ensino Médio', '2ª Série - Ensino Médio', '3ª Série - Ensino Médio',
];

const TURMA_LETRAS = [
  { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
  { value: 'D', label: 'D' }, { value: 'E', label: 'E' }, { value: 'U', label: 'U - Única' },
];

interface Serie { id: string; nome: string; escola_id: string; horario_inicio: string | null; tolerancia_min: number | null; limite_max: string | null; }
interface Turma { id: string; nome: string; serie_id: string; escola_id: string; sala: string | null; horario_inicio: string | null; tolerancia_min: number | null; limite_max: string | null; }

export function SeriesTurmasTab({ escolaId }: { escolaId: string }) {
  const [series, setSeries] = useState<Serie[]>([]);
  const [turmasBySerie, setTurmasBySerie] = useState<Record<string, Turma[]>>({});
  const [showSerieForm, setShowSerieForm] = useState(false);
  const [showTurmaForm, setShowTurmaForm] = useState<string | null>(null);
  const [serieForm, setSerieForm] = useState({ nome: '', horario_inicio: '07:00', tolerancia_min: '15', limite_max: '07:30' });
  const [turmaForm, setTurmaForm] = useState({ letra: '', sala: '', horario_inicio: '', tolerancia_min: '', limite_max: '' });

  const load = () => {
    const { data: s } = db.series.listByEscola(escolaId);
    const seriesData = (s as Serie[]) || [];
    setSeries(seriesData);

    const { data: t } = db.turmas.listByEscola(escolaId);
    const turmasData = (t as Turma[]) || [];
    const grouped: Record<string, Turma[]> = {};
    turmasData.forEach(turma => {
      if (!grouped[turma.serie_id]) grouped[turma.serie_id] = [];
      grouped[turma.serie_id].push(turma);
    });
    setTurmasBySerie(grouped);
  };

  useEffect(() => { load(); }, [escolaId]);

  const availableSeriesOptions = SERIES_OPTIONS.filter(opt => !series.some(s => s.nome === opt));

  const saveSerie = () => {
    if (!serieForm.nome) return;
    db.series.insert({ nome: serieForm.nome, escola_id: escolaId, horario_inicio: serieForm.horario_inicio || '07:00', tolerancia_min: parseInt(serieForm.tolerancia_min) || 15, limite_max: serieForm.limite_max || '07:30' });
    toast.success('Série criada.');
    setShowSerieForm(false);
    setSerieForm({ nome: '', horario_inicio: '07:00', tolerancia_min: '15', limite_max: '07:30' });
    load();
  };

  const saveTurma = (serieId: string) => {
    if (!turmaForm.letra) return;
    const serie = series.find(s => s.id === serieId);
    const turmaName = serie ? `${serie.nome} ${turmaForm.letra}` : turmaForm.letra;
    const existing = turmasBySerie[serieId] || [];
    if (existing.some(t => t.nome === turmaName)) { toast.error(`Turma "${turmaName}" já existe.`); return; }
    const salaNum = turmaForm.sala ? parseInt(turmaForm.sala) : null;
    if (turmaForm.sala && (isNaN(salaNum!) || salaNum! <= 0)) { toast.error('Número da sala deve ser positivo.'); return; }
    db.turmas.insert({ nome: turmaName, serie_id: serieId, escola_id: escolaId, sala: salaNum ? String(salaNum) : null, horario_inicio: turmaForm.horario_inicio || null, tolerancia_min: turmaForm.tolerancia_min ? parseInt(turmaForm.tolerancia_min) : null, limite_max: turmaForm.limite_max || null });
    toast.success('Turma criada.');
    setShowTurmaForm(null);
    setTurmaForm({ letra: '', sala: '', horario_inicio: '', tolerancia_min: '', limite_max: '' });
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Séries</h3>
        <Button size="sm" variant="outline" onClick={() => setShowSerieForm(!showSerieForm)} className="gap-1" disabled={availableSeriesOptions.length === 0}>
          <Plus className="h-3.5 w-3.5" /> Série
        </Button>
      </div>

      {showSerieForm && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Série *</Label>
              <Select value={serieForm.nome} onValueChange={v => setSerieForm({ ...serieForm, nome: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione a série" /></SelectTrigger>
                <SelectContent>{availableSeriesOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Horário Início</Label><Input type="time" value={serieForm.horario_inicio} onChange={e => setSerieForm({ ...serieForm, horario_inicio: e.target.value })} className="h-8 text-sm" /></div>
            <div className="space-y-1"><Label className="text-xs">Tolerância (min)</Label><Input type="number" value={serieForm.tolerancia_min} onChange={e => setSerieForm({ ...serieForm, tolerancia_min: e.target.value })} className="h-8 text-sm" /></div>
            <div className="space-y-1"><Label className="text-xs">Limite Máximo</Label><Input type="time" value={serieForm.limite_max} onChange={e => setSerieForm({ ...serieForm, limite_max: e.target.value })} className="h-8 text-sm" /></div>
          </div>
          <Button size="sm" onClick={saveSerie} disabled={!serieForm.nome}>Salvar Série</Button>
        </div>
      )}

      {series.map(serie => (
        <Collapsible key={serie.id} defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted/30">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
            {serie.nome}
            <Badge variant="secondary" className="ml-auto text-xs">{(turmasBySerie[serie.id] || []).length} turma(s)</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-4 pt-2 space-y-2">
            {(turmasBySerie[serie.id] || []).map(turma => {
              const hasOwnSchedule = turma.horario_inicio && turma.horario_inicio !== serie.horario_inicio;
              return (
                <div key={turma.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{turma.nome}</span>
                    {turma.sala && <span className="text-xs text-muted-foreground">Sala: {turma.sala}</span>}
                    {hasOwnSchedule && <Badge variant="outline" className="gap-1 text-xs text-warning border-warning/30"><AlertTriangle className="h-3 w-3" /> Horário próprio</Badge>}
                  </div>
                </div>
              );
            })}
            <Button size="sm" variant="ghost" onClick={() => { setShowTurmaForm(showTurmaForm === serie.id ? null : serie.id); setTurmaForm({ letra: '', sala: '', horario_inicio: '', tolerancia_min: '', limite_max: '' }); }} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> Turma
            </Button>
            {showTurmaForm === serie.id && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Turma *</Label>
                    <Select value={turmaForm.letra} onValueChange={v => setTurmaForm({ ...turmaForm, letra: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Letra" /></SelectTrigger>
                      <SelectContent>{TURMA_LETRAS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Nº da Sala</Label><Input type="number" min="1" value={turmaForm.sala} onChange={e => setTurmaForm({ ...turmaForm, sala: e.target.value.replace(/\D/g, '') })} className="h-8 text-sm" placeholder="Ex: 101" /></div>
                  <div className="space-y-1"><Label className="text-xs">Horário Início (opcional)</Label><Input type="time" value={turmaForm.horario_inicio} onChange={e => setTurmaForm({ ...turmaForm, horario_inicio: e.target.value })} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Tolerância (min)</Label><Input type="number" value={turmaForm.tolerancia_min} onChange={e => setTurmaForm({ ...turmaForm, tolerancia_min: e.target.value })} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Limite Máximo</Label><Input type="time" value={turmaForm.limite_max} onChange={e => setTurmaForm({ ...turmaForm, limite_max: e.target.value })} className="h-8 text-sm" /></div>
                </div>
                <Button size="sm" onClick={() => saveTurma(serie.id)} disabled={!turmaForm.letra}>Salvar Turma</Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
