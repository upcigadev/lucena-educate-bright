import { create } from 'zustand';
import { db } from '@/lib/mock-db';

export type Papel = 'SECRETARIA' | 'DIRETOR' | 'PROFESSOR' | 'RESPONSAVEL';

export interface UsuarioPerfil {
  id: string;
  email: string | null;
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
  updateAvatar: (avatarUrl: string | null) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
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
    localStorage.removeItem('auth_user');
    set({ user: null, perfil: null, escolaAtiva: null });
  },
  loadPerfil: async (authId: string) => {
    const { data } = await db.usuarios.getByAuthId(authId);
    if (data) {
      set({ perfil: data as unknown as UsuarioPerfil });
    }
  },
  updateAvatar: async (avatarUrl: string | null) => {
    const state = useAuthStore.getState();
    if (!state.perfil) throw new Error('Sem perfil ativo');
    await db.usuarios.updateAvatar(state.perfil.id, avatarUrl);
    set((s) => ({
      perfil: s.perfil ? { ...s.perfil, avatar_url: avatarUrl } : null,
    }));
  },
}));
