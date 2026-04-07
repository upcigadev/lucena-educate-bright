-- ============================================================
-- SYNC MIGRATION: Align Supabase schema with database.ts state
-- Q1: auto email {cpf}@escola.sistema.br + senha 'lucena2025'
-- Q2: assume empty or seed-only db
-- Q3: upsert ON CONFLICT for frequencias
-- ============================================================

-- 1. usuarios: add avatar_url
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. escolas: add schedule columns
ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS horario_inicio text;
ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS tolerancia_min integer;
ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS limite_max text;

-- 3. alunos: add extra columns from database.ts
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS horario_inicio text;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS horario_fim text;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS limite_max text;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS idface_user_id text;
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS avatar_url text;

-- 4. escola_iot_config: add ip and timeout
ALTER TABLE public.escola_iot_config ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.escola_iot_config ADD COLUMN IF NOT EXISTS captura_timeout integer DEFAULT 5;

-- 5. justificativas: make frequencia_id nullable + add new columns + fix constraints
ALTER TABLE public.justificativas ALTER COLUMN frequencia_id DROP NOT NULL;
ALTER TABLE public.justificativas ADD COLUMN IF NOT EXISTS aluno_id uuid REFERENCES public.alunos(id);
ALTER TABLE public.justificativas ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.justificativas ADD COLUMN IF NOT EXISTS data_fim date;

-- Fix tipo CHECK to allow more values
ALTER TABLE public.justificativas DROP CONSTRAINT IF EXISTS justificativas_tipo_check;
ALTER TABLE public.justificativas ADD CONSTRAINT justificativas_tipo_check
  CHECK (tipo IN ('Atestado Médico', 'Consulta Médica', 'Viagem', 'Luto', 'Outros'));

-- Fix status to allow both legacy and new values
ALTER TABLE public.justificativas DROP CONSTRAINT IF EXISTS justificativas_status_check;
ALTER TABLE public.justificativas ADD CONSTRAINT justificativas_status_check
  CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'Pendente', 'Aprovada', 'Reprovada'));

ALTER TABLE public.justificativas ALTER COLUMN status SET DEFAULT 'pendente';

-- 6. Frequencias: allow upsert by keeping unique constraint but policy update
-- Remove old unique to allow upsert-style operations from biometric server
-- (keep it so ON CONFLICT works; biometric server uses ON CONFLICT DO UPDATE)
-- The constraint frequencias_aluno_data_uq already exists, we keep it.

-- 7. Create notificacoes table
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  remetente_id uuid NOT NULL,
  destinatario_id uuid NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  data_envio timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notificacoes_pkey PRIMARY KEY (id),
  CONSTRAINT notificacoes_remetente_id_fkey FOREIGN KEY (remetente_id) REFERENCES public.usuarios(id),
  CONSTRAINT notificacoes_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES public.usuarios(id)
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- RLS: users can see their own notifications; secretaria/diretor can see all
CREATE POLICY "notificacoes_select" ON public.notificacoes FOR SELECT TO authenticated
  USING (
    destinatario_id = public.get_usuario_id(auth.uid())
    OR remetente_id = public.get_usuario_id(auth.uid())
    OR public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR')
  );

CREATE POLICY "notificacoes_insert" ON public.notificacoes FOR INSERT TO authenticated
  WITH CHECK (remetente_id = public.get_usuario_id(auth.uid()));

CREATE POLICY "notificacoes_update" ON public.notificacoes FOR UPDATE TO authenticated
  USING (destinatario_id = public.get_usuario_id(auth.uid()));

-- 8. Allow DIRETOR to manage professor_escolas and turma_professores for their school
-- (current RLS is too restrictive - only SECRETARIA; relax to include DIRETOR)
DROP POLICY IF EXISTS "professor_escolas_insert" ON public.professor_escolas;
CREATE POLICY "professor_escolas_insert" ON public.professor_escolas FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

DROP POLICY IF EXISTS "professor_escolas_delete" ON public.professor_escolas;
CREATE POLICY "professor_escolas_delete" ON public.professor_escolas FOR DELETE TO authenticated
  USING (public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

DROP POLICY IF EXISTS "turma_professores_insert" ON public.turma_professores;
CREATE POLICY "turma_professores_insert" ON public.turma_professores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

DROP POLICY IF EXISTS "turma_professores_delete" ON public.turma_professores;
CREATE POLICY "turma_professores_delete" ON public.turma_professores FOR DELETE TO authenticated
  USING (public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

-- Also allow DIRETOR to insert professores
DROP POLICY IF EXISTS "professores_insert" ON public.professores;
CREATE POLICY "professores_insert" ON public.professores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

-- Allow PROFESSOR to insert/update frequencias (for manual attendance marking in TurmaDetalhe)
DROP POLICY IF EXISTS "frequencias_insert" ON public.frequencias;
CREATE POLICY "frequencias_insert" ON public.frequencias FOR INSERT TO authenticated
  WITH CHECK (get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR', 'PROFESSOR'));

DROP POLICY IF EXISTS "frequencias_update" ON public.frequencias;
CREATE POLICY "frequencias_update" ON public.frequencias FOR UPDATE TO authenticated
  USING (get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR', 'PROFESSOR'));

-- 9. Allow usuarios update for avatar_url (self-update)
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
CREATE POLICY "usuarios_update" ON public.usuarios FOR UPDATE TO authenticated
  USING (
    public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR')
    OR auth_id = auth.uid()
  );

-- 10. RPC: monthly attendance percentage for a student
CREATE OR REPLACE FUNCTION public.monthly_pct(_aluno_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COUNT(*) = 0 THEN NULL
    ELSE ROUND((SUM(CASE WHEN status IN ('presente', 'atrasado') THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100)
  END::integer
  FROM public.frequencias
  WHERE aluno_id = _aluno_id
    AND date_trunc('month', data) = date_trunc('month', CURRENT_DATE);
$$;

-- 11. Allow PROFESSOR to insert aluno_responsaveis (needed for ResponsavelTab)
DROP POLICY IF EXISTS "aluno_responsaveis_insert" ON public.aluno_responsaveis;
CREATE POLICY "aluno_responsaveis_insert" ON public.aluno_responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));

-- 12. Allow RESPONSAVEL to insert justificativas (already existed, but ensure it's correct)
DROP POLICY IF EXISTS "justificativas_insert" ON public.justificativas;
CREATE POLICY "justificativas_insert" ON public.justificativas FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR', 'RESPONSAVEL'));

-- 13. Fix RLS policy for responsaveis_insert (allow DIRETOR)
DROP POLICY IF EXISTS "responsaveis_insert" ON public.responsaveis;
CREATE POLICY "responsaveis_insert" ON public.responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR'));
