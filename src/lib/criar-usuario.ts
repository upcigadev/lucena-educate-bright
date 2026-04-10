import { db } from './mock-db';

export async function criarUsuario({
  nome,
  cpf,
  papel,
  escola_id
}: {
  nome: string;
  cpf: string;
  papel: string;
  escola_id?: string;
}) {
  // SQLite doesn't need real emails/auth logic
  const resUsuario = await db.usuarios.insert({ nome, cpf, papel });
  if (resUsuario.error) throw new Error(resUsuario.error.message);

  const usuario_id = resUsuario.data.id;

  if (papel === 'DIRETOR' && escola_id) {
    await db.diretores.insert({ usuario_id, escola_id });
  } else if (papel === 'PROFESSOR') {
    await db.professores.insert({ usuario_id });
  } else if (papel === 'RESPONSAVEL') {
    await db.responsaveis.insert({ usuario_id });
  }

  return { email_login: cpf, senha_temporaria: '123456' };
}
