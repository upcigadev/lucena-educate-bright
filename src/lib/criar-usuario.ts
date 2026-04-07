import { supabase } from '@/integrations/supabase/client';
import { db } from './mock-db';

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
  // Check if CPF already exists
  const { data: existing } = await db.usuarios.getByCpf(payload.cpf);
  if (existing) {
    throw new Error('CPF já cadastrado no sistema.');
  }

  // Option A: auto-generate email from CPF + fixed temp password
  const emailLogin = payload.email || `${payload.cpf}@escola.lucena.gov.br`;
  const senhaTemp = payload.senha || 'lucena2025';

  // Create Supabase Auth user (email confirmation should be OFF in Supabase dashboard)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: emailLogin,
    password: senhaTemp,
    options: {
      data: { nome: payload.nome, papel: payload.papel },
    },
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Erro ao criar conta no sistema de autenticação.');
  }

  const authId = authData.user.id;

  const { data: usuario, error: usrError } = await db.usuarios.insert({
    nome: payload.nome,
    cpf: payload.cpf,
    papel: payload.papel,
    auth_id: authId,
  });

  if (usrError || !usuario) {
    throw new Error(usrError?.message || 'Erro ao criar usuário.');
  }

  const usuarioId = (usuario as any).id;

  // Create role-specific record
  if (payload.papel === 'DIRETOR' && payload.escola_id) {
    await db.diretores.insert({ usuario_id: usuarioId, escola_id: payload.escola_id });
  } else if (payload.papel === 'PROFESSOR') {
    const { data: prof } = await db.professores.insert({ usuario_id: usuarioId });
    if (prof && payload.escolas_ids) {
      for (const escolaId of payload.escolas_ids) {
        await db.professorEscolas.insert({ professor_id: (prof as any).id, escola_id: escolaId });
      }
    }
  } else if (payload.papel === 'RESPONSAVEL') {
    await db.responsaveis.insert({ usuario_id: usuarioId, telefone: payload.telefone || null });
  }

  return {
    success: true,
    usuario_id: usuarioId,
    auth_id: authId,
    email_login: emailLogin,
    senha_temporaria: senhaTemp,
    papel: payload.papel,
    role_record: null,
  };
}
