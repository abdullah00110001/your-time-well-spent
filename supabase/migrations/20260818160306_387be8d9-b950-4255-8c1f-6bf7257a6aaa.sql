CREATE TABLE IF NOT EXISTS public.night_to_rise_allowed_apps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  package_name text NOT NULL,
  app_label text,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, package_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.night_to_rise_allowed_apps TO authenticated;
GRANT ALL ON public.night_to_rise_allowed_apps TO service_role;

ALTER TABLE public.night_to_rise_allowed_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own allowed apps"
  ON public.night_to_rise_allowed_apps FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own allowed apps"
  ON public.night_to_rise_allowed_apps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own allowed apps"
  ON public.night_to_rise_allowed_apps FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS night_to_rise_allowed_apps_user_idx
  ON public.night_to_rise_allowed_apps (user_id);