import { useEffect, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Escolas from '@/pages/Escolas';
import Diretores from '@/pages/Diretores';
import Professores from '@/pages/Professores';
import Alunos from '@/pages/Alunos';
import Responsaveis from '@/pages/Responsaveis';
import Frequencia from '@/pages/Frequencia';
import IoTConfig from '@/pages/IoTConfig';
import Justificativas from '@/pages/Justificativas';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, setUser, setLoading, loadPerfil } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadPerfil(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadPerfil(session.user.id);
      } else {
        setUser(null);
        useAuthStore.getState().setPerfil(null);
      }
    });

    return () => subscription.unsubscribe();
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="escolas" element={<Escolas />} />
            <Route path="diretores" element={<Diretores />} />
            <Route path="professores" element={<Professores />} />
            <Route path="alunos" element={<Alunos />} />
            <Route path="responsaveis" element={<Responsaveis />} />
            <Route path="frequencia" element={<Frequencia />} />
            <Route path="iot-config" element={<IoTConfig />} />
            <Route path="justificativas" element={<Justificativas />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
