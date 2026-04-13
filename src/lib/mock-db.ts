// SQLite-backed data access layer
import { query, run, generateId, persist } from './database';

export interface DbResponse<T> {
  data: T | null;
  error: null | { message: string };
  count?: number;
}

function ok<T>(data: T, count?: number): DbResponse<T> {
  return { data, error: null, count };
}

function err<T>(message: string): DbResponse<T> {
  return { data: null, error: { message } };
}

// ===== Database API =====

export const db = {
  escolas: {
    list: async () => {
      const rows = await query('SELECT * FROM escolas ORDER BY nome');
      return ok(rows);
    },
    getById: async (id: string) => {
      const rows = await query('SELECT * FROM escolas WHERE id = ?', [id]);
      return ok(rows[0] || null);
    },
    insert: async (data: { nome: string; inep?: string | null; endereco?: string | null; telefone?: string | null }) => {
      const id = generateId();
      await run('INSERT INTO escolas (id, nome, inep, endereco, telefone) VALUES (?, ?, ?, ?, ?)',
        [id, data.nome, data.inep || null, data.endereco || null, data.telefone || null]);
      return ok({ id });
    },
    update: async (id: string, data: { nome?: string; inep?: string | null; endereco?: string | null; telefone?: string | null; horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const sets: string[] = [];
      const vals: any[] = [];
      if (data.nome !== undefined) { sets.push('nome = ?'); vals.push(data.nome); }
      if (data.inep !== undefined) { sets.push('inep = ?'); vals.push(data.inep); }
      if (data.endereco !== undefined) { sets.push('endereco = ?'); vals.push(data.endereco); }
      if (data.telefone !== undefined) { sets.push('telefone = ?'); vals.push(data.telefone); }
      if (data.horario_inicio !== undefined) { sets.push('horario_inicio = ?'); vals.push(data.horario_inicio); }
      if (data.tolerancia_min !== undefined) { sets.push('tolerancia_min = ?'); vals.push(data.tolerancia_min); }
      if (data.limite_max !== undefined) { sets.push('limite_max = ?'); vals.push(data.limite_max); }
      if (sets.length > 0) {
        vals.push(id);
        await run(`UPDATE escolas SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
      return ok(null);
    },
    /** Propagate schedule to all series and turmas of a school */
    applyScheduleToAll: async (escolaId: string, horario_inicio: string | null, tolerancia_min: number | null, limite_max: string | null) => {
      await run('UPDATE series SET horario_inicio = ?, tolerancia_min = ?, limite_max = ? WHERE escola_id = ?',
        [horario_inicio, tolerancia_min, limite_max, escolaId]);
      await run('UPDATE turmas SET horario_inicio = ?, tolerancia_min = ?, limite_max = ? WHERE escola_id = ?',
        [horario_inicio, tolerancia_min, limite_max, escolaId]);
      return ok(null);
    },
  },

  series: {
    listByEscola: async (escolaId: string) => {
      const rows = await query('SELECT * FROM series WHERE escola_id = ? ORDER BY nome', [escolaId]);
      return ok(rows);
    },
    insert: async (data: { nome: string; escola_id: string; horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const id = generateId();
      await run('INSERT INTO series (id, nome, escola_id, horario_inicio, tolerancia_min, limite_max) VALUES (?, ?, ?, ?, ?, ?)',
        [id, data.nome, data.escola_id, data.horario_inicio || '07:00', data.tolerancia_min ?? 15, data.limite_max || '07:30']);
      return ok({ id });
    },
    update: async (id: string, data: { horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const sets: string[] = [];
      const vals: any[] = [];
      if (data.horario_inicio !== undefined) { sets.push('horario_inicio = ?'); vals.push(data.horario_inicio); }
      if (data.tolerancia_min !== undefined) { sets.push('tolerancia_min = ?'); vals.push(data.tolerancia_min); }
      if (data.limite_max !== undefined) { sets.push('limite_max = ?'); vals.push(data.limite_max); }
      if (sets.length > 0) { vals.push(id); await run(`UPDATE series SET ${sets.join(', ')} WHERE id = ?`, vals); }
      return ok(null);
    },
    delete: async (serieId: string) => {
      // Get all turmas in this serie
      const turmasNaSerie = await query<{ id: string }>('SELECT id FROM turmas WHERE serie_id = ?', [serieId]);
      // For each turma: unassign students and remove professor links, then delete the turma
      for (const turma of turmasNaSerie) {
        await run('UPDATE alunos SET turma_id = NULL WHERE turma_id = ?', [turma.id]);
        await run('DELETE FROM turma_professores WHERE turma_id = ?', [turma.id]);
        await run('DELETE FROM turmas WHERE id = ?', [turma.id]);
      }
      // Finally delete the serie
      await run('DELETE FROM series WHERE id = ?', [serieId]);
      return ok(null);
    },
  },

  turmas: {
    listByEscola: async (escolaId: string) => {
      const rows = await query('SELECT * FROM turmas WHERE escola_id = ? ORDER BY nome', [escolaId]);
      return ok(rows);
    },
    listByProfessor: async (usuarioId: string) => {
      const rows = await query(`
        SELECT t.*, s.nome as serie_nome, e.nome as escola_nome
        FROM turmas t
        JOIN turma_professores tp ON t.id = tp.turma_id
        JOIN professores p ON tp.professor_id = p.id
        LEFT JOIN series s ON t.serie_id = s.id
        LEFT JOIN escolas e ON t.escola_id = e.id
        WHERE p.usuario_id = ?
        ORDER BY t.nome
      `, [usuarioId]);
      return ok(rows);
    },
    listAll: async () => {
      const rows = await query('SELECT * FROM turmas ORDER BY nome');
      return ok(rows);
    },
    getById: async (id: string) => {
      const rows = await query('SELECT * FROM turmas WHERE id = ?', [id]);
      return ok(rows[0] || null);
    },
    insert: async (data: { nome: string; serie_id: string; escola_id: string; sala?: string | null; horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      // Block duplicates: same name in same school
      const dup = await query<{ id: string }>(
        'SELECT id FROM turmas WHERE nome = ? AND escola_id = ? LIMIT 1',
        [data.nome, data.escola_id]
      );
      if (dup.length > 0) {
        throw new Error(`Turma "${data.nome}" já existe nesta escola.`);
      }
      const id = generateId();
      await run('INSERT INTO turmas (id, nome, serie_id, escola_id, sala, horario_inicio, tolerancia_min, limite_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.nome, data.serie_id, data.escola_id, data.sala || null, data.horario_inicio || null, data.tolerancia_min ?? null, data.limite_max || null]);
      return ok({ id });
    },
    update: async (id: string, data: { nome?: string; sala?: string | null; horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const sets: string[] = [];
      const vals: any[] = [];
      if (data.nome !== undefined) { sets.push('nome = ?'); vals.push(data.nome); }
      if (data.sala !== undefined) { sets.push('sala = ?'); vals.push(data.sala); }
      if (data.horario_inicio !== undefined) { sets.push('horario_inicio = ?'); vals.push(data.horario_inicio); }
      if (data.tolerancia_min !== undefined) { sets.push('tolerancia_min = ?'); vals.push(data.tolerancia_min); }
      if (data.limite_max !== undefined) { sets.push('limite_max = ?'); vals.push(data.limite_max); }
      if (sets.length > 0) {
        vals.push(id);
        await run(`UPDATE turmas SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
      return ok(null);
    },
    delete: async (id: string) => {
      // Unassign students from this turma
      await run('UPDATE alunos SET turma_id = NULL WHERE turma_id = ?', [id]);
      // Remove professor links
      await run('DELETE FROM turma_professores WHERE turma_id = ?', [id]);
      // Delete the turma itself
      await run('DELETE FROM turmas WHERE id = ?', [id]);
      return ok(null);
    },
  },

  alunos: {
    list: async () => {
      const rows = await query(`
        SELECT a.*, 
          COALESCE(t.nome, 'Sem turma') as turma_nome,
          COALESCE(s.nome, '') as serie_nome,
          COALESCE(e.nome, '') as escola_nome
        FROM alunos a
        LEFT JOIN turmas t ON a.turma_id = t.id
        LEFT JOIN series s ON t.serie_id = s.id
        LEFT JOIN escolas e ON a.escola_id = e.id
        WHERE a.ativo = 1
        ORDER BY a.nome_completo
      `);
      return ok(rows);
    },
    getAlunoComResponsaveis: async (alunoId: string) => {
      // First get the student and school info
      const alunoRows = await query(`
        SELECT a.nome_completo as aluno_nome, e.nome as escola_nome
        FROM alunos a
        LEFT JOIN escolas e ON a.escola_id = e.id
        WHERE a.id = ? AND a.ativo = 1
      `, [alunoId]);

      if (alunoRows.length === 0) return ok(null);
      const aluno = alunoRows[0];

      // Now get the parents
      const respRows = await query(`
        SELECT u.nome, r.telefone
        FROM aluno_responsaveis ar
        JOIN responsaveis r ON ar.responsavel_id = r.id
        JOIN usuarios u ON r.usuario_id = u.id AND u.ativo = 1
        WHERE ar.aluno_id = ?
      `, [alunoId]);

      const responsaveis = respRows.map(r => ({
        nome: r.nome as string,
        telefone: (r.telefone as string) || ''
      }));

      return ok({
        aluno_nome: aluno.aluno_nome as string,
        escola_nome: aluno.escola_nome as string,
        responsaveis
      });
    },
    listByTurma: async (turmaId: string) => {
      const rows = await query('SELECT * FROM alunos WHERE turma_id = ? AND ativo = 1 ORDER BY nome_completo', [turmaId]);
      return ok(rows);
    },
    listByResponsavelUsuarioId: async (usuarioId: string) => {
      const rows = await query(`
        SELECT a.*,
          COALESCE(t.nome, 'Sem turma') as turma_nome,
          COALESCE(s.nome, '') as serie_nome,
          COALESCE(e.nome, '') as escola_nome,
          ar.parentesco
        FROM alunos a
        JOIN aluno_responsaveis ar ON ar.aluno_id = a.id
        JOIN responsaveis r ON ar.responsavel_id = r.id
        LEFT JOIN turmas t ON a.turma_id = t.id
        LEFT JOIN series s ON t.serie_id = s.id
        LEFT JOIN escolas e ON a.escola_id = e.id
        WHERE r.usuario_id = ? AND a.ativo = 1
        ORDER BY a.nome_completo
      `, [usuarioId]);
      return ok(rows);
    },
    listByEscola: async (escolaId: string) => {
      const rows = await query(`
        SELECT a.*, 
          COALESCE(t.nome, 'Sem turma') as turma_nome,
          COALESCE(s.nome, '') as serie_nome,
          COALESCE(e.nome, '') as escola_nome
        FROM alunos a
        LEFT JOIN turmas t ON a.turma_id = t.id
        LEFT JOIN series s ON t.serie_id = s.id
        LEFT JOIN escolas e ON a.escola_id = e.id
        WHERE a.escola_id = ? AND a.ativo = 1
        ORDER BY a.nome_completo
      `, [escolaId]);
      return ok(rows);
    },
    listByProfessorUsuarioId: async (usuarioId: string) => {
      const rows = await query(`
        SELECT DISTINCT a.*, 
          COALESCE(t.nome, 'Sem turma') as turma_nome,
          COALESCE(s.nome, '') as serie_nome,
          COALESCE(e.nome, '') as escola_nome
        FROM alunos a
        JOIN turma_professores tp ON a.turma_id = tp.turma_id
        JOIN professores p ON tp.professor_id = p.id
        LEFT JOIN turmas t ON a.turma_id = t.id
        LEFT JOIN series s ON t.serie_id = s.id
        LEFT JOIN escolas e ON a.escola_id = e.id
        WHERE p.usuario_id = ? AND a.ativo = 1
        ORDER BY a.nome_completo
      `, [usuarioId]);
      return ok(rows);
    },
    countByEscola: async (escolaId: string) => {
      const rows = await query<{ c: number }>('SELECT COUNT(*) as c FROM alunos WHERE escola_id = ? AND ativo = 1', [escolaId]);
      return ok(rows[0]?.c || 0);
    },
    insert: async (data: { nome_completo: string; matricula: string; data_nascimento?: string | null; escola_id: string; turma_id?: string | null; horario_inicio?: string | null; horario_fim?: string | null; limite_max?: string | null; idface_user_id?: string | null; avatar_url?: string | null }) => {
      // Upsert: se já existir um aluno com essa matrícula (mesmo inativo), reativa e atualiza.
      const existing = await query<{ id: string }>('SELECT id FROM alunos WHERE matricula = ? LIMIT 1', [data.matricula]);
      if (existing.length > 0) {
        const id = existing[0].id;
        await run(
          `UPDATE alunos SET nome_completo=?, data_nascimento=?, escola_id=?, turma_id=?,
           horario_inicio=?, horario_fim=?, limite_max=?, idface_user_id=?, avatar_url=?, ativo=1
           WHERE id=?`,
          [
            data.nome_completo,
            data.data_nascimento || null,
            data.escola_id,
            data.turma_id || null,
            data.horario_inicio || null,
            data.horario_fim || null,
            data.limite_max || null,
            data.idface_user_id || null,
            data.avatar_url || null,
            id,
          ]
        );
        return ok({ id });
      }
      const id = generateId();
      await run(
        'INSERT INTO alunos (id, nome_completo, matricula, data_nascimento, escola_id, turma_id, horario_inicio, horario_fim, limite_max, idface_user_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          data.nome_completo,
          data.matricula,
          data.data_nascimento || null,
          data.escola_id,
          data.turma_id || null,
          data.horario_inicio || null,
          data.horario_fim || null,
          data.limite_max || null,
          data.idface_user_id || null,
          data.avatar_url || null,
        ]
      );
      return ok({ id });
    },
    update: async (id: string, data: { nome_completo?: string; data_nascimento?: string | null; turma_id?: string | null; escola_id?: string; horario_inicio?: string | null; horario_fim?: string | null; limite_max?: string | null; idface_user_id?: string | null; avatar_url?: string | null }) => {
      const sets: string[] = [];
      const vals: any[] = [];
      if (data.nome_completo !== undefined) { sets.push('nome_completo = ?'); vals.push(data.nome_completo); }
      if (data.data_nascimento !== undefined) { sets.push('data_nascimento = ?'); vals.push(data.data_nascimento); }
      if (data.turma_id !== undefined) { sets.push('turma_id = ?'); vals.push(data.turma_id); }
      if (data.escola_id !== undefined) { sets.push('escola_id = ?'); vals.push(data.escola_id); }
      if (data.horario_inicio !== undefined) { sets.push('horario_inicio = ?'); vals.push(data.horario_inicio); }
      if (data.horario_fim !== undefined) { sets.push('horario_fim = ?'); vals.push(data.horario_fim); }
      if (data.limite_max !== undefined) { sets.push('limite_max = ?'); vals.push(data.limite_max); }
      if (data.idface_user_id !== undefined) { sets.push('idface_user_id = ?'); vals.push(data.idface_user_id); }
      if (data.avatar_url !== undefined) { sets.push('avatar_url = ?'); vals.push(data.avatar_url); }
      if (sets.length > 0) {
        vals.push(id);
        await run(`UPDATE alunos SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
      return ok(null);
    },
    getByMatricula: async (matricula: string, escolaId?: string) => {
      const rows = await query(
        `SELECT * FROM alunos WHERE matricula = ? AND ativo = 1 AND (${escolaId ? 'escola_id = ?' : '1=1'}) LIMIT 1`,
        escolaId ? [matricula, escolaId] : [matricula]
      );
      return ok(rows[0] || null);
    },
    // Soft-delete: seta ativo = 0. Nunca deleta fisicamente.
    deactivate: async (id: string) => {
      await run('UPDATE alunos SET ativo = 0 WHERE id = ?', [id]);
      return ok(null);
    },
    getByDeviceUserIds: async (userIds: string[]) => {
      if (!userIds || userIds.length === 0) return ok([]);
      const placeholders = userIds.map(() => '?').join(',');
      const rows = await query(`
        SELECT a.*, 
          COALESCE(t.nome, 'Sem turma') as turma_nome,
          COALESCE(s.nome, '') as serie_nome,
          COALESCE(e.nome, '') as escola_nome
        FROM alunos a
        LEFT JOIN turmas t ON a.turma_id = t.id
        LEFT JOIN series s ON t.serie_id = s.id
        LEFT JOIN escolas e ON a.escola_id = e.id
        WHERE a.ativo = 1 AND (a.matricula IN (${placeholders}) OR a.idface_user_id IN (${placeholders}))
      `, [...userIds, ...userIds]);
      return ok(rows);
    },
  },

  usuarios: {
    getByAuthId: async (authId: string) => {
      const rows = await query('SELECT * FROM usuarios WHERE auth_id = ? AND ativo = 1', [authId]);
      return ok(rows[0] || null);
    },
    getByCpf: async (cpf: string) => {
      const rows = await query('SELECT * FROM usuarios WHERE cpf = ? AND ativo = 1', [cpf]);
      return ok(rows[0] || null);
    },
    insert: async (data: { nome: string; cpf: string; papel: string; auth_id?: string; email?: string | null }) => {
      const id = generateId();
      const authId = data.auth_id || generateId();
      await run('INSERT INTO usuarios (id, nome, cpf, papel, auth_id, email) VALUES (?, ?, ?, ?, ?, ?)',
        [id, data.nome, data.cpf, data.papel, authId, data.email || null]);
      return ok({ id, auth_id: authId });
    },
    update: async (id: string, data: { nome?: string; ativo?: boolean }) => {
      const sets: string[] = [];
      const vals: any[] = [];
      if (data.nome !== undefined) { sets.push('nome = ?'); vals.push(data.nome); }
      if (data.ativo !== undefined) { sets.push('ativo = ?'); vals.push(data.ativo ? 1 : 0); }
      if (sets.length > 0) {
        vals.push(id);
        await run(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
      return ok(null);
    },
    updateAvatar: async (id: string, avatarUrl: string | null) => {
       await run('UPDATE usuarios SET avatar_url = ? WHERE id = ?', [avatarUrl, id]);
       return ok(null);
    },
    // Soft-delete: inativa o usuário sem remover do banco
    deactivate: async (id: string) => {
      await run("UPDATE usuarios SET ativo = 0 WHERE id = ?", [id]);
      return ok(null);
    },
  },

  diretores: {
    list: async () => {
      const rows = await query(`
        SELECT d.*, u.nome, u.cpf, u.avatar_url, e.nome as escola_nome
        FROM diretores d
        JOIN usuarios u ON d.usuario_id = u.id AND u.ativo = 1
        JOIN escolas e ON d.escola_id = e.id
        ORDER BY u.nome
      `);
      return ok(rows);
    },
    insert: async (data: { usuario_id: string; escola_id: string }) => {
      const id = generateId();
      await run('INSERT INTO diretores (id, usuario_id, escola_id) VALUES (?, ?, ?)', [id, data.usuario_id, data.escola_id]);
      return ok({ id });
    },
    update: async (id: string, data: { escola_id?: string }) => {
      if (data.escola_id) {
        await run('UPDATE diretores SET escola_id = ? WHERE id = ?', [data.escola_id, id]);
      }
      return ok(null);
    },
    // Soft-delete: inativa o usuário vinculado
    deactivate: async (diretorId: string) => {
      const rows = await query<{ usuario_id: string }>('SELECT usuario_id FROM diretores WHERE id = ?', [diretorId]);
      if (rows[0]?.usuario_id) {
        await run('UPDATE usuarios SET ativo = 0 WHERE id = ?', [rows[0].usuario_id]);
      }
      return ok(null);
    },
    listByUsuario: async (usuarioId: string) => {
      const rows = await query(`
        SELECT d.escola_id, e.id, e.nome, e.inep, e.endereco, e.telefone
        FROM diretores d
        JOIN escolas e ON d.escola_id = e.id
        WHERE d.usuario_id = ?
      `, [usuarioId]);
      return ok(rows.map(r => ({ escola_id: r.escola_id, escolas: { id: r.id, nome: r.nome, inep: r.inep, endereco: r.endereco, telefone: r.telefone } })));
    },
    getByEscola: async (escolaId: string) => {
      const rows = await query(`
        SELECT u.nome FROM diretores d JOIN usuarios u ON d.usuario_id = u.id WHERE d.escola_id = ?
      `, [escolaId]);
      return ok(rows[0] || null);
    },
    getByEscolaComUsuarioId: async (escolaId: string) => {
      const rows = await query<{ nome: string; usuario_id: string }>(`
        SELECT u.nome, u.id as usuario_id
        FROM diretores d
        JOIN usuarios u ON d.usuario_id = u.id AND u.ativo = 1
        WHERE d.escola_id = ?
        LIMIT 1
      `, [escolaId]);
      return ok(rows[0] || null);
    },
  },

  professores: {
    list: async () => {
      const rows = await query(`
        SELECT p.id, p.usuario_id, u.nome, u.cpf, u.avatar_url
        FROM professores p
        JOIN usuarios u ON p.usuario_id = u.id AND u.ativo = 1
        ORDER BY u.nome
      `);
      const result = [];
      for (const prof of rows) {
        const escolas = await query(`
          SELECT e.nome FROM professor_escolas pe JOIN escolas e ON pe.escola_id = e.id WHERE pe.professor_id = ?
        `, [prof.id]);
        const turmas = await query(`
          SELECT t.nome FROM turma_professores tp JOIN turmas t ON tp.turma_id = t.id WHERE tp.professor_id = ?
        `, [prof.id]);
        result.push({ ...prof, escolas: escolas.map(e => e.nome), turmas: turmas.map(t => t.nome) });
      }
      return ok(result);
    },
    listAll: async () => {
      const rows = await query(`
        SELECT p.id, p.usuario_id, u.nome, u.avatar_url
        FROM professores p
        JOIN usuarios u ON p.usuario_id = u.id AND u.ativo = 1
        ORDER BY u.nome
      `);
      return ok(rows);
    },
    listByEscola: async (escolaId: string) => {
      const rows = await query(`
        SELECT p.id, p.usuario_id, u.nome, u.cpf, u.avatar_url
        FROM professores p
        JOIN usuarios u ON p.usuario_id = u.id AND u.ativo = 1
        JOIN professor_escolas pe ON p.id = pe.professor_id
        WHERE pe.escola_id = ?
        ORDER BY u.nome
      `, [escolaId]);
      const result = [];
      for (const prof of rows) {
        const escolas = await query(`
          SELECT e.nome FROM professor_escolas pe JOIN escolas e ON pe.escola_id = e.id WHERE pe.professor_id = ?
        `, [prof.id]);
        const turmas = await query(`
          SELECT t.nome FROM turma_professores tp JOIN turmas t ON tp.turma_id = t.id WHERE tp.professor_id = ?
        `, [prof.id]);
        result.push({ ...prof, escolas: escolas.map(e => e.nome), turmas: turmas.map(t => t.nome) });
      }
      return ok(result);
    },
    insert: async (data: { usuario_id: string }) => {
      const id = generateId();
      await run('INSERT INTO professores (id, usuario_id) VALUES (?, ?)', [id, data.usuario_id]);
      return ok({ id });
    },
    // Soft-delete: inativa o usuário vinculado
    deactivate: async (professorId: string) => {
      const rows = await query<{ usuario_id: string }>('SELECT usuario_id FROM professores WHERE id = ?', [professorId]);
      if (rows[0]?.usuario_id) {
        await run('UPDATE usuarios SET ativo = 0 WHERE id = ?', [rows[0].usuario_id]);
      }
      return ok(null);
    },
  },

  professorEscolas: {
    listByProfessor: async (profId: string) => {
      const rows = await query(`
        SELECT pe.escola_id, e.id, e.nome, e.inep, e.endereco, e.telefone
        FROM professor_escolas pe
        JOIN escolas e ON pe.escola_id = e.id
        WHERE pe.professor_id = ?
      `, [profId]);
      return ok(rows.map(r => ({ escola_id: r.escola_id, escolas: { id: r.id, nome: r.nome } })));
    },
    deleteByProfessor: async (profId: string) => {
      await run('DELETE FROM professor_escolas WHERE professor_id = ?', [profId]);
      return ok(null);
    },
    insert: async (data: { professor_id: string; escola_id: string }) => {
      const id = generateId();
      await run('INSERT INTO professor_escolas (id, professor_id, escola_id) VALUES (?, ?, ?)', [id, data.professor_id, data.escola_id]);
      return ok(null);
    },
  },

  responsaveis: {
    list: async () => {
      const rows = await query(`
        SELECT r.id, r.usuario_id, r.telefone, u.nome, u.cpf
        FROM responsaveis r
        JOIN usuarios u ON r.usuario_id = u.id AND u.ativo = 1
        ORDER BY u.nome
      `);
      // For each responsavel, get their alunos
      const result = [];
      for (const resp of rows) {
        const alunos = await query(`
          SELECT a.nome_completo 
          FROM aluno_responsaveis ar 
          JOIN alunos a ON ar.aluno_id = a.id 
          WHERE ar.responsavel_id = ? AND a.ativo = 1
        `, [resp.id]);
        result.push({ ...resp, alunos: alunos.map(a => a.nome_completo) });
      }
      return ok(result);
    },
    insert: async (data: { usuario_id: string; telefone?: string | null }) => {
      const id = generateId();
      await run('INSERT INTO responsaveis (id, usuario_id, telefone) VALUES (?, ?, ?)', [id, data.usuario_id, data.telefone || null]);
      return ok({ id });
    },
    update: async (id: string, data: { telefone?: string | null }) => {
      if (data.telefone !== undefined) {
        await run('UPDATE responsaveis SET telefone = ? WHERE id = ?', [data.telefone, id]);
      }
      return ok(null);
    },
    search: async (term: string) => {
      const rows = await query(`
        SELECT r.id, r.usuario_id, r.telefone, u.nome, u.cpf
        FROM responsaveis r
        JOIN usuarios u ON r.usuario_id = u.id
        WHERE u.nome LIKE ? OR u.cpf LIKE ?
        ORDER BY u.nome
        LIMIT 10
      `, [`%${term}%`, `%${term}%`]);
      return ok(rows);
    },
  },

  alunoResponsaveis: {
    insert: async (data: { aluno_id: string; responsavel_id: string; parentesco?: string }) => {
      const id = generateId();
      await run('INSERT INTO aluno_responsaveis (id, aluno_id, responsavel_id, parentesco) VALUES (?, ?, ?, ?)',
        [id, data.aluno_id, data.responsavel_id, data.parentesco || 'Responsavel']);
      return ok({ id });
    },
    // Lista todos os responsáveis vinculados a um aluno com dados completos
    listByAluno: async (alunoId: string) => {
      const rows = await query(`
        SELECT ar.id as vinculo_id, ar.parentesco,
               r.id as responsavel_id, r.telefone,
               u.nome, u.cpf
        FROM aluno_responsaveis ar
        JOIN responsaveis r ON ar.responsavel_id = r.id
        JOIN usuarios u ON r.usuario_id = u.id
        WHERE ar.aluno_id = ?
        ORDER BY u.nome
      `, [alunoId]);
      return ok(rows);
    },
    // Remove o vínculo (não remove o responsável do banco)
    delete: async (vinculoId: string) => {
      await run('DELETE FROM aluno_responsaveis WHERE id = ?', [vinculoId]);
      return ok(null);
    },
  },

  frequencias: {
    // Busca todas as frequências de uma data com dados do aluno (para pré-carregar o histórico de chamada)
    listByDate: async (date: string) => {
      const rows = await query(`
        SELECT f.*, a.nome_completo, a.matricula, a.idface_user_id, a.horario_fim, a.limite_max, a.escola_id
        FROM frequencias f
        JOIN alunos a ON f.aluno_id = a.id
        WHERE f.data = ?
        ORDER BY f.created_at DESC
      `, [date]);
      return ok(rows);
    },
    listByTurmaAndDate: async (turmaId: string, date: string) => {
      const rows = await query(`
        SELECT f.*, a.nome_completo, a.matricula
        FROM frequencias f
        JOIN alunos a ON f.aluno_id = a.id
        WHERE f.turma_id = ? AND f.data = ?
        ORDER BY a.nome_completo
      `, [turmaId, date]);
      return ok(rows);
    },
    listByAlunos: async (alunoIds: string[], start: string, end: string) => {
      if (alunoIds.length === 0) return ok([]);
      const placeholders = alunoIds.map(() => '?').join(',');
      const rows = await query(`
        SELECT * FROM frequencias 
        WHERE aluno_id IN (${placeholders}) AND data BETWEEN ? AND ?
        ORDER BY data DESC
      `, [...alunoIds, start, end]);
      return ok(rows);
    },
    listAll: async () => {
      const rows = await query('SELECT * FROM frequencias ORDER BY data DESC, created_at DESC');
      return ok(rows);
    },
    countByEscola: async (escolaId: string, date: string) => {
      const rows = await query<{ total: number; presentes: number }>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN f.status IN ('presente', 'atrasado') THEN 1 ELSE 0 END) as presentes
        FROM frequencias f
        JOIN alunos a ON f.aluno_id = a.id
        WHERE a.escola_id = ? AND f.data = ? AND a.ativo = 1
      `, [escolaId, date]);
      return ok(rows[0] || { total: 0, presentes: 0 });
    },
    frequenciaHojeByProfessor: async (usuarioId: string, date: string) => {
      const rows = await query<{ turma_id: string, turma_nome: string, total_alunos: number, frequencias_registradas: number, presentes: number }>(`
        SELECT 
          t.id as turma_id,
          t.nome as turma_nome,
          COUNT(DISTINCT a.id) as total_alunos,
          SUM(CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END) as frequencias_registradas,
          SUM(CASE WHEN f.id IS NOT NULL AND f.status IN ('presente', 'atrasado') THEN 1 ELSE 0 END) as presentes
        FROM turmas t
        JOIN turma_professores tp ON t.id = tp.turma_id
        JOIN professores p ON tp.professor_id = p.id
        LEFT JOIN alunos a ON t.id = a.turma_id AND a.ativo = 1
        LEFT JOIN frequencias f ON a.id = f.aluno_id AND f.data = ?
        WHERE p.usuario_id = ?
        GROUP BY t.id, t.nome
      `, [date, usuarioId]);
      return ok(rows);
    },
    insert: async (data: { aluno_id: string; turma_id?: string | null; data: string; hora_entrada?: string | null; status?: string; motivo?: string | null; dispositivo_id?: string | null }) => {
      const id = generateId();
      await run('INSERT INTO frequencias (id, aluno_id, turma_id, data, hora_entrada, status, motivo, dispositivo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.aluno_id, data.turma_id || null, data.data, data.hora_entrada || null, data.status || 'falta', data.motivo || null, data.dispositivo_id || null]);
      return ok({ id });
    },
    updateStatus: async (id: string, status: string) => {
      await run('UPDATE frequencias SET status = ? WHERE id = ?', [status, id]);
      return ok(null);
    },
    // Calcula o percentual de presenças do aluno no mês atual
    // Considera presente + atrasado como presença; falta e justificada como ausência.
    monthlyPct: async (alunoId: string) => {
      const rows = await query<{ total: number; presentes: number }>(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('presente', 'atrasado') THEN 1 ELSE 0 END) as presentes
        FROM frequencias
        WHERE aluno_id = ?
          AND strftime('%Y-%m', data) = strftime('%Y-%m', 'now')
      `, [alunoId]);
      const { total, presentes } = rows[0] || { total: 0, presentes: 0 };
      if (!total) return ok(null); // Sem registros = null (não exibe barra falsa)
      return ok(Math.round((presentes / total) * 100));
    },
  },

  justificativas: {
    list: async () => {
      const rows = await query(`
        SELECT j.*, 
          a.nome_completo as aluno_nome, 
          a.matricula as aluno_matricula,
          f.data as data_falta,
          u.nome as responsavel_nome
        FROM justificativas j
        LEFT JOIN frequencias f ON j.frequencia_id = f.id
        LEFT JOIN alunos a ON j.aluno_id = a.id OR f.aluno_id = a.id
        LEFT JOIN responsaveis r ON j.responsavel_id = r.id
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        ORDER BY j.created_at DESC
      `);
      return ok(rows);
    },
    listByResponsavel: async (usuarioId: string) => {
      const rows = await query(`
        SELECT j.*, 
          a.nome_completo as aluno_nome, 
          a.matricula as aluno_matricula,
          f.data as data_falta,
          u.nome as responsavel_nome
        FROM justificativas j
        LEFT JOIN frequencias f ON j.frequencia_id = f.id
        LEFT JOIN alunos a ON j.aluno_id = a.id OR f.aluno_id = a.id
        LEFT JOIN responsaveis r ON j.responsavel_id = r.id
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        WHERE r.usuario_id = ?
        ORDER BY j.created_at DESC
      `, [usuarioId]);
      return ok(rows);
    },
    listPendentes: async (escolaId: string) => {
      const rows = await query(`
        SELECT j.*, 
          a.nome_completo as aluno_nome, 
          a.matricula as aluno_matricula,
          f.data as data_falta,
          u.nome as responsavel_nome
        FROM justificativas j
        LEFT JOIN frequencias f ON j.frequencia_id = f.id
        LEFT JOIN alunos a ON j.aluno_id = a.id OR f.aluno_id = a.id
        LEFT JOIN responsaveis r ON j.responsavel_id = r.id
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        WHERE a.escola_id = ? AND j.status = 'pendente'
        ORDER BY j.created_at DESC
      `, [escolaId]);
      return ok(rows);
    },
    listByEscola: async (escolaId: string) => {
      const rows = await query(`
        SELECT j.*, 
          a.nome_completo as aluno_nome, 
          a.matricula as aluno_matricula,
          f.data as data_falta,
          u.nome as responsavel_nome
        FROM justificativas j
        LEFT JOIN frequencias f ON j.frequencia_id = f.id
        LEFT JOIN alunos a ON j.aluno_id = a.id OR f.aluno_id = a.id
        LEFT JOIN responsaveis r ON j.responsavel_id = r.id
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        WHERE a.escola_id = ?
        ORDER BY j.created_at DESC
      `, [escolaId]);
      return ok(rows);
    },
    insert: async (data: { frequencia_id?: string | null; responsavel_id: string; aluno_id?: string | null; tipo?: string; descricao?: string | null; arquivo_url?: string | null; data_inicio?: string | null; data_fim?: string | null }) => {
      const id = generateId();
      await run('INSERT INTO justificativas (id, frequencia_id, responsavel_id, aluno_id, tipo, descricao, arquivo_url, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.frequencia_id || null, data.responsavel_id, data.aluno_id || null, data.tipo || 'Outros', data.descricao || null, data.arquivo_url || null, data.data_inicio || null, data.data_fim || null]);
      return ok({ id });
    },
    update: async (id: string, data: { status?: string; observacao_diretor?: string | null }) => {
      const sets: string[] = ["updated_at = datetime('now')"];
      const vals: any[] = [];
      if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }
      if (data.observacao_diretor !== undefined) { sets.push('observacao_diretor = ?'); vals.push(data.observacao_diretor); }
      vals.push(id);
      await run(`UPDATE justificativas SET ${sets.join(', ')} WHERE id = ?`, vals);
      return ok(null);
    },
  },

  iotConfig: {
    getByEscola: async (escolaId: string) => {
      const rows = await query('SELECT * FROM escola_iot_config WHERE escola_id = ?', [escolaId]);
      return ok(rows[0] || null);
    },
    upsert: async (data: { escola_id: string; ip_address?: string | null; ativo?: boolean; modo_verificacao?: string; captura_timeout?: number | null }) => {
      const existing = await query('SELECT id FROM escola_iot_config WHERE escola_id = ?', [data.escola_id]);
      const timeout = data.captura_timeout ?? 5;
      if (existing.length > 0) {
        await run('UPDATE escola_iot_config SET ip_address = ?, ativo = ?, modo_verificacao = ?, captura_timeout = ? WHERE escola_id = ?',
          [data.ip_address || null, data.ativo !== false ? 1 : 0, data.modo_verificacao || 'entrada', timeout, data.escola_id]);
      } else {
        const id = generateId();
        await run('INSERT INTO escola_iot_config (id, escola_id, ip_address, ativo, modo_verificacao, captura_timeout) VALUES (?, ?, ?, ?, ?, ?)',
          [id, data.escola_id, data.ip_address || null, data.ativo !== false ? 1 : 0, data.modo_verificacao || 'entrada', timeout]);
      }
      return ok(null);
    },
  },

  stats: {
    counts: async () => {
      const escolas = await query<{ c: number }>('SELECT COUNT(*) as c FROM escolas');
      const alunos = await query<{ c: number }>('SELECT COUNT(*) as c FROM alunos WHERE ativo = 1');
      const professores = await query<{ c: number }>(`
        SELECT COUNT(*) as c FROM professores p 
        JOIN usuarios u ON p.usuario_id = u.id 
        WHERE u.ativo = 1
      `);
      const diretores = await query<{ c: number }>(`
        SELECT COUNT(*) as c FROM diretores d 
        JOIN usuarios u ON d.usuario_id = u.id 
        WHERE u.ativo = 1
      `);
      return ok({
        escolas: escolas[0]?.c || 0,
        alunos: alunos[0]?.c || 0,
        professores: professores[0]?.c || 0,
        diretores: diretores[0]?.c || 0,
      });
    },
    countsByEscola: async (escolaId: string) => {
      const alunos = await query<{ c: number }>('SELECT COUNT(*) as c FROM alunos WHERE escola_id = ? AND ativo = 1', [escolaId]);
      const professores = await query<{ c: number }>(`
        SELECT COUNT(DISTINCT pe.professor_id) as c 
        FROM professor_escolas pe 
        JOIN professores p ON pe.professor_id = p.id
        JOIN usuarios u ON p.usuario_id = u.id
        WHERE pe.escola_id = ? AND u.ativo = 1
      `, [escolaId]);
      const turmas = await query<{ c: number }>('SELECT COUNT(*) as c FROM turmas WHERE escola_id = ?', [escolaId]);
      return ok({
        alunos: alunos[0]?.c || 0,
        professores: professores[0]?.c || 0,
        turmas: turmas[0]?.c || 0,
      });
    },
    countsByProfessor: async (usuarioId: string) => {
      const turmas = await query<{ c: number }>(`
        SELECT COUNT(DISTINCT tp.turma_id) as c FROM turma_professores tp
        JOIN professores p ON tp.professor_id = p.id
        WHERE p.usuario_id = ?
      `, [usuarioId]);
      const alunos = await query<{ c: number }>(`
        SELECT COUNT(DISTINCT a.id) as c FROM alunos a
        JOIN turma_professores tp ON a.turma_id = tp.turma_id
        JOIN professores p ON tp.professor_id = p.id
        WHERE p.usuario_id = ? AND a.ativo = 1
      `, [usuarioId]);
      return ok({
        turmas: turmas[0]?.c || 0,
        alunos: alunos[0]?.c || 0,
      });
    },
  },

  turma_professores: {
    listByTurma: async (turmaId: string) => {
      const rows = await query(`
        SELECT u.nome FROM turma_professores tp
        JOIN professores p ON tp.professor_id = p.id
        JOIN usuarios u ON p.usuario_id = u.id
        WHERE tp.turma_id = ?
      `, [turmaId]);
      return ok(rows);
    },
    // Retorna professores vinculados com id e nome (para o modal de edição)
    listProfessoresCompleto: async (turmaId: string) => {
      const rows = await query<{ professor_id: string; nome: string }>(`
        SELECT tp.professor_id, u.nome
        FROM turma_professores tp
        JOIN professores p ON tp.professor_id = p.id
        JOIN usuarios u ON p.usuario_id = u.id
        WHERE tp.turma_id = ?
      `, [turmaId]);
      return ok(rows);
    },
    setProfessores: async (turmaId: string, professorIds: string[]) => {
      await run('DELETE FROM turma_professores WHERE turma_id = ?', [turmaId]);
      for (const profId of professorIds) {
        const id = generateId();
        await run('INSERT INTO turma_professores (id, turma_id, professor_id) VALUES (?, ?, ?)', [id, turmaId, profId]);
      }
      return ok(null);
    },
  },

  notificacoes: {
    listByDestinatario: async (usuarioId: string) => {
      const rows = await query(`
        SELECT n.*, u.nome as remetente_nome
        FROM notificacoes n
        LEFT JOIN usuarios u ON n.remetente_id = u.id
        WHERE n.destinatario_id = ?
        ORDER BY n.data_envio DESC LIMIT 50
      `, [usuarioId]);
      return ok(rows);
    },
    countUnread: async (usuarioId: string) => {
       const rows = await query<{ c: number }>('SELECT COUNT(*) as c FROM notificacoes WHERE destinatario_id = ? AND lida = 0', [usuarioId]);
       return ok(rows[0]?.c || 0);
    },
    insert: async (data: { remetente_id: string; destinatario_id: string; titulo: string; mensagem: string }) => {
       const id = generateId();
       await run('INSERT INTO notificacoes (id, remetente_id, destinatario_id, titulo, mensagem, lida) VALUES (?, ?, ?, ?, ?, 0)',
         [id, data.remetente_id, data.destinatario_id, data.titulo, data.mensagem]);
       return ok({ id });
    },
    markAsRead: async (id: string) => {
       await run('UPDATE notificacoes SET lida = 1 WHERE id = ?', [id]);
       return ok(null);
    },
    markAllAsRead: async (usuarioId: string) => {
       await run('UPDATE notificacoes SET lida = 1 WHERE destinatario_id = ?', [usuarioId]);
       return ok(null);
    }
  },

  // ── Busca Ativa (Evasão Escolar) ─────────────────────────────────────────
  buscaAtiva: {
    alunosEmRisco: async (escolaId?: string | null, professorUsuarioId?: string | null) => {
      const params: any[] = [];
      let whereClause = 'WHERE a.ativo = 1';
      if (escolaId) { whereClause += ' AND a.escola_id = ?'; params.push(escolaId); }
      if (professorUsuarioId) {
        whereClause += ` AND a.turma_id IN (
          SELECT tp.turma_id FROM turma_professores tp
          JOIN professores p ON tp.professor_id = p.id
          WHERE p.usuario_id = ?
        )`;
        params.push(professorUsuarioId);
      }

      // Query 1: frequência baixa no mês corrente
      const lowAttendance = await query<any>(`
        SELECT
          a.id, a.nome_completo, a.matricula, a.escola_id, a.turma_id,
          COALESCE(t.nome, 'Sem turma') as turma_nome,
          COALESCE(e.nome, '') as escola_nome,
          COUNT(f.id) as total_registros,
          SUM(CASE WHEN f.status IN ('presente', 'atrasado') THEN 1 ELSE 0 END) as presentes,
          ROUND(100.0 * SUM(CASE WHEN f.status IN ('presente', 'atrasado') THEN 1 ELSE 0 END)
            / NULLIF(COUNT(f.id), 0), 1) as pct_presenca
        FROM alunos a
        LEFT JOIN turmas t ON a.turma_id = t.id
        LEFT JOIN escolas e ON a.escola_id = e.id
        LEFT JOIN frequencias f ON a.id = f.aluno_id
          AND strftime('%Y-%m', f.data) = strftime('%Y-%m', 'now')
        ${whereClause}
        GROUP BY a.id, a.nome_completo, a.matricula, a.escola_id, a.turma_id, t.nome, e.nome
        HAVING COUNT(f.id) >= 3
        ORDER BY pct_presenca ASC
      `, params);

      // Query 2: frequências recentes para detectar faltas consecutivas (últimos 14 dias)
      const recentParams: any[] = [];
      let recentWhere = "WHERE a.ativo = 1 AND f.data >= date('now', '-14 days')";
      if (escolaId) { recentWhere += ' AND a.escola_id = ?'; recentParams.push(escolaId); }
      if (professorUsuarioId) {
        recentWhere += ` AND a.turma_id IN (
          SELECT tp.turma_id FROM turma_professores tp
          JOIN professores p ON tp.professor_id = p.id WHERE p.usuario_id = ?
        )`;
        recentParams.push(professorUsuarioId);
      }

      const recentFreqs = await query<any>(`
        SELECT f.aluno_id, f.data, f.status
        FROM frequencias f JOIN alunos a ON f.aluno_id = a.id
        ${recentWhere}
        ORDER BY f.aluno_id, f.data DESC
      `, recentParams);

      // Calcula faltas consecutivas por aluno (statuses já ordenados DESC por data)
      const recentByAluno = new Map<string, string[]>();
      for (const row of recentFreqs) {
        const id = row.aluno_id as string;
        if (!recentByAluno.has(id)) recentByAluno.set(id, []);
        recentByAluno.get(id)!.push(row.status as string);
      }
      const consecutivasByAluno = new Map<string, number>();
      for (const [alunoId, statuses] of recentByAluno) {
        let count = 0;
        for (const s of statuses) { if (s === 'falta') count++; else break; }
        consecutivasByAluno.set(alunoId, count);
      }

      // Merge: baixa frequência + faltas consecutivas
      const result = new Map<string, any>();
      for (const a of lowAttendance) {
        const consecutivas = consecutivasByAluno.get(a.id as string) || 0;
        result.set(a.id as string, { ...a, faltas_consecutivas: consecutivas });
      }

      // Alunos com 3+ consecutivas que ainda não estão na lista (< 3 registros no mês)
      for (const [alunoId, consec] of consecutivasByAluno) {
        if (consec >= 3 && !result.has(alunoId)) {
          const alunoRows = await query<any>(`
            SELECT a.id, a.nome_completo, a.matricula, a.escola_id, a.turma_id,
              COALESCE(t.nome, 'Sem turma') as turma_nome, COALESCE(e.nome, '') as escola_nome
            FROM alunos a
            LEFT JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN escolas e ON a.escola_id = e.id
            WHERE a.id = ?`, [alunoId]);
          if (alunoRows.length > 0) {
            result.set(alunoId, { ...alunoRows[0], pct_presenca: null, total_registros: 0, presentes: 0, faltas_consecutivas: consec });
          }
        }
      }

      const filtered = [...result.values()].filter(
        a => (a.pct_presenca !== null && (a.pct_presenca as number) < 75) || (a.faltas_consecutivas as number) >= 3
      );
      return ok(filtered);
    },

    getResponsaveis: async (alunoId: string) => {
      const rows = await query<{ usuario_id: string; nome: string }>(`
        SELECT u.id as usuario_id, u.nome
        FROM aluno_responsaveis ar
        JOIN responsaveis r ON ar.responsavel_id = r.id
        JOIN usuarios u ON r.usuario_id = u.id AND u.ativo = 1
        WHERE ar.aluno_id = ?
      `, [alunoId]);
      return ok(rows);
    },
  },

  // ── Ocorrências Disciplinares ─────────────────────────────────────────────
  ocorrencias: {
    insert: async (data: { aluno_id: string; usuario_id: string; titulo: string; descricao?: string | null; gravidade?: string; data?: string }) => {
      const id = generateId();
      await run(
        'INSERT INTO ocorrencias (id, aluno_id, usuario_id, titulo, descricao, gravidade, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, data.aluno_id, data.usuario_id, data.titulo, data.descricao || null, data.gravidade || 'Leve', data.data || new Date().toISOString().split('T')[0]]
      );
      return ok({ id });
    },
    listByAluno: async (alunoId: string) => {
      const rows = await query(`
        SELECT o.*, u.nome as registrado_por
        FROM ocorrencias o JOIN usuarios u ON o.usuario_id = u.id
        WHERE o.aluno_id = ? ORDER BY o.data DESC, o.created_at DESC
      `, [alunoId]);
      return ok(rows);
    },
    listByEscola: async (escolaId: string) => {
      const rows = await query(`
        SELECT o.*, u.nome as registrado_por, a.nome_completo as aluno_nome,
          COALESCE(t.nome, 'Sem turma') as turma_nome
        FROM ocorrencias o
        JOIN usuarios u ON o.usuario_id = u.id
        JOIN alunos a ON o.aluno_id = a.id AND a.escola_id = ? AND a.ativo = 1
        LEFT JOIN turmas t ON a.turma_id = t.id
        ORDER BY o.data DESC, o.created_at DESC
      `, [escolaId]);
      return ok(rows);
    },
    listByProfessor: async (usuarioId: string) => {
      const rows = await query(`
        SELECT o.*, u.nome as registrado_por, a.nome_completo as aluno_nome,
          COALESCE(t.nome, 'Sem turma') as turma_nome
        FROM ocorrencias o
        JOIN usuarios u ON o.usuario_id = u.id
        JOIN alunos a ON o.aluno_id = a.id AND a.ativo = 1
        LEFT JOIN turmas t ON a.turma_id = t.id
        JOIN turma_professores tp ON a.turma_id = tp.turma_id
        JOIN professores p ON tp.professor_id = p.id AND p.usuario_id = ?
        ORDER BY o.data DESC, o.created_at DESC
      `, [usuarioId]);
      return ok(rows);
    },
    listAll: async () => {
      const rows = await query(`
        SELECT o.*, u.nome as registrado_por, a.nome_completo as aluno_nome,
          COALESCE(t.nome, 'Sem turma') as turma_nome, COALESCE(e.nome, '') as escola_nome
        FROM ocorrencias o
        JOIN usuarios u ON o.usuario_id = u.id
        JOIN alunos a ON o.aluno_id = a.id
        LEFT JOIN turmas t ON a.turma_id = t.id
        LEFT JOIN escolas e ON a.escola_id = e.id
        ORDER BY o.data DESC, o.created_at DESC
      `);
      return ok(rows);
    },
    delete: async (id: string) => {
      await run('DELETE FROM ocorrencias WHERE id = ?', [id]);
      return ok(null);
    },
  },

  // ── Mural (Comunicados em Massa) ──────────────────────────────────────────
  mural: {
    getDestinatarios: async (
      alvo: 'escola' | 'professores' | 'turma' | 'responsaveis',
      escolaId?: string | null,
      turmaId?: string | null
    ) => {
      let rows: any[] = [];

      if (alvo === 'professores' && escolaId) {
        rows = await query<{ usuario_id: string; nome: string }>(`
          SELECT DISTINCT u.id as usuario_id, u.nome
          FROM professores p
          JOIN professor_escolas pe ON p.id = pe.professor_id
          JOIN usuarios u ON p.usuario_id = u.id AND u.ativo = 1
          WHERE pe.escola_id = ?
        `, [escolaId]);

      } else if (alvo === 'responsaveis' && escolaId) {
        rows = await query<{ usuario_id: string; nome: string }>(`
          SELECT DISTINCT u.id as usuario_id, u.nome
          FROM responsaveis r
          JOIN aluno_responsaveis ar ON r.id = ar.responsavel_id
          JOIN alunos a ON ar.aluno_id = a.id AND a.ativo = 1 AND a.escola_id = ?
          JOIN usuarios u ON r.usuario_id = u.id AND u.ativo = 1
        `, [escolaId]);

      } else if (alvo === 'turma' && turmaId) {
        rows = await query<{ usuario_id: string; nome: string }>(`
          SELECT DISTINCT u.id as usuario_id, u.nome
          FROM responsaveis r
          JOIN aluno_responsaveis ar ON r.id = ar.responsavel_id
          JOIN alunos a ON ar.aluno_id = a.id AND a.ativo = 1 AND a.turma_id = ?
          JOIN usuarios u ON r.usuario_id = u.id AND u.ativo = 1
        `, [turmaId]);

      } else if (alvo === 'escola' && escolaId) {
        // Professores + Responsáveis da escola
        const profs = await query<{ usuario_id: string; nome: string }>(`
          SELECT DISTINCT u.id as usuario_id, u.nome
          FROM professores p
          JOIN professor_escolas pe ON p.id = pe.professor_id
          JOIN usuarios u ON p.usuario_id = u.id AND u.ativo = 1
          WHERE pe.escola_id = ?
        `, [escolaId]);
        const resps = await query<{ usuario_id: string; nome: string }>(`
          SELECT DISTINCT u.id as usuario_id, u.nome
          FROM responsaveis r
          JOIN aluno_responsaveis ar ON r.id = ar.responsavel_id
          JOIN alunos a ON ar.aluno_id = a.id AND a.ativo = 1 AND a.escola_id = ?
          JOIN usuarios u ON r.usuario_id = u.id AND u.ativo = 1
        `, [escolaId]);
        rows = [...profs, ...resps];
      }

      return ok(rows);
    },

    listComunicadosEnviados: async (remetenteId: string) => {
      // Retorna a última mensagem para cada título/horário (agrupamento por mensagens em massa)
      const rows = await query(`
        SELECT titulo, mensagem, data_envio, COUNT(*) as total_destinatarios
        FROM notificacoes
        WHERE remetente_id = ?
        GROUP BY titulo, mensagem, strftime('%Y-%m-%dT%H:%M', data_envio)
        ORDER BY data_envio DESC
        LIMIT 20
      `, [remetenteId]);
      return ok(rows);
    },
  },
};
