import { Link, useLocation } from 'react-router-dom';
import {
  School, Users, GraduationCap, BookOpen, UserCheck, UserCog,
  LayoutDashboard, ClipboardList, Baby, X, ChevronLeft, ChevronRight, Wifi, Radio
} from 'lucide-react';
import { useAuthStore, type Papel } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
    { label: 'Chamada do Dia', href: '/frequencia', icon: Radio },
    { label: 'Config. IoT', href: '/iot-config', icon: Wifi },
    { label: 'Justificativas', href: '/justificativas', icon: ClipboardList },
  ],
  DIRETOR: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Minha Escola', href: '/minha-escola', icon: School },
    { label: 'Professores', href: '/professores', icon: GraduationCap },
    { label: 'Alunos', href: '/alunos', icon: Users },
    { label: 'Chamada do Dia', href: '/frequencia', icon: Radio },
    { label: 'Justificativas', href: '/justificativas', icon: ClipboardList },
  ],
  PROFESSOR: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Minhas Turmas', href: '/minhas-turmas', icon: BookOpen },
    { label: 'Alunos', href: '/alunos', icon: Users },
  ],
  RESPONSAVEL: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Meus Filhos', href: '/meus-filhos', icon: Users },
    { label: 'Justificativas', href: '/justificativas', icon: ClipboardList },
  ],
};

interface Props {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function AppSidebar({ open, onClose, collapsed, onToggleCollapse }: Props) {
  const { perfil, escolaAtiva } = useAuthStore();
  const location = useLocation();
  const items = perfil ? menuByPapel[perfil.papel].map(item => {
    if (item.label === 'Minha Escola' && escolaAtiva) {
      return { ...item, href: `/escolas/${escolaAtiva}` };
    }
    return item;
  }) : [];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out md:static md:z-auto',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex h-16 items-center border-b border-sidebar-border shrink-0',
          collapsed ? 'justify-center px-2' : 'justify-between px-5'
        )}>
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                <School className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                Lucena Educacional
              </span>
            </Link>
          )}
          {collapsed && (
            <Link to="/dashboard" onClick={onClose}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <School className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
            </Link>
          )}
          <button className="md:hidden text-sidebar-muted hover:text-sidebar-foreground" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((item) => {
            const active = location.pathname.startsWith(item.href);
            const linkContent = (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  collapsed && 'justify-center px-0'
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && item.label}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t border-sidebar-border px-4 py-3 shrink-0">
            <p className="text-xs text-sidebar-muted truncate">{perfil?.nome}</p>
            <p className="text-[11px] text-sidebar-muted/60 truncate">{perfil?.papel}</p>
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>
    </>
  );
}
