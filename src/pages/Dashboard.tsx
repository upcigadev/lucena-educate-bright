import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { School, Users, GraduationCap, UserCog, TrendingUp, BarChart3, Activity } from 'lucide-react';
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

interface AccessLog {
  id: string;
  time: string;
  evento: string;
  name?: string;
  photo_base64?: string;
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
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);

  useEffect(() => {
    // Initial mocked stats to ensure it compiles offline-first
    setStats({ escolas: 1, alunos: 120, professores: 15, diretores: 2 });
    setMonthlyData([
      { mes: 'Out', presente: 120, atraso: 5, falta: 2, justificado: 1 },
      { mes: 'Nov', presente: 110, atraso: 8, falta: 5, justificado: 4 },
      { mes: 'Dez', presente: 115, atraso: 4, falta: 3, justificado: 2 },
    ]);
    setPieData([
      { name: 'Presente', value: 115 },
      { name: 'Atraso', value: 4 },
      { name: 'Falta', value: 3 },
      { name: 'Justificado', value: 2 },
    ]);
    setEscolaFreq([
      { nome: 'Escola Municipal 1', presenca: 115, falta: 3, total: 118, pct: 97 }
    ]);
    setLoadingCharts(false);
  }, []);

  // Catraca real-time listener
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onDeviceWebhook) {
      window.electronAPI.onDeviceWebhook((payload: any) => {
        const newLog: AccessLog = {
          id: Math.random().toString(36).substring(7),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          evento: 'Acesso Catraca',
          photo_base64: payload?.access_logs?.[0]?.photo_base64 || payload?.photo_base64,
          name: payload?.users?.[0]?.name || 'Usuário Não Identificado',
        };
        setAccessLogs((prev) => [newLog, ...prev].slice(0, 10)); // keep last 10
      });
    }
  }, []);

  const hasFreqData = monthlyData.some(m => m.presente + m.atraso + m.falta + m.justificado > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">
          Olá, {perfil?.nome?.split(' ')[0] || perfil?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Bem-vindo ao painel central
        </p>
      </div>

      {/* Live Feed Row */}
      {accessLogs.length > 0 && (
        <Card className="mb-8 border-primary shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-3 w-3 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              Feed em Tempo Real (Catraca Control iD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-row gap-4 overflow-x-auto pb-2">
              {accessLogs.map(log => (
                <div key={log.id} className="flex-shrink-0 w-40 bg-background border rounded-lg p-3 flex flex-col items-center gap-3">
                  {log.photo_base64 ? (
                    <img src={`data:image/jpeg;base64,${log.photo_base64}`} alt="Foto" className="w-16 h-16 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shadow-sm">
                      <UserCog className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-xs font-semibold leading-tight line-clamp-1">{log.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{log.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

          {escolaFreq.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Frequência por Escola
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
