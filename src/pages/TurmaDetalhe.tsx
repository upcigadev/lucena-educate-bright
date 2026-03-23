import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, CalendarIcon, Clock, GraduationCap, Users, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusType = 'presente' | 'atrasado' | 'falta' | 'justificada';

interface MockAluno {
  id: string;
  nome: string;
  matricula: string;
  iniciais: string;
  status: StatusType;
  horaEntrada: string | null;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  presente: { label: 'Presente', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20' },
  atrasado: { label: 'Atrasado', className: 'bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/20' },
  falta: { label: 'Falta', className: 'bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/20' },
  justificada: { label: 'Falta Justificada', className: 'bg-blue-500/15 text-blue-700 border-blue-200 hover:bg-blue-500/20' },
};

const MOCK_ALUNOS: MockAluno[] = [
  { id: '1', nome: 'Ana Clara Silva', matricula: '2025001', iniciais: 'AC', status: 'presente', horaEntrada: '07:05' },
  { id: '2', nome: 'Bruno Oliveira Santos', matricula: '2025002', iniciais: 'BO', status: 'presente', horaEntrada: '07:12' },
  { id: '3', nome: 'Carolina Mendes', matricula: '2025003', iniciais: 'CM', status: 'atrasado', horaEntrada: '07:38' },
  { id: '4', nome: 'Daniel Ferreira Costa', matricula: '2025004', iniciais: 'DF', status: 'presente', horaEntrada: '07:08' },
  { id: '5', nome: 'Eduarda Lima', matricula: '2025005', iniciais: 'EL', status: 'falta', horaEntrada: null },
  { id: '6', nome: 'Felipe Rodrigues', matricula: '2025006', iniciais: 'FR', status: 'presente', horaEntrada: '07:15' },
  { id: '7', nome: 'Gabriela Souza Alves', matricula: '2025007', iniciais: 'GS', status: 'justificada', horaEntrada: null },
  { id: '8', nome: 'Henrique Barbosa', matricula: '2025008', iniciais: 'HB', status: 'presente', horaEntrada: '07:03' },
  { id: '9', nome: 'Isabela Nunes Pereira', matricula: '2025009', iniciais: 'IN', status: 'atrasado', horaEntrada: '07:42' },
  { id: '10', nome: 'João Pedro Araújo', matricula: '2025010', iniciais: 'JP', status: 'presente', horaEntrada: '07:10' },
  { id: '11', nome: 'Larissa Campos', matricula: '2025011', iniciais: 'LC', status: 'falta', horaEntrada: null },
  { id: '12', nome: 'Mateus Vieira', matricula: '2025012', iniciais: 'MV', status: 'presente', horaEntrada: '07:07' },
];

const avatarColors = [
  'bg-primary/15 text-primary', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
];

export default function TurmaDetalhe() {
  const { escolaId, turmaId } = useParams();
  const [date, setDate] = useState<Date>(new Date());
  const [turma, setTurma] = useState<{ nome: string; sala: string | null } | null>(null);
  const [escola, setEscola] = useState<{ nome: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!turmaId || !escolaId) return;
    Promise.all([
      supabase.from('turmas').select('nome, sala').eq('id', turmaId).single(),
      supabase.from('escolas').select('nome').eq('id', escolaId).single(),
    ]).then(([{ data: t }, { data: e }]) => {
      setTurma(t as any);
      setEscola(e as any);
      setLoading(false);
    });
  }, [turmaId, escolaId]);

  const counts = {
    presentes: MOCK_ALUNOS.filter(a => a.status === 'presente').length,
    atrasados: MOCK_ALUNOS.filter(a => a.status === 'atrasado').length,
    faltas: MOCK_ALUNOS.filter(a => a.status === 'falta').length,
    justificadas: MOCK_ALUNOS.filter(a => a.status === 'justificada').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const turmaName = turma?.nome || 'Turma';
  const escolaName = escola?.nome || 'Escola';

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
          <Link to={`/escolas/${escolaId}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{turmaName}</h1>
            <p className="text-sm text-muted-foreground">{turma?.sala ? `Sala ${turma.sala}` : escolaName}</p>
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-[220px] justify-start text-left font-normal')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Professores</p>
              <p className="text-base font-semibold text-card-foreground">Profª. Claudia Reis</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Alunos</p>
              <p className="text-2xl font-bold tabular-nums text-card-foreground">{MOCK_ALUNOS.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Frequência do Dia</p>
              <p className="text-2xl font-bold tabular-nums text-card-foreground">
                {Math.round(((counts.presentes + counts.atrasados) / MOCK_ALUNOS.length) * 100)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <span className="text-emerald-600 font-bold text-sm">{counts.presentes}</span>
          </div>
          <div><p className="text-xs text-muted-foreground">Presentes</p><p className="text-lg font-bold tabular-nums">{Math.round((counts.presentes / MOCK_ALUNOS.length) * 100)}%</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <span className="text-amber-600 font-bold text-sm">{counts.atrasados}</span>
          </div>
          <div><p className="text-xs text-muted-foreground">Atrasados</p><p className="text-lg font-bold tabular-nums">{counts.atrasados}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive font-bold text-sm">{counts.faltas}</span>
          </div>
          <div><p className="text-xs text-muted-foreground">Faltas</p><p className="text-lg font-bold tabular-nums">{counts.faltas}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <span className="text-blue-600 font-bold text-sm">{counts.justificadas}</span>
          </div>
          <div><p className="text-xs text-muted-foreground">Justificadas</p><p className="text-lg font-bold tabular-nums">{counts.justificadas}</p></div>
        </CardContent></Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chamada do Dia</CardTitle>
        </CardHeader>
        <CardContent>
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
              {MOCK_ALUNOS.map((aluno, idx) => {
                const cfg = statusConfig[aluno.status];
                const colorClass = avatarColors[idx % avatarColors.length];
                return (
                  <TableRow key={aluno.id}>
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={cn('text-xs font-semibold', colorClass)}>{aluno.iniciais}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{aluno.nome}</span>
                      <span className="block text-xs text-muted-foreground sm:hidden">{aluno.matricula}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm tabular-nums">{aluno.matricula}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs font-medium', cfg.className)}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {aluno.horaEntrada ? (
                        <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />{aluno.horaEntrada}
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
        </CardContent>
      </Card>
    </div>
  );
}
