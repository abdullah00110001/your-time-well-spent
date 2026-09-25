CREATE TABLE public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  severity text NOT NULL,
  reason text NOT NULL,
  matched_text text,
  context_label text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity log"
  ON public.activity_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity log"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity log"
  ON public.activity_log FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX activity_log_user_created_idx ON public.activity_log (user_id, created_at DESC);
CREATE INDEX activity_log_user_source_idx ON public.activity_log (user_id, source, created_at DESC);