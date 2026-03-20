import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/shared/StatCard';
import { School, Users, GraduationCap, UserCog } from 'lucide-react';

export default function Dashboard() {
  const { perfil } = useAuthStore();
  const [stats, setStats] = useState({ escolas: 0, alunos: 0, professores: 0, diretores: 0 });

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Escolas" value={stats.escolas} icon={School} color="primary" />
        <StatCard title="Alunos Ativos" value={stats.alunos} icon={Users} color="success" />
        <StatCard title="Professores" value={stats.professores} icon={GraduationCap} color="warning" />
        <StatCard title="Diretores" value={stats.diretores} icon={UserCog} />
      </div>
    </div>
  );
}
