import { Link, useLocation } from 'react-router-dom';
import {
  School, Users, GraduationCap, BookOpen, UserCheck, UserCog,
  LayoutDashboard, ClipboardList, Baby, X, Menu, CalendarDays, Wifi
} from 'lucide-react';
import { useAuthStore, type Papel } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const menuByPapel: Record<Papel, NavItem[]> = {
  SECRETARIA: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Escolas', href: '/escolas', icon: School },
    { label: 'Diretores', href: '/diretores', icon: UserCog },
    { label: 'Professores', href: '/professores', icon: GraduationCap },
    { label: 'Alunos', href: '/alunos', icon: Users },
    { label: 'Responsáveis', href: '/responsaveis', icon: Baby },
    { label: 'Frequência', href: '/frequencia', icon: CalendarDays },
    { label: 'Chamada Turma', href: '/frequencia-turma', icon: ClipboardList },
    { label: 'Config. IoT', href: '/iot-config', icon: Wifi },
    { label: 'Justificativas', href: '/justificativas', icon: ClipboardList },
  ],
  DIRETOR: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Séries e Turmas', href: '/series', icon: BookOpen },
    { label: 'Alunos', href: '/alunos', icon: Users },
    { label: 'Frequência', href: '/frequencia', icon: CalendarDays },
    { label: 'Justificativas', href: '/justificativas', icon: ClipboardList },
  ],
  PROFESSOR: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Minhas Turmas', href: '/turmas', icon: BookOpen },
    { label: 'Alunos', href: '/alunos', icon: Users },
    { label: 'Frequência', href: '/frequencia', icon: CalendarDays },
  ],
  RESPONSAVEL: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Meus Alunos', href: '/alunos', icon: Users },
    { label: 'Justificativas', href: '/justificativas', icon: ClipboardList },
  ],
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: Props) {
  const { perfil } = useAuthStore();
  const location = useLocation();
  const items = perfil ? menuByPapel[perfil.papel] : [];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 md:translate-x-0 md:static md:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <School className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              Lucena Educacional
            </span>
          </Link>
          <button className="md:hidden text-sidebar-muted hover:text-sidebar-foreground" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((item) => {
            const active = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-xs text-sidebar-muted truncate">{perfil?.nome}</p>
          <p className="text-[11px] text-sidebar-muted/60 truncate">{perfil?.papel}</p>
        </div>
      </aside>
    </>
  );
}
