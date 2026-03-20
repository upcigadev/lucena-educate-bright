-- Create atestados storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('atestados', 'atestados', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

-- RLS: SECRETARIA and DIRETOR can read all files
CREATE POLICY "atestados_select_admin" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'atestados'
    AND (
      public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR')
    )
  );

-- RLS: RESPONSAVEL can read only their own uploads
CREATE POLICY "atestados_select_owner" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'atestados'
    AND public.get_user_papel(auth.uid()) = 'RESPONSAVEL'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: RESPONSAVEL can upload to their own folder
CREATE POLICY "atestados_insert_owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'atestados'
    AND public.get_user_papel(auth.uid()) IN ('SECRETARIA', 'DIRETOR', 'RESPONSAVEL')
  );

-- RLS: No one can delete (LGPD retention handled by scheduled function)
-- RLS: No update needed