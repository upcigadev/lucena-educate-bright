import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { School, Users, GraduationCap, UserCog, TrendingUp, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EscolaFreqData {
  nome: string;
  presenca: number;
  falta: number;
  total: number;
  pct: number;
}

interface MonthlyData {
  mes: string;
  presente: number;
  atraso: number;
  falta: number;
  justificado: number;
}

const CHART_COLORS = {
  presente: 'hsl(152, 60%, 40%)',
  atraso: 'hsl(38, 92%, 50%)',
  falta: 'hsl(0, 72%, 51%)',
  justificado: 'hsl(48, 90%, 55%)',
};

const PIE_COLORS = [
  'hsl(152, 60%, 40%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(48, 90%, 55%)',
];

export default function Dashboard() {
  const { perfil } = useAuthStore();
  const [stats, setStats] = useState({ escolas: 0, alunos: 0, professores: 0, diretores: 0 });
  const [escolaFreq, setEscolaFreq] = useState<EscolaFreqData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [e, a, p, d] = await Promise.all([
        supabase.from('escolas').select('id', { count: 'exact', head: true }),
        supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('professores').select('id', { count: 'exact', head: true }),
        supabase.from('diretores').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        escolas: e.count || 0,
        alunos: a.count || 0,
        professores: p.count || 0,
        diretores: d.count || 0,
      });
    };
    load();
  }, []);

  useEffect(() => {
    const loadCharts = async () => {
      setLoadingCharts(true);

      // Fetch all escolas and frequencias for current month
      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

      const [escolasRes, freqCurrentRes] = await Promise.all([
        supabase.from('escolas').select('id, nome').order('nome'),
        supabase.from('frequencias').select('id, aluno_id, turma_id, data, status').gte('data', monthStart).lte('data', monthEnd),
      ]);

      const escolas = (escolasRes.data || []) as { id: string; nome: string }[];
      const freqCurrent = (freqCurrentRes.data || []) as { id: string; aluno_id: string; turma_id: string | null; data: string; status: string }[];

      // Get turma -> escola mapping
      const turmaIds = [...new Set(freqCurrent.filter(f => f.turma_id).map(f => f.turma_id!))];
      let turmaEscolaMap: Record<string, string> = {};
      if (turmaIds.length > 0) {
        const { data: turmas } = await supabase.from('turmas').select('id, escola_id').in('id', turmaIds);
        if (turmas) {
          turmaEscolaMap = Object.fromEntries(turmas.map((t: any) => [t.id, t.escola_id]));
        }
      }

      // Build escola freq data
      const escolaMap: Record<string, { presente: number; falta: number; total: number }> = {};
      escolas.forEach(e => { escolaMap[e.id] = { presente: 0, falta: 0, total: 0 }; });

      freqCurrent.forEach(f => {
        const escolaId = f.turma_id ? turmaEscolaMap[f.turma_id] : null;
        if (escolaId && escolaMap[escolaId]) {
          escolaMap[escolaId].total++;
          if (f.status === 'presente' || f.status === 'atraso' || f.status === 'justificado') {
            escolaMap[escolaId].presente++;
          } else {
            escolaMap[escolaId].falta++;
          }
        }
      });

      const escolaFreqData = escolas
        .map(e => ({
          nome: e.nome.length > 20 ? e.nome.substring(0, 18) + '…' : e.nome,
          presenca: escolaMap[e.id].presente,
          falta: escolaMap[e.id].falta,
          total: escolaMap[e.id].total,
          pct: escolaMap[e.id].total > 0 ? Math.round((escolaMap[e.id].presente / escolaMap[e.id].total) * 100) : 0,
        }))
        .filter(e => e.total > 0);

      setEscolaFreq(escolaFreqData);

      // Monthly evolution (last 6 months)
      const months: MonthlyData[] = [];
      const monthPromises = [];

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const ms = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const me = format(endOfMonth(monthDate), 'yyyy-MM-dd');
        const label = format(monthDate, 'MMM', { locale: ptBR });
        monthPromises.push(
          supabase.from('frequencias').select('status').gte('data', ms).lte('data', me)
            .then(({ data }) => ({
              label,
              data: data || [],
            }))
        );
      }

      const monthResults = await Promise.all(monthPromises);
      monthResults.forEach(({ label, data }) => {
        const presente = data.filter((f: any) => f.status === 'presente').length;
        const atraso = data.filter((f: any) => f.status === 'atraso').length;
        const falta = data.filter((f: any) => f.status === 'falta').length;
        const justificado = data.filter((f: any) => f.status === 'justificado').length;
        months.push({ mes: label, presente, atraso, falta, justificado });
      });

      setMonthlyData(months);

      // Pie chart - current month totals
      const totalPresente = freqCurrent.filter(f => f.status === 'presente').length;
      const totalAtraso = freqCurrent.filter(f => f.status === 'atraso').length;
      const totalFalta = freqCurrent.filter(f => f.status === 'falta').length;
      const totalJustificado = freqCurrent.filter(f => f.status === 'justificado').length;

      setPieData([
        { name: 'Presente', value: totalPresente },
        { name: 'Atraso', value: totalAtraso },
        { name: 'Falta', value: totalFalta },
        { name: 'Justificado', value: totalJustificado },
      ].filter(d => d.value > 0));

      setLoadingCharts(false);
    };
    loadCharts();
  }, []);

  const hasFreqData = monthlyData.some(m => m.presente + m.atraso + m.falta + m.justificado > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">
          Olá, {perfil?.nome?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Bem-vindo ao painel de gestão
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Escolas" value={stats.escolas} icon={School} color="primary" />
        <StatCard title="Alunos Ativos" value={stats.alunos} icon={Users} color="success" />
        <StatCard title="Professores" value={stats.professores} icon={GraduationCap} color="warning" />
        <StatCard title="Diretores" value={stats.diretores} icon={UserCog} />
      </div>

      {loadingCharts ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !hasFreqData ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Ainda não há dados de frequência para exibir gráficos.</p>
            <p className="text-xs mt-1">Os gráficos aparecerão quando houver registros de presença.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Row 1: Monthly evolution + Pie */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Evolução Mensal de Frequência
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="presente" name="Presente" stroke={CHART_COLORS.presente} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="atraso" name="Atraso" stroke={CHART_COLORS.atraso} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="falta" name="Falta" stroke={CHART_COLORS.falta} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="justificado" name="Justificado" stroke={CHART_COLORS.justificado} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resumo do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados este mês.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Presence by school */}
          {escolaFreq.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Frequência por Escola — {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, escolaFreq.length * 50)}>
                  <BarChart data={escolaFreq} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="nome" type="category" width={140} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number, name: string) => [value, name === 'presenca' ? 'Presenças' : 'Faltas']}
                    />
                    <Bar dataKey="presenca" name="Presenças" fill={CHART_COLORS.presente} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="falta" name="Faltas" fill={CHART_COLORS.falta} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
