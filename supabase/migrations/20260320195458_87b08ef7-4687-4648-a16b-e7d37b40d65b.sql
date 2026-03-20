
-- 1. usuarios
CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text UNIQUE,
  nome text NOT NULL,
  cpf text NOT NULL UNIQUE,
  papel text NOT NULL CHECK (papel = ANY (ARRAY['SECRETARIA','DIRETOR','PROFESSOR','RESPONSAVEL'])),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  auth_id uuid UNIQUE,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id)
);

-- 2. escolas
CREATE TABLE public.escolas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  inep text UNIQUE,
  endereco text,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escolas_pkey PRIMARY KEY (id)
);

-- 3. series
CREATE TABLE public.series (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  escola_id uuid NOT NULL,
  horario_inicio time DEFAULT '07:00:00',
  tolerancia_min integer DEFAULT 15,
  limite_max time DEFAULT '07:30:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT series_pkey PRIMARY KEY (id),
  CONSTRAINT series_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id)
);

-- 4. turmas
CREATE TABLE public.turmas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  serie_id uuid NOT NULL,
  escola_id uuid NOT NULL,
  sala text,
  horario_inicio time,
  tolerancia_min integer,
  limite_max time,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT turmas_pkey PRIMARY KEY (id),
  CONSTRAINT turmas_serie_id_fkey FOREIGN KEY (serie_id) REFERENCES public.series(id),
  CONSTRAINT turmas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id)
);

-- 5. professores
CREATE TABLE public.professores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE,
  CONSTRAINT professores_pkey PRIMARY KEY (id),
  CONSTRAINT professores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);

-- 6. diretores
CREATE TABLE public.diretores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE,
  escola_id uuid NOT NULL,
  CONSTRAINT diretores_pkey PRIMARY KEY (id),
  CONSTRAINT diretores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT diretores_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id)
);

-- 7. responsaveis
CREATE TABLE public.responsaveis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE,
  telefone text,
  CONSTRAINT responsaveis_pkey PRIMARY KEY (id),
  CONSTRAINT responsaveis_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);

-- 8. alunos
CREATE TABLE public.alunos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  matricula text NOT NULL UNIQUE,
  data_nascimento date,
  turma_id uuid,
  escola_id uuid NOT NULL,
  responsavel_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alunos_pkey PRIMARY KEY (id),
  CONSTRAINT alunos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id),
  CONSTRAINT alunos_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.responsaveis(id)
);

-- 9. aluno_responsaveis
CREATE TABLE public.aluno_responsaveis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  responsavel_id uuid NOT NULL,
  parentesco text DEFAULT 'Responsavel',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aluno_responsaveis_pkey PRIMARY KEY (id),
  CONSTRAINT aluno_responsaveis_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT aluno_responsaveis_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.responsaveis(id)
);

-- 10. aluno_turma_historico
CREATE TABLE public.aluno_turma_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  turma_id uuid,
  turma_nome text NOT NULL,
  serie_nome text,
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aluno_turma_historico_pkey PRIMARY KEY (id),
  CONSTRAINT aluno_turma_historico_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT aluno_turma_historico_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
);

-- 11. professor_escolas
CREATE TABLE public.professor_escolas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL,
  escola_id uuid NOT NULL,
  CONSTRAINT professor_escolas_pkey PRIMARY KEY (id),
  CONSTRAINT professor_escolas_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.professores(id),
  CONSTRAINT professor_escolas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id)
);

-- 12. turma_professores
CREATE TABLE public.turma_professores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  CONSTRAINT turma_professores_pkey PRIMARY KEY (id),
  CONSTRAINT turma_professores_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT turma_professores_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.professores(id)
);
