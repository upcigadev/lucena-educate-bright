import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type Papel = 'SECRETARIA' | 'DIRETOR' | 'PROFESSOR' | 'RESPONSAVEL';

export interface UsuarioPerfil {
  id: string;
  email: string | null;
  nome: string;
  cpf: string;
  papel: Papel;
  ativo: boolean;
  auth_id: string;
}

interface AuthState {
  user: User | null;
  perfil: UsuarioPerfil | null;
  escolaAtiva: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setPerfil: (perfil: UsuarioPerfil | null) => void;
  setEscolaAtiva: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  loadPerfil: (authId: string) => Promise<void>;
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
    await supabase.auth.signOut();
    localStorage.removeItem('escola_ativa');
    set({ user: null, perfil: null, escolaAtiva: null });
  },
  loadPerfil: async (authId: string) => {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_id', authId)
      .eq('ativo', true)
      .single();
    if (data) {
      set({ perfil: data as unknown as UsuarioPerfil });
    }
  },
}));
