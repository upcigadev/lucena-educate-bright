import { toast } from 'sonner';

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
  const defaultPassword = payload.senha || '123456';
  
  const res = await window.electronAPI.createUser({
    cpf: payload.cpf,
    name: payload.nome,
    role: payload.papel.toLowerCase(),
    password: defaultPassword
  });

  if (!res.success) {
    if (res.error?.includes('UNIQUE')) {
      throw new Error('CPF já cadastrado.');
    }
    throw new Error(res.error || 'Erro ao criar usuário');
  }

  return {
    success: true,
    usuario_id: res.data?.id,
    auth_id: res.data?.id,
    email_login: payload.cpf,
    senha_temporaria: defaultPassword,
    papel: payload.papel,
    role_record: {}
  };
}
