
-- Drop the recursive policy
DROP POLICY "usuarios_select" ON public.usuarios;

-- Create security definer function to get visible usuario IDs for a director
CREATE OR REPLACE FUNCTION public.get_diretor_visible_usuario_ids(_auth_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- The director's own usuario id
  SELECT id FROM public.usuarios WHERE auth_id = _auth_id
  UNION
  -- Professors in director's schools
  SELECT u.id FROM public.usuarios u
  JOIN public.professores p ON p.usuario_id = u.id
  JOIN public.professor_escolas pe ON pe.professor_id = p.id
  WHERE pe.escola_id IN (
    SELECT d.escola_id FROM public.diretores d
    JOIN public.usuarios u2 ON u2.id = d.usuario_id
    WHERE u2.auth_id = _auth_id
  )
  UNION
  -- Responsaveis of students in director's schools
  SELECT u.id FROM public.usuarios u
  JOIN public.responsaveis r ON r.usuario_id = u.id
  JOIN public.aluno_responsaveis ar ON ar.responsavel_id = r.id
  JOIN public.alunos a ON a.id = ar.aluno_id
  WHERE a.escola_id IN (
    SELECT d.escola_id FROM public.diretores d
    JOIN public.usuarios u2 ON u2.id = d.usuario_id
    WHERE u2.auth_id = _auth_id
  );
$$;

-- Recreate policy without recursion
CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.get_user_papel(auth.uid()) = 'SECRETARIA'
    OR (public.get_user_papel(auth.uid()) = 'DIRETOR' AND id IN (SELECT public.get_diretor_visible_usuario_ids(auth.uid())))
  );
