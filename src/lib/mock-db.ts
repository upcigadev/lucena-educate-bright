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
    update: async (id: string, data: { nome?: string; inep?: string | null; endereco?: string | null; telefone?: string | null }) => {
      const sets: string[] = [];
      const vals: any[] = [];
      if (data.nome !== undefined) { sets.push('nome = ?'); vals.push(data.nome); }
      if (data.inep !== undefined) { sets.push('inep = ?'); vals.push(data.inep); }
      if (data.endereco !== undefined) { sets.push('endereco = ?'); vals.push(data.endereco); }
      if (data.telefone !== undefined) { sets.push('telefone = ?'); vals.push(data.telefone); }
      if (sets.length > 0) {
        vals.push(id);
        await run(`UPDATE escolas SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
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
  },

  turmas: {
    listByEscola: async (escolaId: string) => {
      const rows = await query('SELECT * FROM turmas WHERE escola_id = ? ORDER BY nome', [escolaId]);
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
      const id = generateId();
      await run('INSERT INTO turmas (id, nome, serie_id, escola_id, sala, horario_inicio, tolerancia_min, limite_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.nome, data.serie_id, data.escola_id, data.sala || null, data.horario_inicio || null, data.tolerancia_min ?? null, data.limite_max || null]);
      return ok({ id });
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
        ORDER BY a.nome_completo
      `);
      return ok(rows);
    },
    listByTurma: async (turmaId: string) => {
      const rows = await query('SELECT * FROM alunos WHERE turma_id = ? AND ativo = 1 ORDER BY nome_completo', [turmaId]);
      return ok(rows);
    },
    listByEscola: async (escolaId: string) => {
      const rows = await query('SELECT * FROM alunos WHERE escola_id = ? AND ativo = 1 ORDER BY nome_completo', [escolaId]);
      return ok(rows);
    },
    countByEscola: async (escolaId: string) => {
      const rows = await query<{ c: number }>('SELECT COUNT(*) as c FROM alunos WHERE escola_id = ? AND ativo = 1', [escolaId]);
      return ok(rows[0]?.c || 0);
    },
    insert: async (data: { nome_completo: string; matricula: string; data_nascimento?: string | null; escola_id: string; turma_id?: string | null }) => {
      const id = generateId();
      await run('INSERT INTO alunos (id, nome_completo, matricula, data_nascimento, escola_id, turma_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, data.nome_completo, data.matricula, data.data_nascimento || null, data.escola_id, data.turma_id || null]);
      return ok({ id });
    },
    update: async (id: string, data: { nome_completo?: string; data_nascimento?: string | null; turma_id?: string | null; escola_id?: string }) => {
      const sets: string[] = [];
      const vals: any[] = [];
      if (data.nome_completo !== undefined) { sets.push('nome_completo = ?'); vals.push(data.nome_completo); }
      if (data.data_nascimento !== undefined) { sets.push('data_nascimento = ?'); vals.push(data.data_nascimento); }
      if (data.turma_id !== undefined) { sets.push('turma_id = ?'); vals.push(data.turma_id); }
      if (data.escola_id !== undefined) { sets.push('escola_id = ?'); vals.push(data.escola_id); }
      if (sets.length > 0) {
        vals.push(id);
        await run(`UPDATE alunos SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
      return ok(null);
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
  },

  diretores: {
    list: async () => {
      const rows = await query(`
        SELECT d.*, u.nome, u.cpf, e.nome as escola_nome
        FROM diretores d
        JOIN usuarios u ON d.usuario_id = u.id
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
  },

  professores: {
    list: async () => {
      const rows = await query(`
        SELECT p.id, p.usuario_id, u.nome, u.cpf
        FROM professores p
        JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY u.nome
      `);
      // For each professor, get their schools
      const result = [];
      for (const prof of rows) {
        const escolas = await query(`
          SELECT e.nome FROM professor_escolas pe JOIN escolas e ON pe.escola_id = e.id WHERE pe.professor_id = ?
        `, [prof.id]);
        result.push({ ...prof, escolas: escolas.map(e => e.nome) });
      }
      return ok(result);
    },
    insert: async (data: { usuario_id: string }) => {
      const id = generateId();
      await run('INSERT INTO professores (id, usuario_id) VALUES (?, ?)', [id, data.usuario_id]);
      return ok({ id });
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
        JOIN usuarios u ON r.usuario_id = u.id
        ORDER BY u.nome
      `);
      // For each responsavel, get their alunos
      const result = [];
      for (const resp of rows) {
        const alunos = await query(`
          SELECT a.nome_completo FROM aluno_responsaveis ar JOIN alunos a ON ar.aluno_id = a.id WHERE ar.responsavel_id = ?
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
  },

  frequencias: {
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
        WHERE a.escola_id = ? AND f.data = ?
      `, [escolaId, date]);
      return ok(rows[0] || { total: 0, presentes: 0 });
    },
    insert: async (data: { aluno_id: string; turma_id?: string | null; data: string; hora_entrada?: string | null; status?: string; motivo?: string | null; dispositivo_id?: string | null }) => {
      const id = generateId();
      await run('INSERT INTO frequencias (id, aluno_id, turma_id, data, hora_entrada, status, motivo, dispositivo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.aluno_id, data.turma_id || null, data.data, data.hora_entrada || null, data.status || 'falta', data.motivo || null, data.dispositivo_id || null]);
      return ok({ id });
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
        JOIN frequencias f ON j.frequencia_id = f.id
        JOIN alunos a ON f.aluno_id = a.id
        JOIN responsaveis r ON j.responsavel_id = r.id
        JOIN usuarios u ON r.usuario_id = u.id
        ORDER BY j.created_at DESC
      `);
      return ok(rows);
    },
    insert: async (data: { frequencia_id: string; responsavel_id: string; tipo?: string; descricao?: string | null; arquivo_url?: string | null }) => {
      const id = generateId();
      await run('INSERT INTO justificativas (id, frequencia_id, responsavel_id, tipo, descricao, arquivo_url) VALUES (?, ?, ?, ?, ?, ?)',
        [id, data.frequencia_id, data.responsavel_id, data.tipo || 'Outros', data.descricao || null, data.arquivo_url || null]);
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
    upsert: async (data: { escola_id: string; ip_address?: string | null; ativo?: boolean; modo_verificacao?: string }) => {
      const existing = await query('SELECT id FROM escola_iot_config WHERE escola_id = ?', [data.escola_id]);
      if (existing.length > 0) {
        await run('UPDATE escola_iot_config SET ip_address = ?, ativo = ?, modo_verificacao = ? WHERE escola_id = ?',
          [data.ip_address || null, data.ativo !== false ? 1 : 0, data.modo_verificacao || 'entrada', data.escola_id]);
      } else {
        const id = generateId();
        await run('INSERT INTO escola_iot_config (id, escola_id, ip_address, ativo, modo_verificacao) VALUES (?, ?, ?, ?, ?)',
          [id, data.escola_id, data.ip_address || null, data.ativo !== false ? 1 : 0, data.modo_verificacao || 'entrada']);
      }
      return ok(null);
    },
  },

  stats: {
    counts: async () => {
      const escolas = await query<{ c: number }>('SELECT COUNT(*) as c FROM escolas');
      const alunos = await query<{ c: number }>('SELECT COUNT(*) as c FROM alunos WHERE ativo = 1');
      const professores = await query<{ c: number }>('SELECT COUNT(*) as c FROM professores');
      const diretores = await query<{ c: number }>('SELECT COUNT(*) as c FROM diretores');
      return ok({
        escolas: escolas[0]?.c || 0,
        alunos: alunos[0]?.c || 0,
        professores: professores[0]?.c || 0,
        diretores: diretores[0]?.c || 0,
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
  },
};
