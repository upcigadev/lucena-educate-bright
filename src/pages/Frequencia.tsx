import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isWeekend, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FrequenciaRow {
  id: string;
  aluno_id: string;
  data: string;
  status: string;
  hora_entrada: string | null;
  hora_saida: string | null;
}

interface Turma { id: string; nome: string; escola_id: string; }
interface Escola { id: string; nome: string; }
interface Aluno { id: string; nome_completo: string; matricula: string; turma_id: string | null; }

const statusColors: Record<string, string> = {
  presente: 'bg-emerald-500',
  atraso: 'bg-amber-500',
  falta: 'bg-red-500',
  justificado: 'bg-yellow-400',
};

const statusLabels: Record<string, string> = {
  presente: 'Presente',
  atraso: 'Atraso',
  falta: 'Falta',
  justificado: 'Justificado',
};

export default function Frequencia() {
  const { perfil } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [frequencias, setFrequencias] = useState<FrequenciaRow[]>([]);
  const [selectedEscola, setSelectedEscola] = useState('');
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedAluno, setSelectedAluno] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadBase = async () => {
      const { data: e } = await supabase.from('escolas').select('id, nome').order('nome');
      setEscolas(e as Escola[] || []);
      const { data: t } = await supabase.from('turmas').select('id, nome, escola_id').order('nome');
      setTurmas(t as Turma[] || []);
    };
    loadBase();
  }, []);

  const filteredTurmas = useMemo(() =>
    selectedEscola ? turmas.filter(t => t.escola_id === selectedEscola) : turmas,
    [turmas, selectedEscola]
  );

  useEffect(() => {
    if (!selectedTurma) { setAlunos([]); setFrequencias([]); return; }
    const load = async () => {
      setLoading(true);
      const { data: a } = await supabase
        .from('alunos')
        .select('id, nome_completo, matricula, turma_id')
        .eq('turma_id', selectedTurma)
        .eq('ativo', true)
        .order('nome_completo');
      setAlunos(a as Aluno[] || []);

      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const alunoIds = (a || []).map((al: any) => al.id);
      if (alunoIds.length > 0) {
        const { data: f } = await supabase
          .from('frequencias')
          .select('id, aluno_id, data, status, hora_entrada, hora_saida')
          .in('aluno_id', alunoIds)
          .gte('data', start)
          .lte('data', end);
        setFrequencias(f as FrequenciaRow[] || []);
      } else {
        setFrequencias([]);
      }
      setLoading(false);
    };
    load();
  }, [selectedTurma, currentMonth]);

  const monthDays = useMemo(() => {
    const s = startOfMonth(currentMonth);
    const e = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: s, end: e });
  }, [currentMonth]);

  const weekDays = useMemo(() =>
    monthDays.filter(d => !isWeekend(d)),
    [monthDays]
  );

  const getStatus = (alunoId: string, date: string) => {
    return frequencias.find(f => f.aluno_id === alunoId && f.data === date);
  };

  const displayAlunos = selectedAluno === 'all'
    ? alunos
    : alunos.filter(a => a.id === selectedAluno);

  // Stats
  const totalRegistros = frequencias.length;
  const presentes = frequencias.filter(f => f.status === 'presente').length;
  const atrasos = frequencias.filter(f => f.status === 'atraso').length;
  const faltas = frequencias.filter(f => f.status === 'falta').length;

  return (
    <div>
      <PageHeader title="Frequência" description="Controle de presença por turma" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={selectedEscola} onValueChange={v => { setSelectedEscola(v); setSelectedTurma(''); setSelectedAluno('all'); }}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Escola" /></SelectTrigger>
          <SelectContent>
            {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedTurma} onValueChange={v => { setSelectedTurma(v); setSelectedAluno('all'); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Turma" /></SelectTrigger>
          <SelectContent>
            {filteredTurmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        {alunos.length > 0 && (
          <Select value={selectedAluno} onValueChange={setSelectedAluno}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Aluno" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os alunos</SelectItem>
              {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.nome_completo}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Stats */}
      {selectedTurma && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alunos</p>
                <p className="text-lg font-bold tabular-nums">{alunos.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Presenças</p>
                <p className="text-lg font-bold tabular-nums">{presentes}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atrasos</p>
                <p className="text-lg font-bold tabular-nums">{atrasos}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faltas</p>
                <p className="text-lg font-bold tabular-nums">{faltas}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Month navigation */}
      {selectedTurma && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
                  Hoje
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2">
              {Object.entries(statusLabels).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusColors[key]}`} />
                  {label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-muted border border-border" />
                Sem registro
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : displayAlunos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum aluno encontrado nesta turma.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground sticky left-0 bg-card min-w-[180px]">
                      Aluno
                    </th>
                    {weekDays.map(day => (
                      <th key={day.toISOString()} className="text-center py-2 px-1 font-medium text-muted-foreground min-w-[32px]">
                        <div className="text-[10px] uppercase">{format(day, 'EEE', { locale: ptBR }).substring(0, 3)}</div>
                        <div className="text-xs">{format(day, 'd')}</div>
                      </th>
                    ))}
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[50px]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {displayAlunos.map(aluno => {
                    const alunoFreqs = frequencias.filter(f => f.aluno_id === aluno.id);
                    const presentCount = alunoFreqs.filter(f => f.status === 'presente' || f.status === 'atraso' || f.status === 'justificado').length;
                    const pct = weekDays.length > 0 ? Math.round((presentCount / weekDays.length) * 100) : 0;

                    return (
                      <tr key={aluno.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-2 sticky left-0 bg-card">
                          <div className="font-medium truncate max-w-[180px]">{aluno.nome_completo}</div>
                          <div className="text-[10px] text-muted-foreground">{aluno.matricula}</div>
                        </td>
                        {weekDays.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const freq = getStatus(aluno.id, dateStr);
                          const today = new Date();
                          const isFuture = day > today;
                          return (
                            <td key={dateStr} className="text-center py-2 px-1">
                              {isFuture ? (
                                <span className="h-5 w-5 inline-block rounded-full bg-muted/50" />
                              ) : freq ? (
                                <span
                                  className={`h-5 w-5 inline-block rounded-full ${statusColors[freq.status]} transition-transform hover:scale-125`}
                                  title={`${statusLabels[freq.status]}${freq.hora_entrada ? ` - ${format(new Date(freq.hora_entrada), 'HH:mm')}` : ''}`}
                                />
                              ) : (
                                <span className="h-5 w-5 inline-block rounded-full bg-muted border border-border" />
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center py-2 px-2">
                          <Badge variant={pct >= 75 ? 'default' : 'destructive'} className="text-xs tabular-nums">
                            {pct}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedTurma && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Selecione uma escola e turma para visualizar a frequência.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
