// TODO: Replace with SQLite integration
// This file provides mock data and stub functions for all database operations

export interface MockResponse<T> {
  data: T | null;
  error: null | { message: string };
  count?: number;
}

function ok<T>(data: T, count?: number): MockResponse<T> {
  return { data, error: null, count };
}

function empty(): MockResponse<null> {
  return { data: null, error: null };
}

// ===== Mock Data =====

export const mockEscolas = [
  { id: '1', nome: 'E.M. Machado de Assis', inep: '25001001', endereco: 'Rua das Flores, 120 - Centro', telefone: '(83) 3292-1001', created_at: '2025-01-01' },
  { id: '2', nome: 'E.M. Monteiro Lobato', inep: '25001002', endereco: 'Av. Brasil, 450 - Praia', telefone: '(83) 3292-1002', created_at: '2025-01-01' },
  { id: '3', nome: 'E.M. Cecília Meireles', inep: '25001003', endereco: 'Rua do Sol, 88 - Centro', telefone: '(83) 3292-1003', created_at: '2025-01-01' },
];

export const mockSeries = [
  { id: 's1', nome: '1º Ano', escola_id: '1', horario_inicio: '07:00', tolerancia_min: 15, limite_max: '07:30', created_at: '2025-01-01' },
  { id: 's2', nome: '2º Ano', escola_id: '1', horario_inicio: '07:00', tolerancia_min: 15, limite_max: '07:30', created_at: '2025-01-01' },
  { id: 's3', nome: 'Pré-Escola', escola_id: '2', horario_inicio: '07:30', tolerancia_min: 15, limite_max: '08:00', created_at: '2025-01-01' },
];

export const mockTurmas = [
  { id: 't1', nome: '1º Ano A', serie_id: 's1', escola_id: '1', sala: '101', horario_inicio: null, tolerancia_min: null, limite_max: null, created_at: '2025-01-01' },
  { id: 't2', nome: '1º Ano B', serie_id: 's1', escola_id: '1', sala: '102', horario_inicio: null, tolerancia_min: null, limite_max: null, created_at: '2025-01-01' },
  { id: 't3', nome: '2º Ano A', serie_id: 's2', escola_id: '1', sala: '201', horario_inicio: null, tolerancia_min: null, limite_max: null, created_at: '2025-01-01' },
  { id: 't4', nome: 'Pré-Escola A', serie_id: 's3', escola_id: '2', sala: '1', horario_inicio: null, tolerancia_min: null, limite_max: null, created_at: '2025-01-01' },
];

export const mockAlunos = [
  { id: 'a1', nome_completo: 'Ana Clara Silva', matricula: '2025001', data_nascimento: '2018-03-15', escola_id: '1', turma_id: 't1', responsavel_id: null, ativo: true, created_at: '2025-01-01' },
  { id: 'a2', nome_completo: 'Bruno Oliveira Santos', matricula: '2025002', data_nascimento: '2018-06-22', escola_id: '1', turma_id: 't1', responsavel_id: null, ativo: true, created_at: '2025-01-01' },
  { id: 'a3', nome_completo: 'Carolina Mendes', matricula: '2025003', data_nascimento: '2018-01-10', escola_id: '1', turma_id: 't2', responsavel_id: null, ativo: true, created_at: '2025-01-01' },
  { id: 'a4', nome_completo: 'Daniel Ferreira Costa', matricula: '2025004', data_nascimento: '2017-11-05', escola_id: '2', turma_id: 't4', responsavel_id: null, ativo: true, created_at: '2025-01-01' },
];

export const mockUsuarios = [
  { id: 'u1', nome: 'Secretaria Municipal', cpf: '11111111111', papel: 'SECRETARIA', ativo: true, auth_id: 'auth1', email: null, created_at: '2025-01-01' },
  { id: 'u2', nome: 'Maria Helena Costa', cpf: '22222222222', papel: 'DIRETOR', ativo: true, auth_id: 'auth2', email: null, created_at: '2025-01-01' },
  { id: 'u3', nome: 'Claudia Reis', cpf: '33333333333', papel: 'PROFESSOR', ativo: true, auth_id: 'auth3', email: null, created_at: '2025-01-01' },
  { id: 'u4', nome: 'José Santos', cpf: '44444444444', papel: 'RESPONSAVEL', ativo: true, auth_id: 'auth4', email: null, created_at: '2025-01-01' },
];

export const mockDiretores = [
  { id: 'd1', usuario_id: 'u2', escola_id: '1' },
];

export const mockProfessores = [
  { id: 'p1', usuario_id: 'u3' },
];

export const mockProfessorEscolas = [
  { id: 'pe1', professor_id: 'p1', escola_id: '1' },
];

export const mockResponsaveis = [
  { id: 'r1', usuario_id: 'u4', telefone: '(83) 99999-0001' },
];

export const mockAlunoResponsaveis: any[] = [];

export const mockFrequencias: any[] = [];

export const mockJustificativas: any[] = [];

// ===== Stub Functions =====
// TODO: Replace these with actual SQLite queries

export const db = {
  escolas: {
    list: () => ok(mockEscolas),
    getById: (id: string) => ok(mockEscolas.find(e => e.id === id) || null),
    insert: (_data: any) => { console.log('TODO: insert escola', _data); return ok({ id: crypto.randomUUID() }); },
    update: (_id: string, _data: any) => { console.log('TODO: update escola', _id, _data); return ok(null); },
  },
  series: {
    listByEscola: (escolaId: string) => ok(mockSeries.filter(s => s.escola_id === escolaId)),
    insert: (_data: any) => { console.log('TODO: insert serie', _data); return ok({ id: crypto.randomUUID() }); },
  },
  turmas: {
    listByEscola: (escolaId: string) => ok(mockTurmas.filter(t => t.escola_id === escolaId)),
    listAll: () => ok(mockTurmas),
    getById: (id: string) => ok(mockTurmas.find(t => t.id === id) || null),
    insert: (_data: any) => { console.log('TODO: insert turma', _data); return ok({ id: crypto.randomUUID() }); },
  },
  alunos: {
    list: () => ok(mockAlunos.map(a => {
      const turma = mockTurmas.find(t => t.id === a.turma_id);
      const serie = turma ? mockSeries.find(s => s.id === turma.serie_id) : null;
      const escola = mockEscolas.find(e => e.id === a.escola_id);
      return { ...a, turma_nome: turma?.nome || 'Sem turma', serie_nome: serie?.nome || '', escola_nome: escola?.nome || '' };
    })),
    listByTurma: (turmaId: string) => ok(mockAlunos.filter(a => a.turma_id === turmaId && a.ativo)),
    insert: (_data: any) => { console.log('TODO: insert aluno', _data); return ok({ id: crypto.randomUUID() }); },
    update: (_id: string, _data: any) => { console.log('TODO: update aluno', _id, _data); return ok(null); },
  },
  usuarios: {
    getByAuthId: (authId: string) => ok(mockUsuarios.find(u => u.auth_id === authId && u.ativo) || null),
    update: (_id: string, _data: any) => { console.log('TODO: update usuario', _id, _data); return ok(null); },
    insert: (_data: any) => { console.log('TODO: insert usuario', _data); return ok({ id: crypto.randomUUID() }); },
  },
  diretores: {
    list: () => ok(mockDiretores.map(d => {
      const u = mockUsuarios.find(u => u.id === d.usuario_id);
      const e = mockEscolas.find(e => e.id === d.escola_id);
      return { ...d, nome: u?.nome || '', cpf: u?.cpf || '', escola_nome: e?.nome || '' };
    })),
    update: (_id: string, _data: any) => { console.log('TODO: update diretor', _id, _data); return ok(null); },
    listByUsuario: (usuarioId: string) => ok(mockDiretores.filter(d => d.usuario_id === usuarioId).map(d => {
      const e = mockEscolas.find(e => e.id === d.escola_id);
      return { escola_id: d.escola_id, escolas: e };
    })),
  },
  professores: {
    list: () => ok(mockProfessores.map(p => {
      const u = mockUsuarios.find(u => u.id === p.usuario_id);
      const pes = mockProfessorEscolas.filter(pe => pe.professor_id === p.id);
      return { ...p, nome: u?.nome || '', cpf: u?.cpf || '', escolas: pes.map(pe => mockEscolas.find(e => e.id === pe.escola_id)?.nome || '') };
    })),
  },
  professorEscolas: {
    listByProfessor: (profId: string) => ok(mockProfessorEscolas.filter(pe => pe.professor_id === profId).map(pe => {
      const e = mockEscolas.find(e => e.id === pe.escola_id);
      return { escola_id: pe.escola_id, escolas: e };
    })),
    deleteByProfessor: (_profId: string) => { console.log('TODO: delete professor_escolas'); return ok(null); },
    insert: (_data: any) => { console.log('TODO: insert professor_escolas', _data); return ok(null); },
  },
  responsaveis: {
    list: () => ok(mockResponsaveis.map(r => {
      const u = mockUsuarios.find(u => u.id === r.usuario_id);
      return { ...r, nome: u?.nome || '', cpf: u?.cpf || '', alunos: [] as string[] };
    })),
    update: (_id: string, _data: any) => { console.log('TODO: update responsavel', _id, _data); return ok(null); },
  },
  frequencias: {
    listByAlunos: (_alunoIds: string[], _start: string, _end: string) => ok(mockFrequencias),
    listAll: () => ok(mockFrequencias),
  },
  justificativas: {
    list: () => ok(mockJustificativas),
    insert: (_data: any) => { console.log('TODO: insert justificativa', _data); return ok(null); },
    update: (_id: string, _data: any) => { console.log('TODO: update justificativa', _id, _data); return ok(null); },
  },
  stats: {
    counts: () => ok({ escolas: mockEscolas.length, alunos: mockAlunos.length, professores: mockProfessores.length, diretores: mockDiretores.length }),
  },
};
