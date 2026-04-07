import { useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';

const PAPEL_LABELS: Record<string, string> = {
  SECRETARIA: 'Secretaria',
  DIRETOR: 'Diretor(a)',
  PROFESSOR: 'Professor(a)',
  RESPONSAVEL: 'Responsável',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

function resizeImageToBase64(file: File, maxSize = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas não suportado'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar imagem'));
    };

    img.src = url;
  });
}

export function ProfileModal({ open, onClose }: Props) {
  const { user, perfil, updateAvatar } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!perfil) return null;

  const currentAvatar = previewUrl ?? perfil.avatar_url ?? null;
  const initials = perfil.nome
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ficheiro demasiado grande (máx. 10 MB)');
      return;
    }

    setSaving(true);
    try {
      const base64 = await resizeImageToBase64(file);
      setPreviewUrl(base64);
      await updateAvatar(base64);
      toast.success('Foto de perfil atualizada!');
    } catch (err) {
      toast.error('Erro ao processar a imagem. Tente outro ficheiro.');
      console.error(err);
    } finally {
      setSaving(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await updateAvatar(null);
      setPreviewUrl(null);
      toast.success('Foto de perfil removida.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPreviewUrl(null); onClose(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          {/* Avatar grande com overlay de câmera */}
          <div className="relative group">
            <Avatar className="h-28 w-28 ring-4 ring-background shadow-lg">
              <AvatarImage src={currentAvatar ?? ''} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Overlay de upload */}
            <button
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              type="button"
            >
              {saving
                ? <Loader2 className="h-7 w-7 text-white animate-spin" />
                : <Camera className="h-7 w-7 text-white" />
              }
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Info do utilizador */}
          <div className="text-center space-y-1.5">
            <p className="font-semibold text-lg text-foreground leading-tight">{perfil.nome}</p>
            <Badge variant="secondary" className="gap-1.5">
              <User className="h-3 w-3" />
              {PAPEL_LABELS[perfil.papel] ?? perfil.papel}
            </Badge>
            {user?.email && (
              <p className="text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              <Camera className="h-4 w-4" />
              {currentAvatar ? 'Alterar Foto' : 'Adicionar Foto'}
            </Button>
            {currentAvatar && (
              <Button
                variant="outline"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={handleRemove}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            JPG, PNG ou WebP — máx. 10 MB<br />
            Redimensionado automaticamente para 500×500 px
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
