import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  School, Users, GraduationCap, UserCog,
  TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Clock, FileText, ArrowRight, Bell,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EscolaStats {
  id: string;
  nome: string;
  totalAlunos: number;
  presentes: number;
  freqPct: number;
}

interface AlunoRecente {
  id: string;
  nome: string;
  matricula: string;
  avatarUrl: string | null;
  horaEntrada: string | null;
  status: string;
  escolaNome: string;
}

function StatCard({ title, value, icon: Icon, color = 'primary', suffix = '' }: {
  title: string; value: number | string; icon: React.ElementType;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  suffix?: string;
}) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    danger:  'bg-destructive/10 text-destructive',
    info:    'bg-sky-500/10 text-sky-600',
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums text-card-foreground">{value}{suffix}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface NotifRow {
  id: string;
  titulo: string;
  mensagem: string;
  remetente_nome: string;
  data_envio: string;
  lida: number;
}

export default function Dashboard() {
  const { perfil } = useAuthStore();
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), "dd 'de' MMMM", { locale: ptBR });

  const [stats, setStats] = useState<any>({ escolas: 0, alunos: 0, professores: 0, diretores: 0, turmas: 0 });
  const [freqHoje, setFreqHoje] = useState({ presentes: 0, atrasados: 0, faltas: 0, total: 0 });
  const [justPendentes, setJustPendentes] = useState(0);
  const [escolasStats, setEscolasStats] = useState<EscolaStats[]>([]);
  const [recentAccess, setRecentAccess] = useState<AlunoRecente[]>([]);
  const [loading, setLoading] = useState(true);
  // RESPONSAVEL-specific
  interface FilhoDash { id: string; nome: string; turma: string; escola: string; avatarUrl: string | null; freqPct: number; statusHoje: string | null; }
  const [meusFilhos, setMeusFilhos] = useState<FilhoDash[]>([]);
  // PROFESSOR-specific
  const [notificacoesRecentes, setNotificacoesRecentes] = useState<NotifRow[]>([]);
  const [turmasFreqHoje, setTurmasFreqHoje] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const state = useAuthStore.getState();
        const currentPerfil = state.perfil;
        const currentEscola = state.escolaAtiva;

        // ── RESPONSAVEL: only load their own children ─────────────────
        if (currentPerfil?.papel === 'RESPONSAVEL') {
          const { data: filhosData } = await db.alunos.listByResponsavelUsuarioId(currentPerfil.id);
          const filhos = (filhosData || []) as any[];
          const filhosDash: FilhoDash[] = [];
          let totalPresentes = 0, totalAtrasados = 0;
          for (const f of filhos) {
            const { data: pct } = await db.frequencias.monthlyPct(f.id);
            const { data: todayFreqs } = await db.frequencias.listByAlunos([f.id], today, today);
            const todayEntry = (todayFreqs as any[])?.[0] ?? null;
            if (todayEntry?.status === 'presente') totalPresentes++;
            else if (todayEntry?.status === 'atrasado') totalAtrasados++;
            filhosDash.push({
              id: f.id,
              nome: f.nome_completo,
              turma: f.turma_nome,
              escola: f.escola_nome,
              avatarUrl: f.avatar_url ?? null,
              freqPct: (pct as number) ?? 0,
              statusHoje: todayEntry?.status ?? null,
            });
          }
          setMeusFilhos(filhosDash);
          setFreqHoje({ presentes: totalPresentes, atrasados: totalAtrasados, faltas: filhos.length - totalPresentes - totalAtrasados, total: filhos.length });
          setStats({ alunos: filhos.length });
          const { data: justs } = await db.justificativas.list();
          setJustPendentes(((justs || []) as any[]).filter(j => j.status === 'pendente').length);
          setLoading(false);
          return;
        }

        // ── PROFESSOR: dedicated load ──────────────────────────────
        if (currentPerfil?.papel === 'PROFESSOR') {
          const { data: counts } = await db.stats.countsByProfessor(currentPerfil.id);
          if (counts) setStats(counts as any);

          // Frequência das turmas hoje
          const { data: turmasFreq } = await db.frequencias.frequenciaHojeByProfessor(currentPerfil.id, today);
          const tfList = (turmasFreq || []) as any[];
          setTurmasFreqHoje(tfList);

          let tp = 0, ta = 0, totalA = 0;
          for (const t of tfList) {
            const presentes = t.presentes || 0;
            const regTotal = t.frequencias_registradas || 0;
            tp += presentes;
            ta += Math.max(0, regTotal - presentes);
            totalA += t.total_alunos || 0;
          }
          setFreqHoje({ presentes: tp, atrasados: ta, faltas: Math.max(0, totalA - tp - ta), total: totalA });

          // Notificações recentes recebidas
          const { data: notifs } = await db.notificacoes.listByDestinatario(currentPerfil.id);
          setNotificacoesRecentes(((notifs || []) as NotifRow[]).slice(0, 5));

          setLoading(false);
          return;
        }

        // ── Other roles ────────────────────────────────────────────────
        if (currentPerfil?.papel === 'DIRETOR' && currentEscola) {
          const { data: counts } = await db.stats.countsByEscola(currentEscola);
          if (counts) setStats(counts as any);
        } else {
          // Global counts
          const { data: counts } = await db.stats.counts();
          if (counts) setStats(counts as any);
        }

        // Escolas list
        const { data: escolas } = await db.escolas.list();
        let escolaList = (escolas || []) as any[];

        if (currentPerfil?.papel === 'DIRETOR' && currentEscola) {
          escolaList = escolaList.filter(e => e.id === currentEscola);
        } else if (currentPerfil?.papel === 'PROFESSOR') {
          const { data: pescs } = await db.professorEscolas.listByProfessor(currentPerfil.id);
          const allowedEsc = ((pescs || []) as any[]).map(pe => pe.escola_id);
          escolaList = escolaList.filter(e => allowedEsc.includes(e.id));
        }

        // Per-escola frequency stats for today
        const escolaStatsArr: EscolaStats[] = [];
        let totalPresentes = 0, totalAtrasados = 0, totalAlunos = 0;

        if (currentPerfil?.papel === 'PROFESSOR') {
          const { data: turmasFreq } = await db.frequencias.frequenciaHojeByProfessor(currentPerfil.id, today);
          for (const t of (turmasFreq || []) as any[]) {
            const presentes = t.presentes || 0;
            const total = t.total_alunos || 0;
            const freqReg = t.frequencias_registradas || 0;
            
            totalPresentes += presentes;
            totalAtrasados += (freqReg - presentes > 0 ? freqReg - presentes : 0);
            totalAlunos += total;
            
            escolaStatsArr.push({
              id: t.turma_id,
              nome: t.turma_nome,
              totalAlunos: total,
              presentes,
              freqPct: total > 0 ? Math.round((presentes / total) * 100) : 0,
            });
          }
        } else {
          for (const escola of escolaList) {
            const { data: freqCount } = await db.frequencias.countByEscola(escola.id, today);
            const { data: alunoCount } = await db.alunos.countByEscola(escola.id);
            const fc = freqCount as any || { total: 0, presentes: 0, atrasados: 0 };
            const total = Number(alunoCount) || 0;
            const presentes  = Number(fc.presentes)  || 0;
            const atrasados  = Number(fc.atrasados)  || 0;
            totalPresentes  += presentes;
            totalAtrasados  += atrasados;
            totalAlunos     += total;
            escolaStatsArr.push({
              id: escola.id,
              nome: escola.nome,
              totalAlunos: total,
              presentes: presentes + atrasados, // presença inclui atrasados para a barra
              freqPct: total > 0 ? Math.round(((presentes + atrasados) / total) * 100) : 0,
            });
          }
        }

        setEscolasStats(escolaStatsArr.sort((a, b) => b.freqPct - a.freqPct));
        setFreqHoje({
          presentes: totalPresentes,
          atrasados: totalAtrasados,
          faltas: Math.max(0, totalAlunos - totalPresentes - totalAtrasados),
          total: totalAlunos,
        });

        // Pending justificativas
        const { data: justs } = await db.justificativas.list();
        const pendentes = ((justs || []) as any[]).filter(j => j.status === 'pendente').length;
        setJustPendentes(pendentes);

        // Recent access today (from frequencias)
        const { data: freqAll } = await db.frequencias.listAll();
        const todayFreqs = ((freqAll || []) as any[])
          .filter(f => f.data === today && f.hora_entrada)
          .sort((a, b) => (b.hora_entrada || '').localeCompare(a.hora_entrada || ''))
          .slice(0, 6);

        if (todayFreqs.length > 0) {
          let alunosData;
          if (currentPerfil?.papel === 'DIRETOR' && currentEscola) {
             const res = await db.alunos.listByEscola(currentEscola);
             alunosData = res.data;
          } else if (currentPerfil?.papel === 'PROFESSOR') {
             const res = await db.alunos.listByProfessorUsuarioId(currentPerfil.id);
             alunosData = res.data;
          } else {
             const res = await db.alunos.list();
             alunosData = res.data;
          }
          const allAlunos = alunosData || [];
          const allowedAlunosIds = new Set((allAlunos as any[]).map(a => a.id));

          const alunosMap = new Map(((allAlunos || []) as any[]).map(a => [a.id, a]));
          const recentCards: AlunoRecente[] = todayFreqs
            .filter(f => allowedAlunosIds.has(f.aluno_id))
            .map(f => {
              const a = alunosMap.get(f.aluno_id) as any;
              return {
                id: f.id,
                nome: a?.nome_completo ?? '—',
                matricula: a?.matricula ?? '—',
                avatarUrl: a?.avatar_url ?? null,
                horaEntrada: f.hora_entrada,
                status: f.status,
                escolaNome: a?.escola_nome ?? '',
              };
            });
          setRecentAccess(recentCards);
        }
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
    // Atualiza a cada 30 segundos para refletir novos acessos biométricos
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const freqGlobalPct = freqHoje.total > 0
    ? Math.round(((freqHoje.presentes + freqHoje.atrasados) / freqHoje.total) * 100)
    : 0;

  const statusCfg: Record<string, { label: string; cls: string }> = {
    presente:  { label: 'Presente',  cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
    atrasado:  { label: 'Atrasado',  cls: 'bg-amber-500/15 text-amber-700 border-amber-200'       },
    falta:     { label: 'Falta',     cls: 'bg-destructive/15 text-destructive border-destructive/20' },
    justificada: { label: 'Justificada', cls: 'bg-blue-500/15 text-blue-700 border-blue-200'      },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── RESPONSAVEL dedicated dashboard ─────────────────────────────────────
  if (perfil?.papel === 'RESPONSAVEL') {
    const statusCfgResp: Record<string, { label: string; cls: string }> = {
      presente:  { label: 'Presente',  cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
      atrasado:  { label: 'Atrasado',  cls: 'bg-amber-500/15 text-amber-700 border-amber-200' },
      falta:     { label: 'Falta',     cls: 'bg-destructive/15 text-destructive border-destructive/20' },
      justificada: { label: 'Justificada', cls: 'bg-blue-500/15 text-blue-700 border-blue-200' },
    };
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Olá, {perfil.nome?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Acompanhe a frequência dos seus filhos — {todayLabel}</p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Meus Filhos" value={stats.alunos || 0} icon={Users} color="primary" />
          <StatCard title="Presentes Hoje" value={freqHoje.presentes} icon={CheckCircle2} color="success" />
          <StatCard title="Faltas Hoje" value={freqHoje.faltas} icon={TrendingDown} color="danger" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Per-child frequency */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base">Frequência dos Meus Filhos</CardTitle>
              <Link to="/meus-filhos" className="text-xs text-primary flex items-center gap-1 hover:underline">
                Ver detalhes <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {meusFilhos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum filho vinculado à sua conta.</p>
              ) : meusFilhos.map(filho => {
                const sc = filho.statusHoje ? (statusCfgResp[filho.statusHoje] ?? statusCfgResp.falta) : null;
                const pct = filho.freqPct;
                return (
                  <div key={filho.id} className="flex items-center gap-3 rounded-lg border px-3 py-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={filho.avatarUrl || ''} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {filho.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{filho.nome}</p>
                        {sc && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${sc.cls}`}>{sc.label}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{filho.escola} · {filho.turma}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className={`text-xs font-semibold tabular-nums shrink-0 ${
                          pct >= 85 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-destructive'
                        }`}>{pct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="space-y-4">
            <Card className={justPendentes > 0 ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${justPendentes > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
                  <FileText className={`h-5 w-5 ${justPendentes > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Justificativas</p>
                  <p className="text-2xl font-bold tabular-nums">{justPendentes}</p>
                  <p className="text-xs text-muted-foreground">pendentes de análise</p>
                </div>
                {justPendentes > 0 && <Link to="/justificativas"><AlertTriangle className="h-5 w-5 text-amber-500" /></Link>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Ações Rápidas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Link to="/meus-filhos" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                  <span>Ver Frequência dos Filhos</span><ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link to="/justificativas" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                  <span>Enviar Justificativa</span><ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── PROFESSOR dedicated dashboard ──────────────────────────────────────
  if (perfil?.papel === 'PROFESSOR') {
    const freqGlobalProfPct = freqHoje.total > 0
      ? Math.round(((freqHoje.presentes + freqHoje.atrasados) / freqHoje.total) * 100)
      : 0;

    return (
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold tracking-tight">Olá, {perfil.nome?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Painel do Professor — {todayLabel}</p>
        </div>

        {/* Top StatCards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Minhas Turmas" value={stats.turmas || 0} icon={School} color="primary" />
          <StatCard title="Meus Alunos" value={stats.alunos || 0} icon={Users} color="success" />
          <StatCard title="Freq. Hoje" value={freqGlobalProfPct} icon={TrendingUp} color={freqGlobalProfPct >= 85 ? 'success' : freqGlobalProfPct >= 70 ? 'warning' : 'danger'} suffix="%" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Frequência por turma */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base">Frequência das Minhas Turmas Hoje</CardTitle>
              <Link to="/minhas-turmas" className="text-xs text-primary flex items-center gap-1 hover:underline">
                Ver turmas <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {turmasFreqHoje.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado de frequência para hoje.</p>
              ) : turmasFreqHoje.map((t: any) => {
                const pct = t.total_alunos > 0 ? Math.round((t.presentes / t.total_alunos) * 100) : 0;
                return (
                  <div key={t.turma_id}>
                    <div className="flex items-center justify-between mb-1">
                      <Link
                        to={`/frequencia/${t.turma_id}`}
                        className="text-sm font-medium hover:text-primary transition-colors truncate max-w-[60%]"
                      >
                        {t.turma_nome}
                      </Link>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span>{t.presentes}/{t.total_alunos} alunos</span>
                        <span className={`font-semibold ${
                          pct >= 85 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-destructive'
                        }`}>{pct}%</span>
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className={`h-2 ${
                        pct >= 85 ? '[&>div]:bg-emerald-500' : pct >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-destructive'
                      }`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Notificações Recentes */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notificacoesRecentes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma notificação recebida.</p>
              ) : notificacoesRecentes.map(n => (
                <div key={n.id} className={`rounded-lg border px-3 py-2.5 ${
                  n.lida === 0 ? 'border-primary/30 bg-primary/5' : ''
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium leading-snug ${
                      n.lida === 0 ? 'text-primary' : 'text-foreground'
                    }`}>{n.titulo}</p>
                    {n.lida === 0 && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {n.remetente_nome} ·{' '}
                    {(() => { try { return formatDistanceToNow(new Date(n.data_envio), { addSuffix: true, locale: ptBR }); } catch { return n.data_envio; } })()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Ações rápidas */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ações Rápidas</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <Link to="/minhas-turmas" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
              <span>Minhas Turmas</span><ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/frequencia" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
              <span>Chamada do Dia</span><ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/justificativas" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
              <span>Justificativas</span><ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Generic dashboard (SECRETARIA, DIRETOR) ───────────────────────────────
  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          Olá, {perfil?.nome?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Painel de gestão — {todayLabel}
        </p>
      </div>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {perfil?.papel === 'DIRETOR' ? (
          <>
            <StatCard title="Alunos da Escola" value={stats.alunos || 0} icon={Users} color="success" />
            <StatCard title="Professores" value={stats.professores || 0} icon={GraduationCap} color="warning" />
            <StatCard title="Turmas" value={stats.turmas || 0} icon={School} color="primary" />
          </>
        ) : (
          <>
            <StatCard title="Escolas" value={stats.escolas || 0} icon={School} color="primary" />
            <StatCard title="Alunos Ativos" value={stats.alunos || 0} icon={Users} color="success" />
            <StatCard title="Professores" value={stats.professores || 0} icon={GraduationCap} color="warning" />
            <StatCard title="Diretores" value={stats.diretores || 0} icon={UserCog} color="info" />
          </>
        )}
      </div>

      {/* Frequency today summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Freq. Global Hoje</p>
              <p className="text-2xl font-bold tabular-nums">{freqGlobalPct}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Presentes</p>
              <p className="text-2xl font-bold tabular-nums">{freqHoje.presentes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atrasados</p>
              <p className="text-2xl font-bold tabular-nums">{freqHoje.atrasados}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Faltas</p>
              <p className="text-2xl font-bold tabular-nums text-destructive">{freqHoje.faltas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Frequência por escola / turma */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">
              {perfil?.papel === 'PROFESSOR' ? 'Frequência das Minhas Turmas Hoje' : 'Frequência por Escola — Hoje'}
            </CardTitle>
            <Link to={perfil?.papel === 'PROFESSOR' ? '/minhas-turmas' : '/escolas'} className="text-xs text-primary flex items-center gap-1 hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {escolasStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível.</p>
            ) : (
              escolasStats.map(item => (
                <div key={item.id}>
                  <div className="flex items-center justify-between mb-1">
                    <Link 
                      to={perfil?.papel === 'PROFESSOR' ? `/frequencia/${item.id}` : `/escolas/${item.id}`} 
                      className="text-sm font-medium hover:text-primary transition-colors truncate max-w-[60%]"
                    >
                      {item.nome}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span>{item.presentes}/{item.totalAlunos} alunos</span>
                      <span className={`font-semibold ${
                        item.freqPct >= 85 ? 'text-emerald-600' :
                        item.freqPct >= 70 ? 'text-amber-600' : 'text-destructive'
                      }`}>{item.freqPct}%</span>
                    </div>
                  </div>
                  <Progress
                    value={item.freqPct}
                    className={`h-2 ${
                      item.freqPct >= 85 ? '[&>div]:bg-emerald-500' :
                      item.freqPct >= 70 ? '[&>div]:bg-amber-500'   : '[&>div]:bg-destructive'
                    }`}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Alertas / Ações rápidas */}
        <div className="space-y-4">
          {/* Justificativas pendentes */}
          <Card className={justPendentes > 0 ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                justPendentes > 0 ? 'bg-amber-500/10' : 'bg-muted'
              }`}>
                <FileText className={`h-5 w-5 ${justPendentes > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Justificativas</p>
                <p className="text-2xl font-bold tabular-nums">{justPendentes}</p>
                <p className="text-xs text-muted-foreground">pendentes de análise</p>
              </div>
              {justPendentes > 0 && (
                <Link to="/justificativas">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Alunos sem biometria (sem avatar_url) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/iot-config" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                <span>Importar Fotos dos Alunos</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link to="/frequencia" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                <span>Chamada do Dia (Tempo Real)</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link to="/alunos" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                <span>Gerenciar Alunos</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link to="/justificativas" className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                <span>Analisar Justificativas</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Acessos recentes de hoje */}
      {recentAccess.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Últimos Acessos Hoje</CardTitle>
            <Link to="/frequencia" className="text-xs text-primary flex items-center gap-1 hover:underline">
              Tempo real <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentAccess.map(a => {
                const sc = statusCfg[a.status] ?? statusCfg.falta;
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={a.avatarUrl || ''} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {a.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${sc.cls}`}>{sc.label}</Badge>
                        {a.horaEntrada && <span className="text-[10px] text-muted-foreground font-mono">{a.horaEntrada}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
