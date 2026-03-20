import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { EscolaSelectorHeader } from '@/components/layout/EscolaSelectorHeader';

interface Props {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: Props) {
  const { perfil, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>
        <EscolaSelectorHeader />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 text-sm font-medium">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {perfil?.nome?.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:inline">{perfil?.nome}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={logout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
