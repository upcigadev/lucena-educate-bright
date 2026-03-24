import { useEffect, useState, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { getDb } from '@/lib/database';
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
