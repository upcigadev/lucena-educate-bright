import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, type Papel } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: Papel[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, perfil, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !perfil) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(perfil.papel)) {
    // Caso o usuário não tenha o papel adequado, redireciona ao painel principal
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
