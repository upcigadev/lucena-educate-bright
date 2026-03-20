import { supabase } from '@/integrations/supabase/client';

interface CriarUsuarioPayload {
  nome: string;
  cpf: string;
  email?: string;
  papel: 'SECRETARIA' | 'DIRETOR' | 'PROFESSOR' | 'RESPONSAVEL';
  senha?: string;
  escola_id?: string;
  escolas_ids?: string[];
  telefone?: string;
}

interface CriarUsuarioResponse {
  success: boolean;
  usuario_id: string;
  auth_id: string;
  email_login: string;
  senha_temporaria: string;
  papel: string;
  role_record: any;
  error?: string;
}

export async function criarUsuario(payload: CriarUsuarioPayload): Promise<CriarUsuarioResponse> {
  const { data, error } = await supabase.functions.invoke('criar-usuario', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Erro ao chamar Edge Function');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as CriarUsuarioResponse;
}
