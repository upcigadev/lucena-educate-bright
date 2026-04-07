import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, MessageSquare } from 'lucide-react';
import { db } from '@/lib/mock-db';
import { useAuthStore } from '@/stores/authStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notificacao {
  id: string;
  remetente_id: string;
  destinatario_id: string;
  titulo: string;
  mensagem: string;
  lida: number;
  data_envio: string;
  remetente_nome: string;
}

export function NotificationBell() {
  const { perfil } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [unread, setUnread] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!perfil?.id) return;
    try {
      const [listRes, countRes] = await Promise.all([
        db.notificacoes.listByDestinatario(perfil.id),
        db.notificacoes.countUnread(perfil.id),
      ]);
      setNotificacoes((listRes.data || []) as Notificacao[]);
      setUnread((countRes.data as number) || 0);
    } catch (e) {
      console.warn('Erro ao carregar notificações:', e);
    }
  }, [perfil?.id]);

  // Load on mount and poll every 30s
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Reload when popover opens
  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  const handleMarkRead = async (notif: Notificacao) => {
    if (notif.lida === 1) return;
    await db.notificacoes.markAsRead(notif.id);
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, lida: 1 } : n))
    );
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    if (!perfil?.id) return;
    setMarkingAll(true);
    try {
      await db.notificacoes.markAllAsRead(perfil.id);
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: 1 })));
      setUnread(0);
    } finally {
      setMarkingAll(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notificações</span>
            {unread > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {unread}
              </Badge>
            )}
          </div>
          {unread > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
              onClick={handleMarkAll}
              disabled={markingAll}
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas
            </button>
          )}
        </div>

        {/* List */}
        {notificacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-4">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Sem notificações</p>
            <p className="text-xs text-muted-foreground">As mensagens recebidas aparecerão aqui</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="flex flex-col">
              {notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  className={cn(
                    'flex flex-col gap-0.5 text-left px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-muted/50',
                    n.lida === 0 && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn('text-sm leading-tight', n.lida === 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
                      {n.titulo}
                    </span>
                    {n.lida === 0 && (
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.mensagem}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground/70">De: {n.remetente_nome}</span>
                    <span className="text-[10px] text-muted-foreground/70">{formatDate(n.data_envio)}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
