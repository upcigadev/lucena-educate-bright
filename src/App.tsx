import { useEffect, useRef, useState, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Toaster as Sonner, toast } from 'sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { db } from '@/lib/mock-db';
import { enviarNotificacaoFrequencia } from '@/lib/notification-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
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
import Frequencia from '@/pages/Frequencia';
import NotFound from '@/pages/NotFound';
import MinhasTurmas from '@/pages/MinhasTurmas';
import MeusFilhos from '@/pages/MeusFilhos';

const queryClient = new QueryClient();

function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = String(time).split(':').map(Number);
  if (parts.length < 2 || parts.some(n => Number.isNaN(n))) return null;
  const [hh, mm] = parts;
  return hh * 60 + mm;
}

interface AccessFlash {
  id: string;
  photo: string | null;
  nome: string;
  matricula: string;
  horario: string;
  status: 'presente' | 'atrasado' | 'acesso';
}

function GlobalDeviceMonitor() {
  const [flash, setFlash] = useState<AccessFlash | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = (entry: AccessFlash) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFlash(entry);
    timerRef.current = setTimeout(() => setFlash(null), 8000);
  };

  useEffect(() => {
    const socket = io('http://localhost:3000', {
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
    });

    // Buffer: photos arrive before the log; keyed by userId
    const photoBuffer = new Map<string, string>();

    socket.on('device:accessLog', async (payload: any) => {
      // ── Photo event ──────────────────────────────────────────────────
      if (payload?.type === 'photo' && payload?.userId != null && payload?.data) {
        const userId = String(payload.userId);
        let dataUri = payload.data as string;
        if (!dataUri.startsWith('data:image')) dataUri = `data:image/jpeg;base64,${dataUri}`;
        photoBuffer.set(userId, dataUri);

        try {
          const alunosRes = await db.alunos.getByDeviceUserIds([userId]);
          const aluno = alunosRes.data?.[0];
          if (aluno?.id) {
            await db.alunos.update(aluno.id, { avatar_url: dataUri });
            queryClient.invalidateQueries({ queryKey: ['alunos'] });
          }
        } catch (e) {
          console.error('Erro ao salvar foto:', e);
        }
        return;
      }

      // ── Log event ────────────────────────────────────────────────────
      if (payload.type === 'log') {
        const logs: any[] = Array.isArray(payload.data)
          ? payload.data
          : payload.data ? [payload.data] : [];
        if (logs.length === 0) return;
        try {
          const logUserIds = Array.from(new Set(logs.map(l => l?.user_id != null ? String(l.user_id) : null).filter(Boolean)));
          const alunosRes = await db.alunos.getByDeviceUserIds(logUserIds as string[]);
          const alunos: any[] = (alunosRes.data as any[]) || [];

          for (const log of logs) {
            const logUserId = log?.user_id != null ? String(log.user_id) : null;
            const aluno = alunos.find(a => {
              const matriculaMatch = a.matricula === logUserId;
              const idfaceUserMatch = a.idface_user_id != null && a.idface_user_id === logUserId;
              return matriculaMatch || idfaceUserMatch;
            });

            const event = log?.event != null ? String(log.event) : undefined;
            const now = new Date();
            const dataDeHoje = now.toISOString().split('T')[0];
            const horaAtual = now.toTimeString().split(' ')[0].substring(0, 5);
            const horaAtualMin = timeToMinutes(horaAtual);

            if (aluno && (event === undefined || ['6', '7'].includes(String(event)))) {
              const horarioInicioMin = timeToMinutes((aluno as any).horario_inicio ?? null);
              const limiteMaxMin = timeToMinutes(aluno.limite_max);

              const status: 'presente' | 'atrasado' =
                horarioInicioMin != null && horaAtualMin != null && horaAtualMin > horarioInicioMin
                  ? 'atrasado'
                  : limiteMaxMin != null && horaAtualMin != null && horaAtualMin > limiteMaxMin
                  ? 'atrasado'
                  : 'presente';

              const historico = await db.frequencias.listByAlunos([aluno.id], dataDeHoje, dataDeHoje);
              const historicoData: any[] = (historico.data as any[]) || [];
              if (historicoData.length === 0) {
                await db.frequencias.insert({
                  aluno_id: aluno.id,
                  turma_id: aluno.turma_id,
                  data: dataDeHoje,
                  hora_entrada: horaAtual,
                  status,
                  dispositivo_id: String(log.device_id || '')
                });

                enviarNotificacaoFrequencia({
                  aluno_id: String(aluno.id),
                  hora_entrada: horaAtual,
                  status,
                  data: dataDeHoje
                });

                const photo = logUserId ? (photoBuffer.get(logUserId) ?? aluno.avatar_url ?? null) : null;
                const horario = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                showFlash({
                  id: `${aluno.id}-${Date.now()}`,
                  photo,
                  nome: aluno.nome_completo,
                  matricula: aluno.matricula,
                  horario,
                  status,
                });

                const statusLabel = status === 'presente' ? 'Presente ✅' : 'Atrasado ⏰';
                toast.success(`${statusLabel}: ${aluno.nome_completo}`, { icon: '👋', duration: 5000 });
              } else {
                // Já registrado hoje — apenas mostra o flash com foto
                if (logUserId) {
                  const photo = photoBuffer.get(logUserId) ?? aluno.avatar_url ?? null;
                  const horario = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  showFlash({ id: `${aluno.id}-${Date.now()}`, photo, nome: aluno.nome_completo, matricula: aluno.matricula, horario, status: 'acesso' });
                }
              }
            } else if (!aluno && logUserId) {
              // Aluno não cadastrado — exibe flash mesmo assim
              const photo = photoBuffer.get(logUserId) ?? null;
              const horario = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              showFlash({ id: `unknown-${Date.now()}`, photo, nome: `Matrícula ${logUserId}`, matricula: logUserId, horario, status: 'acesso' });
            }
          }
        } catch (error) {
          console.error('Erro ao processar log do aparelho:', error);
        }
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  // Status badge config for flash
  const flashCfg = flash ? {
    presente:  { label: 'Presente',  cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
    atrasado:  { label: 'Atrasado',  cls: 'bg-amber-500/15 text-amber-700 border-amber-200' },
    acesso:    { label: 'Acesso',    cls: 'bg-sky-500/15 text-sky-700 border-sky-200' },
  }[flash.status] : null;

  return flash && flashCfg ? (
    <div className="fixed bottom-6 right-6 z-[100] w-72 rounded-2xl border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Top colored strip */}
      <div className={`h-1 w-full ${
        flash.status === 'presente' ? 'bg-emerald-500' :
        flash.status === 'atrasado' ? 'bg-amber-500' : 'bg-sky-500'
      }`} />
      <div className="p-4 flex gap-3 items-center">
        <Avatar className="h-16 w-16 rounded-xl shrink-0">
          <AvatarImage src={flash.photo || ''} className="object-cover" />
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold text-lg">
            {flash.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate leading-tight">{flash.nome}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{flash.matricula}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${flashCfg.cls}`}>{flashCfg.label}</Badge>
            <span className="text-[10px] text-muted-foreground font-mono">{flash.horario}</span>
          </div>
        </div>
        <button onClick={() => setFlash(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  ) : null;
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore();

  // authStore.onAuthStateChange handles session restoration automatically.
  // We just wait for the initial loading flag to clear.
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
      <GlobalDeviceMonitor />
      <BrowserRouter>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Only SECRETARIA */}
              <Route path="escolas" element={<ProtectedRoute allowedRoles={['SECRETARIA']}><Escolas /></ProtectedRoute>} />
              <Route path="diretores" element={<ProtectedRoute allowedRoles={['SECRETARIA']}><Diretores /></ProtectedRoute>} />
              <Route path="iot-config" element={<ProtectedRoute allowedRoles={['SECRETARIA']}><IoTConfig /></ProtectedRoute>} />
              
              {/* SECRETARIA and DIRETOR */}
              <Route path="escolas/:escolaId" element={<ProtectedRoute allowedRoles={['SECRETARIA', 'DIRETOR']}><EscolaDetalhe /></ProtectedRoute>} />
              <Route path="escolas/:escolaId/turma/:turmaId" element={<ProtectedRoute allowedRoles={['SECRETARIA', 'DIRETOR', 'PROFESSOR']}><TurmaDetalhe /></ProtectedRoute>} />
              <Route path="professores" element={<ProtectedRoute allowedRoles={['SECRETARIA', 'DIRETOR']}><Professores /></ProtectedRoute>} />
              
              {/* PROFESSOR specific */}
              <Route path="minhas-turmas" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><MinhasTurmas /></ProtectedRoute>} />

              {/* RESPONSAVEL specific */}
              <Route path="meus-filhos" element={<ProtectedRoute allowedRoles={['RESPONSAVEL']}><MeusFilhos /></ProtectedRoute>} />

              {/* SECRETARIA, DIRETOR and PROFESSOR */}
              <Route path="alunos" element={<ProtectedRoute allowedRoles={['SECRETARIA', 'DIRETOR', 'PROFESSOR']}><Alunos /></ProtectedRoute>} />
              <Route path="frequencia" element={<ProtectedRoute allowedRoles={['SECRETARIA', 'DIRETOR', 'PROFESSOR']}><Frequencia /></ProtectedRoute>} />
              <Route path="frequencia/:turmaId" element={<ProtectedRoute allowedRoles={['SECRETARIA', 'DIRETOR', 'PROFESSOR']}><Frequencia /></ProtectedRoute>} />
              
              <Route path="responsaveis" element={<ProtectedRoute allowedRoles={['SECRETARIA', 'DIRETOR']}><Responsaveis /></ProtectedRoute>} />
              <Route path="justificativas" element={<ProtectedRoute allowedRoles={['SECRETARIA', 'DIRETOR', 'PROFESSOR', 'RESPONSAVEL']}><Justificativas /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
