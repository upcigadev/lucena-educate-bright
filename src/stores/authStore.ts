import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/mock-db';

export type Papel = 'SECRETARIA' | 'DIRETOR' | 'PROFESSOR' | 'RESPONSAVEL';

export interface UsuarioPerfil {
  id: string;
  nome: string;
  cpf: string;
  papel: Papel;
  ativo: boolean;
  auth_id: string;
  avatar_url?: string | null;
}

export interface AppUser {
  id: string;
  email?: string;
}

interface AuthState {
  user: AppUser | null;
  perfil: UsuarioPerfil | null;
  escolaAtiva: string | null;
  loading: boolean;
  setUser: (user: AppUser | null) => void;
  setPerfil: (perfil: UsuarioPerfil | null) => void;
  setEscolaAtiva: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  loadPerfil: (authId: string) => Promise<void>;
  updateAvatar: (url: string | null) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Subscribe to Supabase auth state changes — runs once at module init
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const u = session.user;
      set({ user: { id: u.id, email: u.email } });

      // Load application profile from custom usuarios table
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_id', u.id)
        .eq('ativo', true)
        .maybeSingle();

      if (perfil) {
        set({ perfil: perfil as unknown as UsuarioPerfil });

        // Auto-set escola for DIRETOR
        if (perfil.papel === 'DIRETOR') {
          const { data: dirs } = await supabase
            .from('diretores')
            .select('escola_id')
            .eq('usuario_id', perfil.id);
          const saved = localStorage.getItem('escola_ativa');
          const escolaId = saved || dirs?.[0]?.escola_id || null;
          if (escolaId) {
            localStorage.setItem('escola_ativa', escolaId);
            set({ escolaAtiva: escolaId });
          }
        }
      }
    } else if (event === 'SIGNED_OUT' || !session) {
      set({ user: null, perfil: null });
    }
    set({ loading: false });
  });

  return {
    user: null,
    perfil: null,
    escolaAtiva: localStorage.getItem('escola_ativa'),
    loading: true,

    setUser: (user) => set({ user }),
    setPerfil: (perfil) => set({ perfil }),
    setEscolaAtiva: (id) => {
      if (id) localStorage.setItem('escola_ativa', id);
      else localStorage.removeItem('escola_ativa');
      set({ escolaAtiva: id });
    },
    setLoading: (loading) => set({ loading }),

    logout: async () => {
      localStorage.removeItem('escola_ativa');
      await supabase.auth.signOut();
      set({ user: null, perfil: null, escolaAtiva: null });
    },

    loadPerfil: async (authId: string) => {
      // Kept for backwards-compat. onAuthStateChange handles it automatically.
      const { data } = await db.usuarios.getByAuthId(authId);
      if (data) set({ perfil: data as unknown as UsuarioPerfil });
    },

    updateAvatar: async (url: string | null) => {
      const { perfil } = get();
      if (!perfil) return;
      await db.usuarios.updateAvatar(perfil.id, url);
      set({ perfil: { ...perfil, avatar_url: url } });
    },
  };
});
