import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Radio, Clock, UserCheck } from 'lucide-react';
import { db } from '@/lib/mock-db';
import { useAuthStore } from '@/stores/authStore';
import { enviarNotificacaoFrequencia } from '@/lib/notification-service';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface AccessCard {
  id: string; // unique per event
  nome: string;
  matricula: string;
  avatarUrl: string | null;
  horario: string; // HH:mm:ss
  status: 'presente' | 'atrasado' | 'acesso';
}

type ConnStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const MAX_CARDS = 20;

function nowHMS(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [hh, mm] = String(t).split(':').map(Number);
  return Number.isNaN(hh) || Number.isNaN(mm) ? null : hh * 60 + mm;
}

function getInitials(nome: string): string {
  return nome
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function Frequencia() {
  const { turmaId } = useParams();
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');
  const [cards, setCards] = useState<AccessCard[]>([]);
  const { perfil, escolaAtiva } = useAuthStore();

  // Buffer received photos until the matching log arrives (or vice-versa)
  const photoBuffer = useRef<Map<string, string>>(new Map()); // userId → dataUri
  const socketRef = useRef<Socket | null>(null);

  // ── Load today's history from SQLite on mount ─────────────────────
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    
    const fetchAllowedAlunosIds = async () => {
      if (perfil?.papel === 'PROFESSOR') {
        const { data } = await db.alunos.listByProfessorUsuarioId(perfil.id);
        return ((data as any[]) || []).map(a => a.id);
      }
      return null;
    };

    Promise.all([
      db.frequencias.listByDate(today),
      fetchAllowedAlunosIds()
    ]).then(([ { data }, allowedAlunosIds ]) => {
      if (!data || data.length === 0) return;
      
      let filteredData = data as any[];
      if (perfil?.papel === 'DIRETOR' && escolaAtiva) {
        filteredData = filteredData.filter(d => d.escola_id === escolaAtiva);
      } else if (perfil?.papel === 'PROFESSOR' && allowedAlunosIds) {
        filteredData = filteredData.filter(d => allowedAlunosIds.includes(d.aluno_id));
      }

      if (turmaId) {
        filteredData = filteredData.filter(d => d.turma_id === turmaId);
      }

      const historicCards: AccessCard[] = filteredData.map((row) => {
        const horario = row.hora_entrada
          ? String(row.hora_entrada).slice(0, 8)
          : '--:--:--';
        const [hh, mm] = horario.split(':').map(Number);
        const nowMin = hh * 60 + mm;
        const limiteMin = timeToMin(row.limite_max);
        const fimMin = timeToMin(row.horario_fim);
        const status: AccessCard['status'] =
          row.status === 'atrasado'
            ? 'atrasado'
            : row.status === 'presente'
            ? 'presente'
            : limiteMin != null && nowMin > limiteMin
            ? 'acesso'
            : fimMin != null && nowMin > fimMin
            ? 'atrasado'
            : 'presente';
        const avatarUrl = row.avatar_url || null;
        return {
          id: `hist-${row.id}`,
          nome: row.nome_completo ?? `Matrícula ${row.matricula}`,
          matricula: row.matricula ?? '',
          avatarUrl,
          horario,
          status,
        };
      });
      setCards(historicCards.slice(0, MAX_CARDS));
    }).catch((e) => console.warn('[Frequencia] Erro ao carregar histórico:', e));
  }, []);

  // ── Real-time WebSocket connection ────────────────────────────────
  useEffect(() => {
    const socket = io('http://localhost:3000', {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnStatus('connected'));
    socket.on('disconnect', () => setConnStatus('disconnected'));
    socket.on('reconnect_attempt', () => setConnStatus('reconnecting'));
    socket.on('reconnect', () => setConnStatus('connected'));
    socket.on('connect_error', () => setConnStatus('disconnected'));

    socket.on('device:accessLog', async (payload: any) => {
      /* ── Photo event ──────────────────────────────────────────────── */
      if (payload?.type === 'photo' && payload?.userId != null && payload?.data) {
        const userId = String(payload.userId);
        let dataUri = payload.data as string;
        if (!dataUri.startsWith('data:image')) {
          dataUri = `data:image/jpeg;base64,${dataUri}`;
        }
        photoBuffer.current.set(userId, dataUri);
        return;
      }

      /* ── Log event ───────────────────────────────────────────────── */
      if (payload?.type === 'log') {
        const rows: any[] = Array.isArray(payload.data)
          ? payload.data
          : payload.data
          ? [payload.data]
          : [];

        if (rows.length === 0) return;

        try {
          let alunosData;
          if (perfil?.papel === 'DIRETOR' && escolaAtiva) {
            const { data } = await db.alunos.listByEscola(escolaAtiva);
            alunosData = data;
          } else if (perfil?.papel === 'PROFESSOR') {
            const { data } = await db.alunos.listByProfessorUsuarioId(perfil.id);
            alunosData = data;
          } else {
            const { data } = await db.alunos.list();
            alunosData = data;
          }
          const allAlunos = alunosData || [];

          for (const log of rows) {
            // user_id = the ID we registered the user with on the Control iD device.
            //           This is stored as idface_user_id in our DB.
            // identifier_id = fixed biometric template ID on the device firmware.
            //                 It is CONSTANT across all logs and does NOT identify who passed.
            const logUserId = log?.user_id != null ? String(log.user_id) : null;

            if (!logUserId) continue;

            // Normalize by stripping leading zeros before comparing, so "07246988416" === "7246988416"
            const normalizedLogId = logUserId.replace(/^0+/, '') || logUserId;

            // Match by idface_user_id (primary) or matricula (with and without leading zeros)
            const aluno = allAlunos.find((a: any) => {
              const normalizedMatricula = String(a.matricula).replace(/^0+/, '') || String(a.matricula);
              const byIdfaceId = a.idface_user_id != null &&
                (String(a.idface_user_id) === logUserId || String(a.idface_user_id).replace(/^0+/, '') === normalizedLogId);
              const byMatricula = normalizedMatricula === normalizedLogId || String(a.matricula) === logUserId;
              return (byIdfaceId || byMatricula) && (!turmaId || a.turma_id === turmaId);
            });

            // Se não encontrou o aluno e não for SECRETARIA, ignore o log
            // pois pode ser alguém de outra escola/turma no qual ele não tem acesso
            if (!aluno && perfil?.papel !== 'SECRETARIA') {
              continue;
            }

            const horario = nowHMS();
            const [hh, mm] = horario.split(':').map(Number);
            const nowMin = hh * 60 + mm;

            // Determina status usando horário efetivo: aluno > turma > escola
            const horarioInicio   = (aluno as any)?.horario_inicio ?? null;
            const toleranciaMin   = Number((aluno as any)?.tolerancia_min) || 0;
            const horarioInicioMin = timeToMin(horarioInicio);
            // Limite para "presente": horario_inicio + tolerancia (ex: 08:00 + 15 min = 08:15)
            const limitePresente = horarioInicioMin != null ? horarioInicioMin + toleranciaMin : null;
            const status: AccessCard['status'] =
              !aluno
                ? 'acesso'
                : (limitePresente == null)
                ? 'presente' // sem horário configurado → presente
                : nowMin <= limitePresente
                ? 'presente'
                : 'atrasado';

            // ── Persist to SQLite ──────────────────────────────────────
            if (aluno) {
              const today = new Date().toISOString().slice(0, 10);
              // Avoid duplicate records: only insert if no entry exists for this student today.
              const { data: existing } = await db.frequencias.listByTurmaAndDate(
                aluno.turma_id ?? '',
                today
              );
              const alreadyRecorded = (existing as any[] | null)?.some(
                (f: any) => f.aluno_id === aluno.id
              );
              if (!alreadyRecorded) {
                await db.frequencias.insert({
                  aluno_id: aluno.id,
                  turma_id: aluno.turma_id ?? null,
                  data: today,
                  hora_entrada: horario,
                  status,
                  dispositivo_id: log?.device_id ?? null,
                });

                enviarNotificacaoFrequencia({
                  aluno_id: String(aluno.id),
                  hora_entrada: horario,
                  status,
                  data: today
                });
              }
            }

            const lookupId = logUserId ?? '';
            const photo = photoBuffer.current.get(lookupId) ?? aluno?.avatar_url ?? null;

            const card: AccessCard = {
              id: `${lookupId}-${Date.now()}`,
              nome: aluno?.nome_completo ?? `Matrícula ${lookupId}`,
              matricula: aluno?.matricula ?? lookupId,
              avatarUrl: photo,
              horario,
              status,
            };

            setCards((prev) => [card, ...prev].slice(0, MAX_CARDS));
          }
        } catch (e) {
          console.error('[Frequencia] Erro ao processar log:', e);
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Connection status badge                                              */
  /* ------------------------------------------------------------------ */
  const connCfg: Record<
    ConnStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ElementType; pulse: boolean }
  > = {
    connecting:    { label: 'Conectando…',   variant: 'secondary',    icon: Radio,   pulse: true  },
    connected:     { label: 'Conectado',      variant: 'default',      icon: Wifi,    pulse: false },
    reconnecting:  { label: 'Reconectando…', variant: 'secondary',    icon: Radio,   pulse: true  },
    disconnected:  { label: 'Offline',        variant: 'destructive',  icon: WifiOff, pulse: false },
  };
  const conn = connCfg[connStatus];
  const ConnIcon = conn.icon;

  /* ------------------------------------------------------------------ */
  /* Status badge per card                                                */
  /* ------------------------------------------------------------------ */
  const statusCfg: Record<
    AccessCard['status'],
    { label: string; className: string }
  > = {
    presente:  { label: 'Presente',  className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/15' },
    atrasado:  { label: 'Atrasado',  className: 'bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/15'         },
    acesso:    { label: 'Acesso',    className: 'bg-sky-500/15 text-sky-700 border-sky-200 hover:bg-sky-500/15'                 },
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <PageHeader
          title="Chamada do Dia"
          description="Monitoramento em tempo real via reconhecimento facial"
        />
        <Badge
          variant={conn.variant}
          className="gap-1.5 mt-1 shrink-0"
        >
          <ConnIcon
            className={`h-3 w-3 ${conn.pulse ? 'animate-pulse' : ''}`}
          />
          {conn.label}
        </Badge>
      </div>

      {/* Stats bar */}
      {cards.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">{cards.filter((c) => c.status === 'presente').length}</span>
            <span className="text-muted-foreground">presentes</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="font-medium">{cards.filter((c) => c.status === 'atrasado').length}</span>
            <span className="text-muted-foreground">atrasados</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground ml-auto">
            Últimos {cards.length} registros
          </span>
        </div>
      )}

      {/* Cards grid */}
      {cards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card, i) => {
            const sc = statusCfg[card.status];
            return (
              <Card
                key={card.id}
                className={`overflow-hidden transition-all duration-500 ${
                  i === 0 ? 'ring-2 ring-primary/40 shadow-md' : ''
                }`}
              >
                <CardContent className="p-4 flex gap-4 items-center">
                  <Avatar className="h-14 w-14 shrink-0 rounded-xl">
                    <AvatarImage
                      src={card.avatarUrl || ''}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-base">
                      {getInitials(card.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold text-sm text-foreground truncate leading-tight">
                      {card.nome}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {card.matricula}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sc.className}`}>
                        {sc.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {card.horario}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <Card>
          <CardContent className="py-20 flex flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-primary/5 border-2 border-dashed border-primary/20 flex items-center justify-center">
                <Radio className="h-8 w-8 text-primary/40" />
              </div>
              {connStatus === 'connected' && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
              )}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {connStatus === 'connected'
                  ? 'Aguardando registros…'
                  : connStatus === 'disconnected'
                  ? 'Servidor local offline'
                  : 'Conectando ao servidor…'}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {connStatus === 'connected'
                  ? 'Os registros aparecerão aqui assim que um aluno passar no terminal.'
                  : connStatus === 'disconnected'
                  ? 'Inicie o servidor com: cd servidor && node server.js'
                  : 'Verifique se o servidor local está rodando na porta 3000.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
