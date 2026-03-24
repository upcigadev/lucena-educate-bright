import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { School, Users, GraduationCap, UserCog, TrendingUp, BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const { perfil } = useAuthStore();
  const [stats, setStats] = useState({ escolas: 0, alunos: 0, professores: 0, diretores: 0 });

  useEffect(() => {
    // TODO: Replace with actual SQLite queries
    const { data } = db.stats.counts();
    if (data) setStats(data);
  }, []);

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

      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Os gráficos de frequência aparecerão quando o banco de dados SQLite estiver conectado.</p>
          <p className="text-xs mt-1">TODO: Integrar com SQLite para dados reais de frequência.</p>
        </CardContent>
      </Card>
    </div>
  );
}
