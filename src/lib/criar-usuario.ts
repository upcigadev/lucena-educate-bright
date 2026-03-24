// TODO: Replace with actual SQLite user creation logic

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
  // TODO: Implement actual user creation with SQLite
  console.log('TODO: criarUsuario', payload);
  
  const id = crypto.randomUUID();
  return {
    success: true,
    usuario_id: id,
    auth_id: id,
    email_login: `${payload.cpf}@sistema.local`,
    senha_temporaria: 'temp1234',
    papel: payload.papel,
    role_record: null,
  };
}
