import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Radio, Clock, UserCheck } from 'lucide-react';
import { db } from '@/lib/mock-db';

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
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');
  const [cards, setCards] = useState<AccessCard[]>([]);

  // Buffer received photos until the matching log arrives (or vice-versa)
  const photoBuffer = useRef<Map<string, string>>(new Map()); // userId → dataUri
  const socketRef = useRef<Socket | null>(null);

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
          const { data: alunos } = await db.alunos.list();
          const allAlunos = alunos || [];

          for (const log of rows) {
            const logUserId = log?.user_id != null ? String(log.user_id) : null;
            if (!logUserId) continue;

            const aluno = allAlunos.find(
              (a) =>
                String(a.matricula) === logUserId ||
                (a.idface_user_id != null && String(a.idface_user_id) === logUserId)
            );

            const horario = nowHMS();
            const [hh, mm] = horario.split(':').map(Number);
            const nowMin = hh * 60 + mm;

            const limiteMin = timeToMin((aluno as any)?.limite_max);
            const fimMin = timeToMin((aluno as any)?.horario_fim);
            const status: AccessCard['status'] =
              !aluno
                ? 'acesso'
                : limiteMin != null && nowMin > limiteMin
                ? 'acesso' // past cutoff — mark as generic access
                : fimMin != null && nowMin > fimMin
                ? 'atrasado'
                : 'presente';

            const photo = photoBuffer.current.get(logUserId) ?? aluno?.avatar_url ?? null;

            const card: AccessCard = {
              id: `${logUserId}-${Date.now()}`,
              nome: aluno?.nome_completo ?? `Matrícula ${logUserId}`,
              matricula: aluno?.matricula ?? logUserId,
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
