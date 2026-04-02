import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, MapPin, ArrowRight, Clock } from 'lucide-react';

export default function MinhasTurmas() {
  const { perfil } = useAuthStore();
  const navigate = useNavigate();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!perfil) return;
      setLoading(true);
      try {
        const { data } = await db.turmas.listByProfessor(perfil.id);
        setTurmas((data as any[]) || []);
      } catch (error) {
        console.error('Erro ao carregar turmas:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [perfil]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Minhas Turmas
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Selecione uma turma para visualizar a lista de alunos e chamada.
        </p>
      </div>

      {turmas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma turma vinculada</p>
            <p className="text-sm">Você ainda não está lecionando em nenhuma turma.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {turmas.map(turma => (
            <Card key={turma.id} className="hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{turma.nome}</CardTitle>
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <MapPin className="h-3 w-3" />
                  {turma.escola_nome} {turma.sala && `• Sala ${turma.sala}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end gap-2">
                <Button 
                  className="w-full flex items-center justify-between" 
                  variant="outline"
                  onClick={() => navigate(`/escolas/${turma.escola_id}/turma/${turma.id}`)}
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Ver Detalhes
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                
                <Button 
                  className="w-full flex items-center justify-between bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors border-0" 
                  variant="outline"
                  onClick={() => navigate(`/frequencia/${turma.id}`)}
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Ver Frequência
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
