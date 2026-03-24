import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

let dbInstance: SqlJsDatabase | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;

const DB_NAME = 'lucena_educacional';
const DB_STORE = 'sqlitedb';
const DB_KEY = 'main';

// ===== IndexedDB Persistence =====

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const req = store.get(DB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIDB(data: Uint8Array): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const req = store.put(data, DB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===== Schema =====

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  papel TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  auth_id TEXT UNIQUE,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escolas (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome TEXT NOT NULL,
  inep TEXT,
  endereco TEXT,
  telefone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome TEXT NOT NULL,
  escola_id TEXT NOT NULL REFERENCES escolas(id),
  horario_inicio TEXT DEFAULT '07:00',
  tolerancia_min INTEGER DEFAULT 15,
  limite_max TEXT DEFAULT '07:30',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS turmas (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome TEXT NOT NULL,
  serie_id TEXT NOT NULL REFERENCES series(id),
  escola_id TEXT NOT NULL REFERENCES escolas(id),
  sala TEXT,
  horario_inicio TEXT,
  tolerancia_min INTEGER,
  limite_max TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alunos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome_completo TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE,
  data_nascimento TEXT,
  escola_id TEXT NOT NULL REFERENCES escolas(id),
  turma_id TEXT REFERENCES turmas(id),
  responsavel_id TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS diretores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  usuario_id TEXT NOT NULL UNIQUE REFERENCES usuarios(id),
  escola_id TEXT NOT NULL REFERENCES escolas(id)
);

CREATE TABLE IF NOT EXISTS professores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  usuario_id TEXT NOT NULL UNIQUE REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS professor_escolas (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  professor_id TEXT NOT NULL REFERENCES professores(id),
  escola_id TEXT NOT NULL REFERENCES escolas(id)
);

CREATE TABLE IF NOT EXISTS responsaveis (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  usuario_id TEXT NOT NULL UNIQUE REFERENCES usuarios(id),
  telefone TEXT
);

CREATE TABLE IF NOT EXISTS aluno_responsaveis (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  aluno_id TEXT NOT NULL REFERENCES alunos(id),
  responsavel_id TEXT NOT NULL REFERENCES responsaveis(id),
  parentesco TEXT DEFAULT 'Responsavel',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS frequencias (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  aluno_id TEXT NOT NULL REFERENCES alunos(id),
  turma_id TEXT REFERENCES turmas(id),
  data TEXT NOT NULL,
  hora_entrada TEXT,
  hora_saida TEXT,
  status TEXT NOT NULL DEFAULT 'falta',
  motivo TEXT,
  dispositivo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS justificativas (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  frequencia_id TEXT NOT NULL REFERENCES frequencias(id),
  responsavel_id TEXT NOT NULL REFERENCES responsaveis(id),
  tipo TEXT NOT NULL DEFAULT 'Outros',
  descricao TEXT,
  arquivo_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente',
  observacao_diretor TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escola_iot_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  escola_id TEXT NOT NULL UNIQUE REFERENCES escolas(id),
  ativo INTEGER NOT NULL DEFAULT 1,
  modo_verificacao TEXT NOT NULL DEFAULT 'entrada',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS aluno_turma_historico (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  aluno_id TEXT NOT NULL REFERENCES alunos(id),
  turma_id TEXT REFERENCES turmas(id),
  turma_nome TEXT NOT NULL,
  serie_nome TEXT,
  data_inicio TEXT NOT NULL DEFAULT (datetime('now')),
  data_fim TEXT,
  observacao TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS iot_evento_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dispositivo_id TEXT NOT NULL,
  matricula TEXT NOT NULL,
  evento TEXT NOT NULL,
  timestamp_evento TEXT NOT NULL,
  status_processamento TEXT NOT NULL DEFAULT 'processado',
  erro TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS turma_professores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  turma_id TEXT NOT NULL REFERENCES turmas(id),
  professor_id TEXT NOT NULL REFERENCES professores(id)
);
`;

// ===== Seed Data =====

const SEED_SQL = `
-- Check if data already exists
INSERT OR IGNORE INTO usuarios (id, nome, cpf, papel, auth_id) VALUES
  ('u1', 'Secretaria Municipal', '11111111111', 'SECRETARIA', 'auth1'),
  ('u2', 'Maria Helena Costa', '22222222222', 'DIRETOR', 'auth2'),
  ('u3', 'Claudia Reis', '33333333333', 'PROFESSOR', 'auth3'),
  ('u4', 'José Santos', '44444444444', 'RESPONSAVEL', 'auth4'),
  ('u5', 'Roberto Lima', '55555555555', 'RESPONSAVEL', 'auth5');

INSERT OR IGNORE INTO escolas (id, nome, inep, endereco, telefone) VALUES
  ('e1', 'E.M. Machado de Assis', '25001001', 'Rua das Flores, 120 - Centro', '(83) 3292-1001'),
  ('e2', 'E.M. Monteiro Lobato', '25001002', 'Av. Brasil, 450 - Praia', '(83) 3292-1002'),
  ('e3', 'E.M. Cecília Meireles', '25001003', 'Rua do Sol, 88 - Centro', '(83) 3292-1003');

INSERT OR IGNORE INTO series (id, nome, escola_id, horario_inicio, tolerancia_min, limite_max) VALUES
  ('s1', '1º Ano', 'e1', '07:00', 15, '07:30'),
  ('s2', '2º Ano', 'e1', '07:00', 15, '07:30'),
  ('s3', '3º Ano', 'e1', '07:00', 15, '07:30'),
  ('s4', 'Pré-Escola', 'e2', '07:30', 15, '08:00'),
  ('s5', '1º Ano', 'e2', '07:00', 15, '07:30');

INSERT OR IGNORE INTO turmas (id, nome, serie_id, escola_id, sala) VALUES
  ('t1', '1º Ano A', 's1', 'e1', '101'),
  ('t2', '1º Ano B', 's1', 'e1', '102'),
  ('t3', '2º Ano A', 's2', 'e1', '201'),
  ('t4', '3º Ano A', 's3', 'e1', '301'),
  ('t5', 'Pré-Escola A', 's4', 'e2', '1'),
  ('t6', '1º Ano A', 's5', 'e2', '101');

INSERT OR IGNORE INTO alunos (id, nome_completo, matricula, data_nascimento, escola_id, turma_id) VALUES
  ('a1', 'Ana Clara Silva', '2025001', '2018-03-15', 'e1', 't1'),
  ('a2', 'Bruno Oliveira Santos', '2025002', '2018-06-22', 'e1', 't1'),
  ('a3', 'Carolina Mendes', '2025003', '2018-01-10', 'e1', 't2'),
  ('a4', 'Daniel Ferreira Costa', '2025004', '2017-11-05', 'e2', 't5'),
  ('a5', 'Eduarda Lima Souza', '2025005', '2018-09-18', 'e1', 't1'),
  ('a6', 'Felipe Rodrigues', '2025006', '2018-04-02', 'e1', 't3'),
  ('a7', 'Gabriela Souza Alves', '2025007', '2017-07-28', 'e1', 't3'),
  ('a8', 'Henrique Barbosa', '2025008', '2018-12-01', 'e1', 't4'),
  ('a9', 'Isabela Nunes Pereira', '2025009', '2018-05-14', 'e2', 't6'),
  ('a10', 'João Pedro Araújo', '2025010', '2017-10-30', 'e2', 't5');

INSERT OR IGNORE INTO diretores (id, usuario_id, escola_id) VALUES
  ('d1', 'u2', 'e1');

INSERT OR IGNORE INTO professores (id, usuario_id) VALUES
  ('p1', 'u3');

INSERT OR IGNORE INTO professor_escolas (id, professor_id, escola_id) VALUES
  ('pe1', 'p1', 'e1');

INSERT OR IGNORE INTO turma_professores (id, turma_id, professor_id) VALUES
  ('tp1', 't1', 'p1'),
  ('tp2', 't2', 'p1');

INSERT OR IGNORE INTO responsaveis (id, usuario_id, telefone) VALUES
  ('r1', 'u4', '(83) 99999-0001'),
  ('r2', 'u5', '(83) 99999-0002');

INSERT OR IGNORE INTO aluno_responsaveis (id, aluno_id, responsavel_id, parentesco) VALUES
  ('ar1', 'a1', 'r1', 'Pai/Mãe'),
  ('ar2', 'a2', 'r1', 'Pai/Mãe'),
  ('ar3', 'a4', 'r2', 'Pai/Mãe');

-- Seed some attendance data for today
INSERT OR IGNORE INTO frequencias (id, aluno_id, turma_id, data, hora_entrada, status) VALUES
  ('f1', 'a1', 't1', date('now'), '07:05', 'presente'),
  ('f2', 'a2', 't1', date('now'), '07:12', 'presente'),
  ('f3', 'a3', 't2', date('now'), '07:38', 'atrasado'),
  ('f4', 'a5', 't1', date('now'), NULL, 'falta'),
  ('f5', 'a6', 't3', date('now'), '07:08', 'presente'),
  ('f6', 'a7', 't3', date('now'), NULL, 'justificada'),
  ('f7', 'a8', 't4', date('now'), '07:03', 'presente'),
  ('f8', 'a9', 't6', date('now'), '07:42', 'atrasado'),
  ('f9', 'a10', 't5', date('now'), '07:15', 'presente');
`;

// ===== Init =====

async function initDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });

  const savedData = await loadFromIDB();
  const db = savedData ? new SQL.Database(savedData) : new SQL.Database();

  // Run schema (IF NOT EXISTS ensures idempotency)
  db.run(SCHEMA_SQL);

  // Seed only if empty
  const result = db.exec("SELECT COUNT(*) as c FROM usuarios");
  const count = result[0]?.values[0]?.[0] as number;
  if (count === 0) {
    db.run(SEED_SQL);
  }

  // Persist
  await persist(db);

  return db;
}

export async function persist(database?: SqlJsDatabase): Promise<void> {
  const db = database || dbInstance;
  if (!db) return;
  const data = db.export();
  await saveToIDB(new Uint8Array(data));
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = initDatabase().then(db => {
      dbInstance = db;
      return db;
    });
  }
  return initPromise;
}

// Helper to run a query and get results as typed objects
export async function query<T = Record<string, any>>(sql: string, params?: any[]): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export async function run(sql: string, params?: any[]): Promise<void> {
  const db = await getDb();
  db.run(sql, params);
  await persist(db);
}

export async function runReturning<T = Record<string, any>>(sql: string, params?: any[]): Promise<T | null> {
  const db = await getDb();
  db.run(sql, params);
  await persist(db);

  // Get the last inserted row
  const result = db.exec("SELECT last_insert_rowid()");
  if (result.length === 0) return null;

  return null;
}

// Generate a UUID-like ID
export function generateId(): string {
  return crypto.randomUUID();
}

// Reset database (for development)
export async function resetDatabase(): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const req = store.delete(DB_KEY);
    req.onsuccess = () => {
      dbInstance = null;
      initPromise = null;
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}
