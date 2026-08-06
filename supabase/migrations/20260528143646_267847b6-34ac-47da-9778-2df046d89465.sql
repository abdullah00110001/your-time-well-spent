
-- Ringtones table
CREATE TABLE public.ringtones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  file_url TEXT NOT NULL,
  file_path TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ringtones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ringtones TO authenticated;
GRANT ALL ON public.ringtones TO service_role;

ALTER TABLE public.ringtones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active ringtones viewable by authenticated"
  ON public.ringtones FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert ringtones"
  ON public.ringtones FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update ringtones"
  ON public.ringtones FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete ringtones"
  ON public.ringtones FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ringtones_updated_at
  BEFORE UPDATE ON public.ringtones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ringtones_active_category ON public.ringtones (is_active, category, sort_order);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ringtones', 'ringtones', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read ringtone files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ringtones');

CREATE POLICY "Admins upload ringtone files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ringtones' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update ringtone files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'ringtones' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete ringtone files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ringtones' AND public.has_role(auth.uid(), 'admin'));
