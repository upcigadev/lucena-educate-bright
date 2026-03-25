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
            const aluno = alunos.find(a => a.matricula === String(log.user_id));
            if (aluno && (log.event === undefined || String(log.event) === "7")) {
              const now = new Date();
              const dataDeHoje = now.toISOString().split('T')[0];
              const horaAtual = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
              
              await db.frequencias.insert({
                aluno_id: aluno.id,
                turma_id: aluno.turma_id,
                data: dataDeHoje,
                hora_entrada: horaAtual,
                status: 'presente',
                dispositivo_id: String(log.device_id || '')
              });
              
              toast.success(`Presença registrada: ${aluno.nome_completo}`, {
                icon: '👋',
                duration: 5000
              });
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
