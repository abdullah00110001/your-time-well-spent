-- Add sleep_logs table for Rise sleep tracking
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  bed_time timestamptz,
  wake_time timestamptz,
  duration_minutes integer,
  quality_rating integer CHECK (quality_rating BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sleep logs" ON public.sleep_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sleep logs" ON public.sleep_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sleep logs" ON public.sleep_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sleep logs" ON public.sleep_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON public.sleep_logs(user_id, log_date DESC);

CREATE TRIGGER update_sleep_logs_updated_at
  BEFORE UPDATE ON public.sleep_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();