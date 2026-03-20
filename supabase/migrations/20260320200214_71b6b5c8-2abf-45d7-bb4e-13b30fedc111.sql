
-- Enable RLS on all tables
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diretores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_turma_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turma_professores ENABLE ROW LEVEL SECURITY;

-- Security definer function to get user papel
CREATE OR REPLACE FUNCTION public.get_user_papel(_auth_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel FROM public.usuarios WHERE auth_id = _auth_id AND ativo = true LIMIT 1;
$$;

-- Security definer function to get user id from auth_id
CREATE OR REPLACE FUNCTION public.get_usuario_id(_auth_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.usuarios WHERE auth_id = _auth_id LIMIT 1;
$$;

-- Security definer: check if user is director of a school
CREATE OR REPLACE FUNCTION public.is_diretor_of_escola(_auth_id uuid, _escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.diretores d
    JOIN public.usuarios u ON u.id = d.usuario_id
    WHERE u.auth_id = _auth_id AND d.escola_id = _escola_id
  );
$$;

-- Security definer: get escola_ids for a director
CREATE OR REPLACE FUNCTION public.get_diretor_escola_ids(_auth_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.escola_id FROM public.diretores d
  JOIN public.usuarios u ON u.id = d.usuario_id
  WHERE u.auth_id = _auth_id;
$$;

-- Security definer: get escola_ids for a professor
CREATE OR REPLACE FUNCTION public.get_professor_escola_ids(_auth_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pe.escola_id FROM public.professor_escolas pe
  JOIN public.professores p ON p.id = pe.professor_id
  JOIN public.usuarios u ON u.id = p.usuario_id
  WHERE u.auth_id = _auth_id;
$$;

-- Security definer: get turma_ids for a professor
CREATE OR REPLACE FUNCTION public.get_professor_turma_ids(_auth_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tp.turma_id FROM public.turma_professores tp
  JOIN public.professores p ON p.id = tp.professor_id
  JOIN public.usuarios u ON u.id = p.usuario_id
  WHERE u.auth_id = _auth_id;
$$;

-- Security definer: get aluno_ids for a responsavel
CREATE OR REPLACE FUNCTION public.get_responsavel_aluno_ids(_auth_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ar.aluno_id FROM public.aluno_responsaveis ar
  JOIN public.responsaveis r ON r.id = ar.responsavel_id
  JOIN public.usuarios u ON u.id = r.usuario_id
  WHERE u.auth_id = _auth_id
  UNION
  SELECT a.id FROM public.alunos a
  JOIN public.responsaveis r ON r.id = a.responsavel_id
  JOIN public.usuarios u ON u.id = r.usuario_id
  WHERE u.auth_id = _auth_id;
$$;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- USUARIOS: all authenticated can read their own, SECRETARIA can do all
CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.get_user_papel(auth.uid()) = 'SECRETARIA'
    OR (public.get_user_papel(auth.uid()) = 'DIRETOR' AND id IN (
      SELECT u2.id FROM public.usuarios u2
      JOIN public.professores p ON p.usuario_id = u2.id
      JOIN public.professor_escolas pe ON pe.professor_id = p.id
      WHERE pe.escola_id IN (SELECT public.get_diretor_escola_ids(auth.uid()))
      UNION
      SELECT u2.id FROM public.usuarios u2
      JOIN public.responsaveis r ON r.usuario_id = u2.id
      JOIN public.aluno_responsaveis ar ON ar.responsavel_id = r.id
      JOIN public.alunos a ON a.id = ar.aluno_id
      WHERE a.escola_id IN (SELECT public.get_diretor_escola_ids(auth.uid()))
    ))
  );

CREATE POLICY "usuarios_insert" ON public.usuarios FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA','DIRETOR'));

CREATE POLICY "usuarios_update" ON public.usuarios FOR UPDATE TO authenticated
  USING (public.get_user_papel(auth.uid()) IN ('SECRETARIA','DIRETOR'));

-- ESCOLAS
CREATE POLICY "escolas_select" ON public.escolas FOR SELECT TO authenticated USING (true);

CREATE POLICY "escolas_insert" ON public.escolas FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) = 'SECRETARIA');

CREATE POLICY "escolas_update" ON public.escolas FOR UPDATE TO authenticated
  USING (public.get_user_papel(auth.uid()) = 'SECRETARIA');

-- SERIES
CREATE POLICY "series_select" ON public.series FOR SELECT TO authenticated USING (true);

CREATE POLICY "series_insert" ON public.series FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_papel(auth.uid()) = 'SECRETARIA'
    OR public.is_diretor_of_escola(auth.uid(), escola_id)
  );

CREATE POLICY "series_update" ON public.series FOR UPDATE TO authenticated
  USING (
    public.get_user_papel(auth.uid()) = 'SECRETARIA'
    OR public.is_diretor_of_escola(auth.uid(), escola_id)
  );

-- TURMAS
CREATE POLICY "turmas_select" ON public.turmas FOR SELECT TO authenticated USING (true);

CREATE POLICY "turmas_insert" ON public.turmas FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_papel(auth.uid()) = 'SECRETARIA'
    OR public.is_diretor_of_escola(auth.uid(), escola_id)
  );

CREATE POLICY "turmas_update" ON public.turmas FOR UPDATE TO authenticated
  USING (
    public.get_user_papel(auth.uid()) = 'SECRETARIA'
    OR public.is_diretor_of_escola(auth.uid(), escola_id)
  );

-- PROFESSORES
CREATE POLICY "professores_select" ON public.professores FOR SELECT TO authenticated USING (true);

CREATE POLICY "professores_insert" ON public.professores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA'));

CREATE POLICY "professores_update" ON public.professores FOR UPDATE TO authenticated
  USING (public.get_user_papel(auth.uid()) = 'SECRETARIA');

-- DIRETORES
CREATE POLICY "diretores_select" ON public.diretores FOR SELECT TO authenticated USING (true);

CREATE POLICY "diretores_insert" ON public.diretores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) = 'SECRETARIA');

CREATE POLICY "diretores_update" ON public.diretores FOR UPDATE TO authenticated
  USING (public.get_user_papel(auth.uid()) = 'SECRETARIA');

-- RESPONSAVEIS
CREATE POLICY "responsaveis_select" ON public.responsaveis FOR SELECT TO authenticated
  USING (
    public.get_user_papel(auth.uid()) IN ('SECRETARIA','DIRETOR')
    OR usuario_id = public.get_usuario_id(auth.uid())
  );

CREATE POLICY "responsaveis_insert" ON public.responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA','DIRETOR'));

CREATE POLICY "responsaveis_update" ON public.responsaveis FOR UPDATE TO authenticated
  USING (public.get_user_papel(auth.uid()) IN ('SECRETARIA','DIRETOR'));

-- ALUNOS
CREATE POLICY "alunos_select" ON public.alunos FOR SELECT TO authenticated
  USING (
    public.get_user_papel(auth.uid()) IN ('SECRETARIA')
    OR (public.get_user_papel(auth.uid()) = 'DIRETOR' AND escola_id IN (SELECT public.get_diretor_escola_ids(auth.uid())))
    OR (public.get_user_papel(auth.uid()) = 'PROFESSOR' AND turma_id IN (SELECT public.get_professor_turma_ids(auth.uid())))
    OR (public.get_user_papel(auth.uid()) = 'RESPONSAVEL' AND id IN (SELECT public.get_responsavel_aluno_ids(auth.uid())))
  );

CREATE POLICY "alunos_insert" ON public.alunos FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_papel(auth.uid()) = 'SECRETARIA'
    OR (public.get_user_papel(auth.uid()) = 'DIRETOR' AND escola_id IN (SELECT public.get_diretor_escola_ids(auth.uid())))
  );

CREATE POLICY "alunos_update" ON public.alunos FOR UPDATE TO authenticated
  USING (
    public.get_user_papel(auth.uid()) = 'SECRETARIA'
    OR (public.get_user_papel(auth.uid()) = 'DIRETOR' AND escola_id IN (SELECT public.get_diretor_escola_ids(auth.uid())))
  );

-- ALUNO_RESPONSAVEIS
CREATE POLICY "aluno_responsaveis_select" ON public.aluno_responsaveis FOR SELECT TO authenticated USING (true);

CREATE POLICY "aluno_responsaveis_insert" ON public.aluno_responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA','DIRETOR'));

CREATE POLICY "aluno_responsaveis_update" ON public.aluno_responsaveis FOR UPDATE TO authenticated
  USING (public.get_user_papel(auth.uid()) IN ('SECRETARIA','DIRETOR'));

-- ALUNO_TURMA_HISTORICO
CREATE POLICY "aluno_turma_historico_select" ON public.aluno_turma_historico FOR SELECT TO authenticated USING (true);

CREATE POLICY "aluno_turma_historico_insert" ON public.aluno_turma_historico FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA','DIRETOR'));

-- PROFESSOR_ESCOLAS
CREATE POLICY "professor_escolas_select" ON public.professor_escolas FOR SELECT TO authenticated USING (true);

CREATE POLICY "professor_escolas_insert" ON public.professor_escolas FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) = 'SECRETARIA');

CREATE POLICY "professor_escolas_update" ON public.professor_escolas FOR UPDATE TO authenticated
  USING (public.get_user_papel(auth.uid()) = 'SECRETARIA');

CREATE POLICY "professor_escolas_delete" ON public.professor_escolas FOR DELETE TO authenticated
  USING (public.get_user_papel(auth.uid()) = 'SECRETARIA');

-- TURMA_PROFESSORES
CREATE POLICY "turma_professores_select" ON public.turma_professores FOR SELECT TO authenticated USING (true);

CREATE POLICY "turma_professores_insert" ON public.turma_professores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) = 'SECRETARIA');

CREATE POLICY "turma_professores_update" ON public.turma_professores FOR UPDATE TO authenticated
  USING (public.get_user_papel(auth.uid()) = 'SECRETARIA');

CREATE POLICY "turma_professores_delete" ON public.turma_professores FOR DELETE TO authenticated
  USING (public.get_user_papel(auth.uid()) = 'SECRETARIA');
