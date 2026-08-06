CREATE TABLE IF NOT EXISTS public.ota_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  release_notes TEXT,
  bundle_url TEXT NOT NULL,
  bundle_path TEXT NOT NULL,
  bundle_size_bytes BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_app_version_code INTEGER,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ota_bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ota_bundles TO authenticated;
GRANT ALL ON public.ota_bundles TO service_role;

ALTER TABLE public.ota_bundles ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauth native clients) can read active bundles for OTA sync.
CREATE POLICY "Anyone can read active bundles"
ON public.ota_bundles FOR SELECT
USING (is_active = true);

-- Admins can read all bundles
CREATE POLICY "Admins can read all bundles"
ON public.ota_bundles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage bundles
CREATE POLICY "Admins can insert bundles"
ON public.ota_bundles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update bundles"
ON public.ota_bundles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete bundles"
ON public.ota_bundles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ota_bundles_updated_at
BEFORE UPDATE ON public.ota_bundles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for the app-releases bucket (admin upload, public read)
CREATE POLICY "Public can read app-releases"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-releases');

CREATE POLICY "Admins can upload app-releases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update app-releases"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete app-releases"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'::app_role));
