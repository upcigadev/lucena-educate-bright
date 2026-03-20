-- 1. Frequências table
CREATE TABLE public.frequencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  turma_id uuid REFERENCES public.turmas(id),
  data date NOT NULL,
  status text NOT NULL DEFAULT 'falta' CHECK (status IN ('presente', 'atraso', 'falta', 'justificado')),
  hora_entrada timestamptz,
  hora_saida timestamptz,
  dispositivo_id text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT frequencias_pkey PRIMARY KEY (id),
  CONSTRAINT frequencias_aluno_data_uq UNIQUE (aluno_id, data)
);

ALTER TABLE public.frequencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frequencias_select" ON public.frequencias FOR SELECT TO authenticated
  USING (
    get_user_papel(auth.uid()) = 'SECRETARIA'
    OR (get_user_papel(auth.uid()) = 'DIRETOR' AND turma_id IN (
      SELECT t.id FROM public.turmas t WHERE t.escola_id IN (SELECT get_diretor_escola_ids(auth.uid()))
    ))
    OR (get_user_papel(auth.uid()) = 'PROFESSOR' AND turma_id IN (SELECT get_professor_turma_ids(auth.uid())))
    OR (get_user_papel(auth.uid()) = 'RESPONSAVEL' AND aluno_id IN (SELECT get_responsavel_aluno_ids(auth.uid())))
  );

CREATE POLICY "frequencias_insert" ON public.frequencias FOR INSERT TO authenticated
  WITH CHECK (
    get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR')
  );

CREATE POLICY "frequencias_update" ON public.frequencias FOR UPDATE TO authenticated
  USING (
    get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR')
  );

-- 2. Justificativas table
CREATE TABLE public.justificativas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  frequencia_id uuid NOT NULL REFERENCES public.frequencias(id),
  responsavel_id uuid NOT NULL REFERENCES public.responsaveis(id),
  tipo text NOT NULL DEFAULT 'Outros' CHECK (tipo IN ('Atestado Médico', 'Viagem', 'Outros')),
  descricao text,
  arquivo_url text,
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovada', 'Reprovada')),
  observacao_diretor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT justificativas_pkey PRIMARY KEY (id)
);

ALTER TABLE public.justificativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "justificativas_select" ON public.justificativas FOR SELECT TO authenticated
  USING (
    get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR')
    OR (get_user_papel(auth.uid()) = 'RESPONSAVEL' AND responsavel_id IN (
      SELECT r.id FROM public.responsaveis r WHERE r.usuario_id = get_usuario_id(auth.uid())
    ))
  );

CREATE POLICY "justificativas_insert" ON public.justificativas FOR INSERT TO authenticated
  WITH CHECK (
    get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR', 'RESPONSAVEL')
  );

CREATE POLICY "justificativas_update" ON public.justificativas FOR UPDATE TO authenticated
  USING (
    get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR')
  );

-- 3. IoT config table
CREATE TABLE public.escola_iot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) UNIQUE,
  modo_verificacao text NOT NULL DEFAULT 'entrada' CHECK (modo_verificacao IN ('entrada', 'entrada_saida')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escola_iot_config_pkey PRIMARY KEY (id)
);

ALTER TABLE public.escola_iot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escola_iot_config_select" ON public.escola_iot_config FOR SELECT TO authenticated
  USING (get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

CREATE POLICY "escola_iot_config_insert" ON public.escola_iot_config FOR INSERT TO authenticated
  WITH CHECK (get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

CREATE POLICY "escola_iot_config_update" ON public.escola_iot_config FOR UPDATE TO authenticated
  USING (get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

-- 4. IoT event log table
CREATE TABLE public.iot_evento_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dispositivo_id text NOT NULL,
  matricula text NOT NULL,
  evento text NOT NULL,
  timestamp_evento timestamptz NOT NULL,
  status_processamento text NOT NULL DEFAULT 'processado',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iot_evento_log_pkey PRIMARY KEY (id)
);

ALTER TABLE public.iot_evento_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iot_evento_log_select" ON public.iot_evento_log FOR SELECT TO authenticated
  USING (get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));