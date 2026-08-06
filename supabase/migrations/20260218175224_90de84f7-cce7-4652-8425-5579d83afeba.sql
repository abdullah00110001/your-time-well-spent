-- Create storage bucket for app releases (APK files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-releases', 'app-releases', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to download APK files
CREATE POLICY "Public can download app releases"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-releases');

-- Only admins can upload APK files
CREATE POLICY "Admins can upload app releases"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'app-releases' 
  AND EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE user_id = auth.uid()
  )
);

-- Only admins can update APK files
CREATE POLICY "Admins can update app releases"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'app-releases' 
  AND EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE user_id = auth.uid()
  )
);

-- Only admins can delete APK files
CREATE POLICY "Admins can delete app releases"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'app-releases' 
  AND EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE user_id = auth.uid()
  )
);