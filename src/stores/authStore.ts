import { create } from 'zustand';

export type Papel = 'SECRETARIA' | 'DIRETOR' | 'PROFESSOR' | 'RESPONSAVEL' | 'secretaria' | string;

export interface User {
  id: string;
  cpf: string;
  name: string;
  role: Papel;
  nome?: string; // backward compat with components
}

interface AuthState {
  user: User | null;
  perfil: User | null;
  escolaAtiva: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setPerfil: (perfil: User | null) => void;
  setEscolaAtiva: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  loadPerfil: (authId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  perfil: null,
  escolaAtiva: localStorage.getItem('escola_ativa'),
  loading: false,
  setUser: (user) => set({ user, perfil: user }),
  setPerfil: (perfil) => set({ perfil }),
  setEscolaAtiva: (id) => {
    if (id) localStorage.setItem('escola_ativa', id);
    else localStorage.removeItem('escola_ativa');
    set({ escolaAtiva: id });
  },
  setLoading: (loading) => set({ loading }),
  logout: async () => {
    localStorage.removeItem('escola_ativa');
    set({ user: null, perfil: null, escolaAtiva: null });
  },
  loadPerfil: async (authId: string) => {
    // Offline version ignores this since login already sets perfil
  },
}));
