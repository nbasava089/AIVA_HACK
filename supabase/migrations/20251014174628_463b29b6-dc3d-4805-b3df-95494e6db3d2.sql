-- Create storage bucket for assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', false);

-- Storage policies for assets bucket
CREATE POLICY "Users can view assets in their tenant"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assets' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Editors and admins can upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assets' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Editors and admins can update assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'assets' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assets' AND
    (storage.foldername(name))[1] IN (
      SELECT p.tenant_id::text 
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.tenant_id = p.tenant_id
      WHERE p.id = auth.uid() AND ur.role = 'admin'
    )
  );