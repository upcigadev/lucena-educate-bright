import { db } from './mock-db';
import { generateId } from './database';

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

  const authId = generateId();

  // Create usuario
  const { data: usuario } = await db.usuarios.insert({
    nome: payload.nome,
    cpf: payload.cpf,
    papel: payload.papel,
    auth_id: authId,
  });

  if (!usuario) throw new Error('Erro ao criar usuário.');

  const usuarioId = usuario.id;

  // Create role-specific record
  if (payload.papel === 'DIRETOR' && payload.escola_id) {
    await db.diretores.insert({ usuario_id: usuarioId, escola_id: payload.escola_id });
  } else if (payload.papel === 'PROFESSOR') {
    const { data: prof } = await db.professores.insert({ usuario_id: usuarioId });
    if (prof && payload.escolas_ids) {
      for (const escolaId of payload.escolas_ids) {
        await db.professorEscolas.insert({ professor_id: prof.id, escola_id: escolaId });
      }
    }
  } else if (payload.papel === 'RESPONSAVEL') {
    await db.responsaveis.insert({ usuario_id: usuarioId, telefone: payload.telefone || null });
  }

  return {
    success: true,
    usuario_id: usuarioId,
    auth_id: authId,
    email_login: `${payload.cpf}@sistema.local`,
    senha_temporaria: 'temp1234',
    papel: payload.papel,
    role_record: null,
  };
}
