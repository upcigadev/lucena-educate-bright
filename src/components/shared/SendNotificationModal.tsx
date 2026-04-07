import { useState } from 'react';
import { db } from '@/lib/mock-db';
import { useAuthStore } from '@/stores/authStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, User } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Usuário destino da notificação */
  destinatarioId: string;
  destinatarioNome: string;
  /** Título pré-preenchido (opcional) */
  defaultTitulo?: string;
}

export function SendNotificationModal({
  open,
  onClose,
  destinatarioId,
  destinatarioNome,
  defaultTitulo = '',
}: Props) {
  const { perfil } = useAuthStore();
  const [titulo, setTitulo] = useState(defaultTitulo);
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);

  const reset = () => {
    setTitulo(defaultTitulo);
    setMensagem('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = async () => {
    if (!perfil) return;
    if (!titulo.trim()) {
      toast.error('O título é obrigatório.');
      return;
    }
    if (!mensagem.trim()) {
      toast.error('A mensagem é obrigatória.');
      return;
    }

    setSending(true);
    try {
      await db.notificacoes.insert({
        remetente_id: perfil.id,
        destinatario_id: destinatarioId,
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
      });
      toast.success(`Notificação enviada para ${destinatarioNome}!`);
      handleClose();
    } catch (err) {
      toast.error('Erro ao enviar notificação.');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar Notificação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Destinatário */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 border px-3 py-2.5">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Para</p>
              <p className="text-sm font-medium text-foreground">{destinatarioNome}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-titulo">Título *</Label>
            <Input
              id="notif-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Informação sobre frequência"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground text-right">{titulo.length}/120</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-mensagem">Mensagem *</Label>
            <Textarea
              id="notif-mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Escreva a sua mensagem aqui…"
              rows={4}
              maxLength={600}
            />
            <p className="text-xs text-muted-foreground text-right">{mensagem.length}/600</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={sending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSend} disabled={sending} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
