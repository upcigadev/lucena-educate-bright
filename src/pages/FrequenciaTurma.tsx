import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { db } from '@/lib/mock-db';
import { io } from 'socket.io-client';

type StatusType = 'presente' | 'atrasado' | 'falta' | 'justificada';

interface AlunoRow {
  id: string;
  nome_completo: string;
  matricula: string;
  idface_user_id: string | null;
  turma_id: string | null;
  escola_id: string;
}

interface FreqRecord {
  id: string;
  aluno_id: string;
  hora_entrada: string | null;
  status: string;
}

interface MergedRow {
  aluno: AlunoRow;
  freq: FreqRecord | null; // null = inferred absence
}

interface Turma {
  id: string;
  nome: string;
  escola_id: string;
  horario_inicio: string | null;
  tolerancia_min: number | null;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  presente: {
    label: 'Presente',
    className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20',
  },
  atrasado: {
    label: 'Atrasado',
    className: 'bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/20',
  },
  falta: {
    label: 'Faltou',
    className: 'bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/20',
  },
  justificada: {
    label: 'Falta Justificada',
    className: 'bg-blue-500/15 text-blue-700 border-blue-200 hover:bg-blue-500/20',
  },
};

const avatarColors: string[] = [
  'bg-primary/15 text-primary',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function toInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * `horario_inicio` is the maximum arrival time to still be marked as Presente.
 * Arriving AFTER `horario_inicio` → Atrasado.
 * `tolerancia_min` is already factored into `horario_inicio` by the secretary
 * when they configure it (e.g. 07:00 start + 15 min grace = 07:15 horario_inicio).
 */
function computeStatus(
  horaEntrada: string, // e.g. "07:35"
  horarioInicio: string | null  // max arrival time for Presente
): 'presente' | 'atrasado' {
  if (!horarioInicio) return 'presente';
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const entrada = toMins(horaEntrada.slice(0, 5));
  const deadline = toMins(horarioInicio.slice(0, 5));
  return entrada <= deadline ? 'presente' : 'atrasado';
}

export default function FrequenciaTurma() {
  const [date, setDate] = useState<Date>(new Date());
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState<string>('');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Load all turmas once
  useEffect(() => {
    db.turmas.listAll().then(({ data }) => {
      const list = (data as Turma[]) || [];
      setTurmas(list);
      if (list.length > 0 && !turmaId) {
        setTurmaId(list[0].id);
      }
    });
  }, []);

  const loadData = useCallback(async (tid: string, d: Date) => {
    if (!tid) return;
    setLoading(true);
    try {
      const dateStr = format(d, 'yyyy-MM-dd');

      // 1. All active students in this turma
      const { data: alunosData } = await db.alunos.listByTurma(tid);
      const alunos = (alunosData as AlunoRow[]) || [];

      // 2. Frequency records for this turma+date
      const { data: freqData } = await db.frequencias.listByTurmaAndDate(tid, dateStr);
      const freqs = (freqData as FreqRecord[]) || [];
      const freqByAluno = new Map<string, FreqRecord>(freqs.map((f) => [f.aluno_id, f]));

      // 3. Fetch turma schedule to recompute status on-the-fly
      const { data: turmaData } = await db.turmas.getById(tid);
      const scheduleInicio = (turmaData as Turma | null)?.horario_inicio ?? null;

      // 4. Merge: everyone in the turma appears; recompute + heal stale DB records
      const corrections: Promise<any>[] = [];
      const merged: MergedRow[] = alunos.map((aluno) => {
        const freq = freqByAluno.get(aluno.id) ?? null;
        if (freq?.hora_entrada && scheduleInicio) {
          const recomputed = computeStatus(freq.hora_entrada, scheduleInicio);
          if (freq.status !== recomputed) {
            corrections.push(db.frequencias.updateStatus(freq.id, recomputed));
            freq.status = recomputed; // update in-memory immediately
          }
        }
        return { aluno, freq };
      });
      if (corrections.length > 0) Promise.all(corrections).catch(console.warn);

      setRows(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when turma or date changes
  useEffect(() => {
    const t = turmas.find((t) => t.id === turmaId) || null;
    setTurma(t);
    if (turmaId) loadData(turmaId, date);
  }, [turmaId, date, turmas]);

  // Live WebSocket: update table when a new access log arrives
  useEffect(() => {
    const socket = io('http://localhost:3000', { reconnectionAttempts: 5, reconnectionDelay: 2000 });

    socket.on('device:accessLog', async (payload: any) => {
      if (payload?.type !== 'log') return;
      const valuesArray: any[] = Array.isArray(payload.data) ? payload.data : [];

      for (const entry of valuesArray) {
        const rawUserId = String(entry?.user_id ?? entry?.userId ?? '').trim();
        const rawTime: string = entry?.time ?? entry?.timestamp ?? '';
        if (!rawUserId || !rawTime) continue;

        // Extract HH:MM from timestamp (may be "2026-03-27 07:05:00" or epoch)
        let horaEntrada: string | null = null;
        const timeMatch = String(rawTime).match(/(\d{2}:\d{2})/);
        if (timeMatch) horaEntrada = timeMatch[1];
        if (!horaEntrada) continue;

        const dateStr = format(new Date(), 'yyyy-MM-dd');

        // Find aluno by matricula (which is the user_id in iDFace)
        const { data: alunoData } = await db.alunos.getByMatricula(rawUserId);
        const aluno = alunoData as AlunoRow | null;
        if (!aluno || aluno.turma_id !== turmaId) continue;

        // Get turma schedule for status computation
        const { data: turmaData } = await db.turmas.getById(aluno.turma_id!);
        const turmaRow = turmaData as Turma | null;

        const status = computeStatus(
          horaEntrada,
          turmaRow?.horario_inicio ?? null
        );

        // Insert frequency record
        await db.frequencias.insert({
          aluno_id: aluno.id,
          turma_id: aluno.turma_id ?? undefined,
          data: dateStr,
          hora_entrada: horaEntrada,
          status,
          dispositivo_id: String(entry?.device_id ?? entry?.deviceId ?? 'unknown'),
        });

        // Refresh table if same date
        if (format(date, 'yyyy-MM-dd') === dateStr) {
          loadData(turmaId, date);
        }
      }
    });

    return () => { socket.disconnect(); };
  }, [turmaId, date, loadData]);

  const counts = {
    presentes: rows.filter((r) => r.freq?.status === 'presente').length,
    atrasados: rows.filter((r) => r.freq?.status === 'atrasado').length,
    faltas: rows.filter((r) => !r.freq || r.freq.status === 'falta').length,
    justificadas: rows.filter((r) => r.freq?.status === 'justificada').length,
  };

  return (
    <div>
      <PageHeader title="Frequência da Turma" description="Chamada diária detalhada" />

      {/* Header: turma selector + date picker */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={turmaId} onValueChange={setTurmaId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione a turma…" />
            </SelectTrigger>
            <SelectContent>
              {turmas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {turma && (
            <>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{rows.length} alunos</span>
              {turma.horario_inicio && (
                <>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    Início: {turma.horario_inicio} | Tolerância: {turma.tolerancia_min ?? 15} min
                  </span>
                </>
              )}
            </>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn('w-[220px] justify-start text-left font-normal', !date && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Selecione a data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <span className="text-emerald-600 font-bold text-sm">{counts.presentes}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Presentes</p>
              <p className="text-lg font-bold tabular-nums">
                {rows.length > 0 ? Math.round((counts.presentes / rows.length) * 100) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <span className="text-amber-600 font-bold text-sm">{counts.atrasados}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atrasados</p>
              <p className="text-lg font-bold tabular-nums">{counts.atrasados}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <span className="text-destructive font-bold text-sm">{counts.faltas}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faltas</p>
              <p className="text-lg font-bold tabular-nums">{counts.faltas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">{counts.justificadas}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Justificadas</p>
              <p className="text-lg font-bold tabular-nums">{counts.justificadas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chamada do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {turmaId ? 'Nenhum aluno nesta turma.' : 'Selecione uma turma para ver a chamada.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Foto</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">Matrícula</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Hora de Entrada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ aluno, freq }, idx) => {
                  const statusKey = (freq?.status as StatusType) ?? 'falta';
                  const cfg = statusConfig[statusKey] ?? statusConfig.falta;
                  const colorClass = avatarColors[idx % avatarColors.length];
                  const iniciais = toInitials(aluno.nome_completo);
                  const proxyUrl = aluno.idface_user_id
                    ? `http://localhost:3000/api/device/photo/${aluno.idface_user_id}`
                    : null;

                  return (
                    <TableRow key={aluno.id}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={aluno.idface_user_id ? `http://localhost:3000/api/device/photo/${aluno.idface_user_id}` : ''}
                            className="object-cover"
                          />
                          <AvatarFallback className={cn('text-xs font-semibold', colorClass)}>
                            {iniciais}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{aluno.nome_completo}</span>
                        <span className="block text-xs text-muted-foreground sm:hidden">{aluno.matricula}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm tabular-nums">
                        {aluno.matricula}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs font-medium', cfg.className)}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {freq?.hora_entrada ? (
                          <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {freq.hora_entrada}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
