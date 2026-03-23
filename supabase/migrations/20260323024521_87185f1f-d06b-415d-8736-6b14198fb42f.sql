
CREATE OR REPLACE FUNCTION public.get_login_email_by_cpf(_cpf text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.email
  FROM public.usuarios u
  JOIN auth.users au ON au.id = u.auth_id
  WHERE u.cpf = replace(replace(replace(_cpf, '.', ''), '-', ''), ' ', '')
    AND u.ativo = true
  LIMIT 1;
$$;
