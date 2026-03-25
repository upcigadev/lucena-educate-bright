import { useEffect, useState, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Toaster as Sonner, toast } from 'sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { getDb } from '@/lib/database';
import { db } from '@/lib/mock-db';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Escolas from '@/pages/Escolas';
import Diretores from '@/pages/Diretores';
import Professores from '@/pages/Professores';
import Alunos from '@/pages/Alunos';
import Responsaveis from '@/pages/Responsaveis';
import EscolaDetalhe from '@/pages/EscolaDetalhe';
import TurmaDetalhe from '@/pages/TurmaDetalhe';
import IoTConfig from '@/pages/IoTConfig';
import Justificativas from '@/pages/Justificativas';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient();

function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = String(time).split(':').map(Number);
  if (parts.length < 2 || parts.some(n => Number.isNaN(n))) return null;
  const [hh, mm] = parts;
  return hh * 60 + mm;
}

function GlobalDeviceMonitor() {
  useEffect(() => {
    const socket = io('http://localhost:3000', {
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
    });

    socket.on('device:accessLog', async (payload: any) => {
      if (payload.type === 'log' && Array.isArray(payload.data)) {
        try {
          const alunosRes = await db.alunos.list();
          const alunos = alunosRes.data || [];
          
          for (const log of payload.data) {
            // Find student by matricula matching user_id
            const logUserId = log?.user_id != null ? String(log.user_id) : null;
            const aluno = alunos.find(a => {
              const matriculaMatch = a.matricula === logUserId;
              const idfaceUserMatch = a.idface_user_id != null && a.idface_user_id === logUserId;
              return matriculaMatch || idfaceUserMatch;
            });

            // No iDFace, o "event" pode vir como números diferentes conforme o tipo de acesso.
            // A integração anterior considerava apenas "7"; vamos aceitar "6" e "7" para cobrir "entrada".
            const event = log?.event != null ? String(log.event) : null;
            const isEntrada = event == null || event === '6' || event === '7';

            if (aluno && isEntrada) {
              const now = new Date();
              const dataDeHoje = now.toISOString().split('T')[0];
              const horaAtual = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

              const horaAtualMin = timeToMinutes(horaAtual);
              const limiteMaxMin = timeToMinutes(aluno.limite_max);
              const horarioFimMin = timeToMinutes(aluno.horario_fim);

              // Se passou do horário máximo de registro, ignoramos silenciosamente.
              if (horaAtualMin != null && limiteMaxMin != null && horaAtualMin > limiteMaxMin) {
                continue;
              }

              const historico = await db.frequencias.listByAlunos([aluno.id], dataDeHoje, dataDeHoje);
              if (!historico.data || historico.data.length === 0) {
                const status = (horaAtualMin != null && horarioFimMin != null && horaAtualMin > horarioFimMin)
                  ? 'atrasado'
                  : 'presente';

                await db.frequencias.insert({
                  aluno_id: aluno.id,
                  turma_id: aluno.turma_id,
                  data: dataDeHoje,
                  hora_entrada: horaAtual,
                  status,
                  dispositivo_id: String(log.device_id || '')
                });

                const statusLabel = status === 'presente' ? 'Presente' : 'Atrasado';
                toast.success(`Presença registrada (${statusLabel}): ${aluno.nome_completo}`, {
                  icon: '👋',
                  duration: 5000
                });
              }
            }
          }
        } catch (error) {
          console.error('Erro ao processar log do aparelho:', error);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return null;
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, setUser, setLoading, loadPerfil } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        await loadPerfil(parsed.id);
      }
      setLoading(false);
    };
    init();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function DbInitializer({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getDb().then(() => setReady(true)).catch(err => {
      console.error('Failed to init SQLite:', err);
      setReady(true); // Continue anyway
    });
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Inicializando banco de dados...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DbInitializer>
        <GlobalDeviceMonitor />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="escolas" element={<Escolas />} />
              <Route path="escolas/:escolaId" element={<EscolaDetalhe />} />
              <Route path="escolas/:escolaId/turma/:turmaId" element={<TurmaDetalhe />} />
              <Route path="diretores" element={<Diretores />} />
              <Route path="professores" element={<Professores />} />
              <Route path="alunos" element={<Alunos />} />
              <Route path="responsaveis" element={<Responsaveis />} />
              <Route path="iot-config" element={<IoTConfig />} />
              <Route path="justificativas" element={<Justificativas />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DbInitializer>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
