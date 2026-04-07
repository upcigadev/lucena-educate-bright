// Supabase-backed data access layer (replaces SQLite/sql.js)
import { supabase } from '@/integrations/supabase/client';

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

// Helper: map nested justificativa to flat shape expected by pages
function flattenJustificativa(j: any) {
  return {
    ...j,
    aluno_nome: j.alunos?.nome_completo || null,
    aluno_matricula: j.alunos?.matricula || null,
    aluno_escola_id: j.alunos?.escola_id || null,
    data_falta: j.frequencias?.data || null,
    responsavel_nome: j.responsaveis?.usuarios?.nome || null,
    alunos: undefined,
    frequencias: undefined,
    responsaveis: undefined,
  };
}

const JUST_SELECT = '*, alunos(nome_completo, matricula, escola_id), frequencias(data), responsaveis(usuarios(nome))';

// ===== Database API =====

export const db = {
  escolas: {
    list: async () => {
      const { data, error } = await supabase.from('escolas').select('*').order('nome');
      return error ? err(error.message) : ok(data);
    },
    getById: async (id: string) => {
      const { data, error } = await supabase.from('escolas').select('*').eq('id', id).maybeSingle();
      return error ? err(error.message) : ok(data);
    },
    insert: async (data: { nome: string; inep?: string | null; endereco?: string | null; telefone?: string | null }) => {
      const { data: row, error } = await supabase.from('escolas').insert(data).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    update: async (id: string, data: { nome?: string; inep?: string | null; endereco?: string | null; telefone?: string | null; horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const { error } = await supabase.from('escolas').update(data).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    applyScheduleToAll: async (escolaId: string, horario_inicio: string | null, tolerancia_min: number | null, limite_max: string | null) => {
      await supabase.from('series').update({ horario_inicio, tolerancia_min, limite_max }).eq('escola_id', escolaId);
      await supabase.from('turmas').update({ horario_inicio, tolerancia_min, limite_max }).eq('escola_id', escolaId);
      return ok(null);
    },
  },

  series: {
    listByEscola: async (escolaId: string) => {
      const { data, error } = await supabase.from('series').select('*').eq('escola_id', escolaId).order('nome');
      return error ? err(error.message) : ok(data);
    },
    insert: async (data: { nome: string; escola_id: string; horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const { data: row, error } = await supabase.from('series').insert({
        nome: data.nome,
        escola_id: data.escola_id,
        horario_inicio: data.horario_inicio || '07:00',
        tolerancia_min: data.tolerancia_min ?? 15,
        limite_max: data.limite_max || '07:30',
      }).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    update: async (id: string, data: { horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const { error } = await supabase.from('series').update(data).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    delete: async (serieId: string) => {
      const { data: turmas } = await supabase.from('turmas').select('id').eq('serie_id', serieId);
      for (const turma of turmas || []) {
        await supabase.from('alunos').update({ turma_id: null }).eq('turma_id', turma.id);
        await supabase.from('turma_professores').delete().eq('turma_id', turma.id);
        await supabase.from('turmas').delete().eq('id', turma.id);
      }
      await supabase.from('series').delete().eq('id', serieId);
      return ok(null);
    },
  },

  turmas: {
    listByEscola: async (escolaId: string) => {
      const { data, error } = await supabase.from('turmas').select('*').eq('escola_id', escolaId).order('nome');
      return error ? err(error.message) : ok(data);
    },
    listByProfessor: async (usuarioId: string) => {
      const { data: prof } = await supabase.from('professores').select('id').eq('usuario_id', usuarioId).maybeSingle();
      if (!prof) return ok([]);
      const { data, error } = await supabase
        .from('turma_professores').select('turmas(*, series(nome), escolas(nome))')
        .eq('professor_id', prof.id);
      if (error) return err(error.message);
      return ok((data || []).map((tp: any) => ({
        ...tp.turmas,
        serie_nome: tp.turmas?.series?.nome || '',
        escola_nome: tp.turmas?.escolas?.nome || '',
      })));
    },
    listAll: async () => {
      const { data, error } = await supabase.from('turmas').select('*').order('nome');
      return error ? err(error.message) : ok(data);
    },
    getById: async (id: string) => {
      const { data, error } = await supabase.from('turmas').select('*').eq('id', id).maybeSingle();
      return error ? err(error.message) : ok(data);
    },
    insert: async (data: { nome: string; serie_id: string; escola_id: string; sala?: string | null; horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const { data: dup } = await supabase.from('turmas').select('id').eq('nome', data.nome).eq('escola_id', data.escola_id).maybeSingle();
      if (dup) throw new Error(`Turma "${data.nome}" já existe nesta escola.`);
      const { data: row, error } = await supabase.from('turmas').insert(data).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    update: async (id: string, data: { nome?: string; sala?: string | null; horario_inicio?: string | null; tolerancia_min?: number | null; limite_max?: string | null }) => {
      const { error } = await supabase.from('turmas').update(data).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    delete: async (id: string) => {
      await supabase.from('alunos').update({ turma_id: null }).eq('turma_id', id);
      await supabase.from('turma_professores').delete().eq('turma_id', id);
      const { error } = await supabase.from('turmas').delete().eq('id', id);
      return error ? err(error.message) : ok(null);
    },
  },

  alunos: {
    list: async () => {
      const { data, error } = await supabase
        .from('alunos').select('*, turmas(nome, series(nome)), escolas(nome)')
        .eq('ativo', true).order('nome_completo');
      if (error) return err(error.message);
      return ok((data || []).map((a: any) => ({
        ...a,
        turma_nome: a.turmas?.nome || 'Sem turma',
        serie_nome: a.turmas?.series?.nome || '',
        escola_nome: a.escolas?.nome || '',
        turmas: undefined, escolas: undefined,
      })));
    },
    getAlunoComResponsaveis: async (alunoId: string) => {
      const { data: aluno } = await supabase.from('alunos').select('nome_completo, escolas(nome)').eq('id', alunoId).eq('ativo', true).maybeSingle();
      if (!aluno) return ok(null);
      const { data: links } = await supabase.from('aluno_responsaveis').select('responsaveis(telefone, usuarios(nome))').eq('aluno_id', alunoId);
      const responsaveis = (links || []).map((ar: any) => ({ nome: ar.responsaveis?.usuarios?.nome || '', telefone: ar.responsaveis?.telefone || '' }));
      return ok({ aluno_nome: aluno.nome_completo, escola_nome: (aluno as any).escolas?.nome || '', responsaveis });
    },
    listByTurma: async (turmaId: string) => {
      const { data, error } = await supabase.from('alunos').select('*').eq('turma_id', turmaId).eq('ativo', true).order('nome_completo');
      return error ? err(error.message) : ok(data);
    },
    listByResponsavelUsuarioId: async (usuarioId: string) => {
      const { data, error } = await supabase
        .from('alunos').select('*, turmas(nome, series(nome)), escolas(nome), aluno_responsaveis!inner(parentesco, responsaveis!inner(usuario_id))')
        .eq('ativo', true).eq('aluno_responsaveis.responsaveis.usuario_id', usuarioId).order('nome_completo');
      if (error) {
        // fallback: manual join
        const { data: resp } = await supabase.from('responsaveis').select('id').eq('usuario_id', usuarioId).maybeSingle();
        if (!resp) return ok([]);
        const { data: links } = await supabase.from('aluno_responsaveis').select('aluno_id, parentesco').eq('responsavel_id', resp.id);
        const ids = (links || []).map((l: any) => l.aluno_id);
        if (ids.length === 0) return ok([]);
        const { data: a2 } = await supabase.from('alunos').select('*, turmas(nome, series(nome)), escolas(nome)').in('id', ids).eq('ativo', true).order('nome_completo');
        return ok((a2 || []).map((a: any) => ({ ...a, turma_nome: a.turmas?.nome || 'Sem turma', serie_nome: a.turmas?.series?.nome || '', escola_nome: a.escolas?.nome || '', turmas: undefined, escolas: undefined })));
      }
      return ok((data || []).map((a: any) => ({ ...a, turma_nome: a.turmas?.nome || 'Sem turma', serie_nome: a.turmas?.series?.nome || '', escola_nome: a.escolas?.nome || '', turmas: undefined, escolas: undefined, aluno_responsaveis: undefined })));
    },
    listByEscola: async (escolaId: string) => {
      const { data, error } = await supabase
        .from('alunos').select('*, turmas(nome, series(nome)), escolas(nome)')
        .eq('escola_id', escolaId).eq('ativo', true).order('nome_completo');
      if (error) return err(error.message);
      return ok((data || []).map((a: any) => ({ ...a, turma_nome: a.turmas?.nome || 'Sem turma', serie_nome: a.turmas?.series?.nome || '', escola_nome: a.escolas?.nome || '', turmas: undefined, escolas: undefined })));
    },
    listByProfessorUsuarioId: async (usuarioId: string) => {
      const { data: prof } = await supabase.from('professores').select('id').eq('usuario_id', usuarioId).maybeSingle();
      if (!prof) return ok([]);
      const { data: turmaLinks } = await supabase.from('turma_professores').select('turma_id').eq('professor_id', prof.id);
      const turmaIds = (turmaLinks || []).map((t: any) => t.turma_id);
      if (turmaIds.length === 0) return ok([]);
      const { data, error } = await supabase
        .from('alunos').select('*, turmas(nome, series(nome)), escolas(nome)')
        .in('turma_id', turmaIds).eq('ativo', true).order('nome_completo');
      if (error) return err(error.message);
      return ok((data || []).map((a: any) => ({ ...a, turma_nome: a.turmas?.nome || 'Sem turma', serie_nome: a.turmas?.series?.nome || '', escola_nome: a.escolas?.nome || '', turmas: undefined, escolas: undefined })));
    },
    countByEscola: async (escolaId: string) => {
      const { count, error } = await supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('escola_id', escolaId).eq('ativo', true);
      return error ? err(error.message) : ok(count || 0);
    },
    insert: async (data: { nome_completo: string; matricula: string; data_nascimento?: string | null; escola_id: string; turma_id?: string | null; horario_inicio?: string | null; horario_fim?: string | null; limite_max?: string | null; idface_user_id?: string | null; avatar_url?: string | null }) => {
      const { data: existing } = await supabase.from('alunos').select('id').eq('matricula', data.matricula).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('alunos').update({ ...data, ativo: true }).eq('id', existing.id);
        return error ? err(error.message) : ok({ id: existing.id });
      }
      const { data: row, error } = await supabase.from('alunos').insert({ ...data, ativo: true }).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    update: async (id: string, data: { nome_completo?: string; data_nascimento?: string | null; turma_id?: string | null; escola_id?: string; horario_inicio?: string | null; horario_fim?: string | null; limite_max?: string | null; idface_user_id?: string | null; avatar_url?: string | null }) => {
      const { error } = await supabase.from('alunos').update(data).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    getByMatricula: async (matricula: string, escolaId?: string) => {
      let q = supabase.from('alunos').select('*').eq('matricula', matricula).eq('ativo', true);
      if (escolaId) q = q.eq('escola_id', escolaId);
      const { data, error } = await q.maybeSingle();
      return error ? err(error.message) : ok(data);
    },
    deactivate: async (id: string) => {
      const { error } = await supabase.from('alunos').update({ ativo: false }).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    getByDeviceUserIds: async (userIds: string[]) => {
      if (!userIds || userIds.length === 0) return ok([]);
      const safeIds = userIds.map(id => `"${id}"`).join(',');
      const filter = `matricula.in.(${safeIds}),idface_user_id.in.(${safeIds})`;
      const { data, error } = await supabase
        .from('alunos')
        .select('*, turmas(nome, series(nome)), escolas(nome)')
        .or(filter)
        .eq('ativo', true);
      if (error) return err(error.message);
      return ok((data || []).map((a: any) => ({
        ...a,
        turma_nome: a.turmas?.nome || 'Sem turma',
        serie_nome: a.turmas?.series?.nome || '',
        escola_nome: a.escolas?.nome || '',
        turmas: undefined, escolas: undefined,
        aluno_responsaveis: undefined
      })));
    },
  },

  usuarios: {
    getByAuthId: async (authId: string) => {
      const { data, error } = await supabase.from('usuarios').select('*').eq('auth_id', authId).eq('ativo', true).maybeSingle();
      return error ? err(error.message) : ok(data);
    },
    getByCpf: async (cpf: string) => {
      const { data, error } = await supabase.from('usuarios').select('*').eq('cpf', cpf).eq('ativo', true).maybeSingle();
      return error ? err(error.message) : ok(data);
    },
    insert: async (data: { nome: string; cpf: string; papel: string; auth_id?: string }) => {
      const { data: row, error } = await supabase.from('usuarios').insert({ ...data, ativo: true }).select('id, auth_id').single();
      return error ? err(error.message) : ok({ id: row!.id, auth_id: row!.auth_id });
    },
    update: async (id: string, data: { nome?: string; ativo?: boolean }) => {
      const { error } = await supabase.from('usuarios').update(data).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    updateAvatar: async (id: string, avatarUrl: string | null) => {
      const { error } = await supabase.from('usuarios').update({ avatar_url: avatarUrl }).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    deactivate: async (id: string) => {
      const { error } = await supabase.from('usuarios').update({ ativo: false }).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
  },

  diretores: {
    list: async () => {
      const { data, error } = await supabase.from('diretores').select('*, usuarios!inner(nome, cpf, ativo), escolas(nome)').order('usuarios(nome)' as any);
      if (error) return err(error.message);
      return ok((data || []).filter((d: any) => d.usuarios?.ativo !== false).map((d: any) => ({ ...d, nome: d.usuarios?.nome, cpf: d.usuarios?.cpf, escola_nome: d.escolas?.nome, usuarios: undefined, escolas: undefined })));
    },
    insert: async (data: { usuario_id: string; escola_id: string }) => {
      const { data: row, error } = await supabase.from('diretores').insert(data).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    update: async (id: string, data: { escola_id?: string }) => {
      const { error } = await supabase.from('diretores').update(data).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    deactivate: async (diretorId: string) => {
      const { data } = await supabase.from('diretores').select('usuario_id').eq('id', diretorId).maybeSingle();
      if (data?.usuario_id) await supabase.from('usuarios').update({ ativo: false }).eq('id', data.usuario_id);
      return ok(null);
    },
    listByUsuario: async (usuarioId: string) => {
      const { data, error } = await supabase.from('diretores').select('escola_id, escolas(id, nome, inep, endereco, telefone)').eq('usuario_id', usuarioId);
      if (error) return err(error.message);
      return ok((data || []).map((d: any) => ({ escola_id: d.escola_id, escolas: d.escolas })));
    },
    getByEscola: async (escolaId: string) => {
      const { data, error } = await supabase.from('diretores').select('usuarios(nome)').eq('escola_id', escolaId).maybeSingle();
      return error ? err(error.message) : ok(data ? { nome: (data as any).usuarios?.nome } : null);
    },
  },

  professores: {
    list: async () => {
      const { data: profs, error } = await supabase.from('professores').select('id, usuario_id, usuarios(nome, cpf, ativo), professor_escolas(escolas(nome)), turma_professores(turmas(nome))');
      if (error) return err(error.message);
      const active = (profs || []).filter((p: any) => p.usuarios?.ativo !== false);
      const result = active.map((prof: any) => ({
        id: prof.id,
        usuario_id: prof.usuario_id,
        nome: prof.usuarios?.nome || '',
        cpf: prof.usuarios?.cpf || '',
        escolas: (prof.professor_escolas || []).map((e: any) => e.escolas?.nome || ''),
        turmas: (prof.turma_professores || []).map((t: any) => t.turmas?.nome || '')
      }));
      return ok(result);
    },
    listAll: async () => {
      const { data, error } = await supabase.from('professores').select('id, usuario_id, usuarios!inner(nome, ativo)').filter('usuarios.ativo', 'eq', true);
      if (error) return err(error.message);
      return ok((data || []).map((p: any) => ({ id: p.id, usuario_id: p.usuario_id, nome: p.usuarios?.nome || '' })));
    },
    listByEscola: async (escolaId: string) => {
      const { data: links, error } = await supabase.from('professor_escolas').select('professor_id').eq('escola_id', escolaId);
      if (error) return err(error.message);
      const profIds = (links || []).map((l: any) => l.professor_id);
      if (profIds.length === 0) return ok([]);
      const { data: profs } = await supabase.from('professores').select('id, usuario_id, usuarios(nome, cpf, ativo), professor_escolas(escolas(nome)), turma_professores(turmas(nome))').in('id', profIds);
      const active = (profs || []).filter((p: any) => p.usuarios?.ativo !== false);
      const result = active.map((prof: any) => ({
        id: prof.id,
        usuario_id: prof.usuario_id,
        nome: prof.usuarios?.nome || '',
        cpf: prof.usuarios?.cpf || '',
        escolas: (prof.professor_escolas || []).map((e: any) => e.escolas?.nome || ''),
        turmas: (prof.turma_professores || []).map((t: any) => t.turmas?.nome || '')
      }));
      return ok(result);
    },
    insert: async (data: { usuario_id: string }) => {
      const { data: row, error } = await supabase.from('professores').insert(data).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    deactivate: async (professorId: string) => {
      const { data } = await supabase.from('professores').select('usuario_id').eq('id', professorId).maybeSingle();
      if (data?.usuario_id) await supabase.from('usuarios').update({ ativo: false }).eq('id', data.usuario_id);
      return ok(null);
    },
  },

  professorEscolas: {
    listByProfessor: async (profId: string) => {
      const { data, error } = await supabase.from('professor_escolas').select('escola_id, escolas(id, nome, inep, endereco, telefone)').eq('professor_id', profId);
      if (error) return err(error.message);
      return ok((data || []).map((d: any) => ({ escola_id: d.escola_id, escolas: d.escolas })));
    },
    deleteByProfessor: async (profId: string) => {
      const { error } = await supabase.from('professor_escolas').delete().eq('professor_id', profId);
      return error ? err(error.message) : ok(null);
    },
    insert: async (data: { professor_id: string; escola_id: string }) => {
      const { error } = await supabase.from('professor_escolas').insert(data);
      return error ? err(error.message) : ok(null);
    },
  },

  responsaveis: {
    list: async () => {
      const { data, error } = await supabase.from('responsaveis').select('id, usuario_id, telefone, usuarios(nome, cpf, ativo), aluno_responsaveis(alunos(nome_completo, ativo))');
      if (error) return err(error.message);
      const active = (data || []).filter((r: any) => r.usuarios?.ativo !== false);
      const result = active.map((resp: any) => ({
        id: resp.id,
        usuario_id: resp.usuario_id,
        telefone: resp.telefone,
        nome: resp.usuarios?.nome || '',
        cpf: resp.usuarios?.cpf || '',
        alunos: (resp.aluno_responsaveis || [])
          .filter((l: any) => l.alunos?.ativo !== false)
          .map((l: any) => l.alunos?.nome_completo || '')
      }));
      return ok(result);
    },
    insert: async (data: { usuario_id: string; telefone?: string | null }) => {
      const { data: row, error } = await supabase.from('responsaveis').insert(data).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    update: async (id: string, data: { telefone?: string | null }) => {
      const { error } = await supabase.from('responsaveis').update(data).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    search: async (term: string) => {
      const { data, error } = await supabase
        .from('responsaveis').select('id, usuario_id, telefone, usuarios!inner(nome, cpf)')
        .or(`nome.ilike.%${term}%,cpf.ilike.%${term}%`, { referencedTable: 'usuarios' }).limit(10);
      if (error) return err(error.message);
      return ok((data || []).map((r: any) => ({ id: r.id, usuario_id: r.usuario_id, telefone: r.telefone, nome: r.usuarios?.nome || '', cpf: r.usuarios?.cpf || '' })));
    },
  },

  alunoResponsaveis: {
    insert: async (data: { aluno_id: string; responsavel_id: string; parentesco?: string }) => {
      const { data: row, error } = await supabase.from('aluno_responsaveis').insert({ ...data, parentesco: data.parentesco || 'Responsavel' }).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    listByAluno: async (alunoId: string) => {
      const { data, error } = await supabase
        .from('aluno_responsaveis').select('id, parentesco, responsaveis(id, telefone, usuario_id, usuarios(nome, cpf))')
        .eq('aluno_id', alunoId);
      if (error) return err(error.message);
      return ok((data || []).map((ar: any) => ({
        vinculo_id: ar.id,
        parentesco: ar.parentesco,
        responsavel_id: ar.responsaveis?.id,
        telefone: ar.responsaveis?.telefone,
        usuario_id: ar.responsaveis?.usuario_id,
        nome: ar.responsaveis?.usuarios?.nome || '',
        cpf: ar.responsaveis?.usuarios?.cpf || '',
      })));
    },
    delete: async (vinculoId: string) => {
      const { error } = await supabase.from('aluno_responsaveis').delete().eq('id', vinculoId);
      return error ? err(error.message) : ok(null);
    },
  },

  frequencias: {
    listByDate: async (date: string) => {
      const { data, error } = await supabase
        .from('frequencias').select('*, alunos(nome_completo, matricula, idface_user_id, horario_fim, limite_max, escola_id)')
        .eq('data', date).order('created_at', { ascending: false });
      if (error) return err(error.message);
      return ok((data || []).map((f: any) => ({ ...f, nome_completo: f.alunos?.nome_completo, matricula: f.alunos?.matricula, idface_user_id: f.alunos?.idface_user_id, horario_fim: f.alunos?.horario_fim, limite_max: f.alunos?.limite_max, escola_id: f.alunos?.escola_id, alunos: undefined })));
    },
    listByTurmaAndDate: async (turmaId: string, date: string) => {
      const { data, error } = await supabase
        .from('frequencias').select('*, alunos(nome_completo, matricula)')
        .eq('turma_id', turmaId).eq('data', date).order('alunos(nome_completo)' as any);
      if (error) return err(error.message);
      return ok((data || []).map((f: any) => ({ ...f, nome_completo: f.alunos?.nome_completo, matricula: f.alunos?.matricula, alunos: undefined })));
    },
    listByAlunos: async (alunoIds: string[], start: string, end: string) => {
      if (alunoIds.length === 0) return ok([]);
      const { data, error } = await supabase.from('frequencias').select('*').in('aluno_id', alunoIds).gte('data', start).lte('data', end).order('data', { ascending: false });
      return error ? err(error.message) : ok(data);
    },
    listAll: async () => {
      const { data, error } = await supabase.from('frequencias').select('*').order('data', { ascending: false });
      return error ? err(error.message) : ok(data);
    },
    countByEscola: async (escolaId: string, date: string) => {
      const { data: alunosData } = await supabase.from('alunos').select('id').eq('escola_id', escolaId).eq('ativo', true);
      const alunoIds = (alunosData || []).map(a => a.id);
      if (alunoIds.length === 0) return ok({ total: 0, presentes: 0 });
      const { data: freqs } = await supabase.from('frequencias').select('status').in('aluno_id', alunoIds).eq('data', date);
      const total = freqs?.length || 0;
      const presentes = freqs?.filter(f => ['presente', 'atrasado'].includes(f.status)).length || 0;
      return ok({ total, presentes });
    },
    frequenciaHojeByProfessor: async (usuarioId: string, date: string) => {
      const { data: prof } = await supabase.from('professores').select('id').eq('usuario_id', usuarioId).maybeSingle();
      if (!prof) return ok([]);
      const { data: turmaLinks } = await supabase.from('turma_professores').select('turma_id, turmas(nome)').eq('professor_id', prof.id);
      
      const turmaIds = turmaLinks?.map((l: any) => l.turma_id) || [];
      if (turmaIds.length === 0) return ok([]);

      const { data: alunos } = await supabase.from('alunos').select('id, turma_id').in('turma_id', turmaIds).eq('ativo', true);
      const alunosMap = new Map();
      const alunoIds: string[] = [];
      for (const a of (alunos || [])) {
         alunosMap.set(a.turma_id, [...(alunosMap.get(a.turma_id) || []), a.id]);
         alunoIds.push(a.id);
      }

      let freqsByAluno = new Map();
      if (alunoIds.length > 0) {
         const { data: freqs } = await supabase.from('frequencias').select('aluno_id, status').in('aluno_id', alunoIds).eq('data', date);
         for (const f of freqs || []) {
            freqsByAluno.set(f.aluno_id, f.status);
         }
      }

      const result = turmaLinks!.map((link: any) => {
        const idsAndT = alunosMap.get(link.turma_id) || [];
        const total_alunos = idsAndT.length;
        let frequencias_registradas = 0, presentes = 0;
        for (const id of idsAndT) {
           if (freqsByAluno.has(id)) {
              frequencias_registradas++;
              if (['presente', 'atrasado'].includes(freqsByAluno.get(id))) presentes++;
           }
        }
        return { turma_id: link.turma_id, turma_nome: (link as any).turmas?.nome || '', total_alunos, frequencias_registradas, presentes };
      });
      return ok(result);
    },
    insert: async (data: { aluno_id: string; turma_id?: string | null; data: string; hora_entrada?: string | null; status?: string; motivo?: string | null; dispositivo_id?: string | null }) => {
      const { data: row, error } = await supabase.from('frequencias').insert({ ...data, status: data.status || 'falta' }).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    updateStatus: async (id: string, status: string) => {
      const { error } = await supabase.from('frequencias').update({ status }).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    monthlyPct: async (alunoId: string) => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const { data } = await supabase.from('frequencias').select('status').eq('aluno_id', alunoId).gte('data', firstDay).lte('data', lastDay);
      if (!data || data.length === 0) return ok(null);
      const presentes = data.filter(f => ['presente', 'atrasado'].includes(f.status)).length;
      return ok(Math.round((presentes / data.length) * 100));
    },
  },

  justificativas: {
    list: async () => {
      const { data, error } = await supabase.from('justificativas').select(JUST_SELECT).order('created_at', { ascending: false });
      return error ? err(error.message) : ok((data || []).map(flattenJustificativa));
    },
    listByResponsavel: async (usuarioId: string) => {
      const { data: resp } = await supabase.from('responsaveis').select('id').eq('usuario_id', usuarioId).maybeSingle();
      if (!resp) return ok([]);
      const { data, error } = await supabase.from('justificativas').select(JUST_SELECT).eq('responsavel_id', resp.id).order('created_at', { ascending: false });
      return error ? err(error.message) : ok((data || []).map(flattenJustificativa));
    },
    listPendentes: async (escolaId: string) => {
      const { data: alunosData } = await supabase.from('alunos').select('id').eq('escola_id', escolaId).eq('ativo', true);
      const ids = (alunosData || []).map(a => a.id);
      if (ids.length === 0) return ok([]);
      const { data, error } = await supabase.from('justificativas').select(JUST_SELECT).in('aluno_id', ids).eq('status', 'pendente').order('created_at', { ascending: false });
      return error ? err(error.message) : ok((data || []).map(flattenJustificativa));
    },
    listByEscola: async (escolaId: string) => {
      const { data: alunosData } = await supabase.from('alunos').select('id').eq('escola_id', escolaId).eq('ativo', true);
      const ids = (alunosData || []).map(a => a.id);
      if (ids.length === 0) return ok([]);
      const { data, error } = await supabase.from('justificativas').select(JUST_SELECT).in('aluno_id', ids).order('created_at', { ascending: false });
      return error ? err(error.message) : ok((data || []).map(flattenJustificativa));
    },
    insert: async (data: { responsavel_id: string; aluno_id?: string | null; frequencia_id?: string | null; tipo?: string; descricao?: string | null; arquivo_url?: string | null; data_inicio?: string | null; data_fim?: string | null }) => {
      const { data: row, error } = await supabase.from('justificativas').insert({ ...data, status: 'pendente', tipo: data.tipo || 'Outros' }).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    update: async (id: string, data: { status?: string; observacao_diretor?: string | null }) => {
      const { error } = await supabase.from('justificativas').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
  },

  iotConfig: {
    getByEscola: async (escolaId: string) => {
      const { data, error } = await supabase.from('escola_iot_config').select('*').eq('escola_id', escolaId).maybeSingle();
      return error ? err(error.message) : ok(data);
    },
    upsert: async (data: { escola_id: string; ip_address?: string | null; ativo?: boolean; modo_verificacao?: string; captura_timeout?: number | null }) => {
      const { error } = await supabase.from('escola_iot_config').upsert({
        escola_id: data.escola_id,
        ip_address: data.ip_address || null,
        ativo: data.ativo !== false,
        modo_verificacao: data.modo_verificacao || 'entrada',
        captura_timeout: data.captura_timeout ?? 5,
      }, { onConflict: 'escola_id' });
      return error ? err(error.message) : ok(null);
    },
  },

  stats: {
    counts: async () => {
      const [{ count: escolas }, { count: alunos }] = await Promise.all([
        supabase.from('escolas').select('id', { count: 'exact', head: true }),
        supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('ativo', true),
      ]);
      const { data: profData } = await supabase.from('professores').select('usuarios(ativo)');
      const { data: dirData } = await supabase.from('diretores').select('usuarios(ativo)');
      return ok({
        escolas: escolas || 0,
        alunos: alunos || 0,
        professores: (profData || []).filter((p: any) => p.usuarios?.ativo !== false).length,
        diretores: (dirData || []).filter((d: any) => d.usuarios?.ativo !== false).length,
      });
    },
    countsByEscola: async (escolaId: string) => {
      const [{ count: alunos }, { count: turmas }] = await Promise.all([
        supabase.from('alunos').select('id', { count: 'exact', head: true }).eq('escola_id', escolaId).eq('ativo', true),
        supabase.from('turmas').select('id', { count: 'exact', head: true }).eq('escola_id', escolaId),
      ]);
      const { data: profLinks } = await supabase.from('professor_escolas').select('professor_id').eq('escola_id', escolaId);
      const profIds = (profLinks || []).map((l: any) => l.professor_id);
      let activeProfs = 0;
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from('professores').select('usuarios(ativo)').in('id', profIds);
        activeProfs = (profs || []).filter((p: any) => p.usuarios?.ativo !== false).length;
      }
      return ok({ alunos: alunos || 0, professores: activeProfs, turmas: turmas || 0 });
    },
    countsByProfessor: async (usuarioId: string) => {
      const { data: prof } = await supabase.from('professores').select('id').eq('usuario_id', usuarioId).maybeSingle();
      if (!prof) return ok({ turmas: 0, alunos: 0 });
      const { count: turmas } = await supabase.from('turma_professores').select('id', { count: 'exact', head: true }).eq('professor_id', prof.id);
      const { data: turmaLinks } = await supabase.from('turma_professores').select('turma_id').eq('professor_id', prof.id);
      const turmaIds = (turmaLinks || []).map((t: any) => t.turma_id);
      let alunos = 0;
      if (turmaIds.length > 0) {
        const { count } = await supabase.from('alunos').select('id', { count: 'exact', head: true }).in('turma_id', turmaIds).eq('ativo', true);
        alunos = count || 0;
      }
      return ok({ turmas: turmas || 0, alunos });
    },
  },

  turma_professores: {
    listByTurma: async (turmaId: string) => {
      const { data, error } = await supabase.from('turma_professores').select('professores(usuarios(nome))').eq('turma_id', turmaId);
      if (error) return err(error.message);
      return ok((data || []).map((tp: any) => ({ nome: tp.professores?.usuarios?.nome || '' })));
    },
    listProfessoresCompleto: async (turmaId: string) => {
      const { data, error } = await supabase.from('turma_professores').select('professor_id, professores(usuarios(nome))').eq('turma_id', turmaId);
      if (error) return err(error.message);
      return ok((data || []).map((tp: any) => ({ professor_id: tp.professor_id, nome: tp.professores?.usuarios?.nome || '' })));
    },
    setProfessores: async (turmaId: string, professorIds: string[]) => {
      await supabase.from('turma_professores').delete().eq('turma_id', turmaId);
      if (professorIds.length > 0) {
        await supabase.from('turma_professores').insert(professorIds.map(pid => ({ turma_id: turmaId, professor_id: pid })));
      }
      return ok(null);
    },
  },

  notificacoes: {
    listByDestinatario: async (usuarioId: string) => {
      const { data, error } = await supabase
        .from('notificacoes').select('*, usuarios!remetente_id(nome)')
        .eq('destinatario_id', usuarioId).order('data_envio', { ascending: false }).limit(50);
      if (error) return err(error.message);
      return ok((data || []).map((n: any) => ({ ...n, remetente_nome: n.usuarios?.nome || 'Sistema', lida: n.lida ? 1 : 0, usuarios: undefined })));
    },
    countUnread: async (usuarioId: string) => {
      const { count, error } = await supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('destinatario_id', usuarioId).eq('lida', false);
      return error ? err(error.message) : ok(count || 0);
    },
    insert: async (data: { remetente_id: string; destinatario_id: string; titulo: string; mensagem: string }) => {
      const { data: row, error } = await supabase.from('notificacoes').insert(data).select('id').single();
      return error ? err(error.message) : ok({ id: row!.id });
    },
    markAsRead: async (id: string) => {
      const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
      return error ? err(error.message) : ok(null);
    },
    markAllAsRead: async (usuarioId: string) => {
      const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('destinatario_id', usuarioId);
      return error ? err(error.message) : ok(null);
    },
  },
};
