-- Sleep to Rise: nightly protection logs
CREATE TABLE IF NOT EXISTS public.night_to_rise_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sleep_protected BOOLEAN NOT NULL DEFAULT false,
  rise_protected BOOLEAN NOT NULL DEFAULT false,
  actual_sleep_minutes INTEGER,
  target_sleep_minutes INTEGER,
  blocked_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.night_to_rise_logs TO authenticated;
GRANT ALL ON public.night_to_rise_logs TO service_role;
ALTER TABLE public.night_to_rise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own night logs"
  ON public.night_to_rise_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Group members may read only rows of users who share a group with them.
CREATE POLICY "Group members can read shared night logs"
  ON public.night_to_rise_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lifeos_group_members me
      JOIN public.lifeos_group_members them ON them.group_id = me.group_id
      WHERE me.user_id = auth.uid() AND them.user_id = night_to_rise_logs.user_id
    )
  );

-- Sleep to Rise: pause-for-one-night records
CREATE TABLE IF NOT EXISTS public.night_to_rise_pauses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.night_to_rise_pauses TO authenticated;
GRANT ALL ON public.night_to_rise_pauses TO service_role;
ALTER TABLE public.night_to_rise_pauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pauses"
  ON public.night_to_rise_pauses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sleep to Rise: blocked-attempt events (analytics)
CREATE TABLE IF NOT EXISTS public.night_to_rise_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  package_name TEXT,
  window_type TEXT NOT NULL DEFAULT 'sleep',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.night_to_rise_events TO authenticated;
GRANT ALL ON public.night_to_rise_events TO service_role;
ALTER TABLE public.night_to_rise_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own block events"
  ON public.night_to_rise_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_n2r_logs_user_date ON public.night_to_rise_logs (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_n2r_events_user_time ON public.night_to_rise_events (user_id, occurred_at DESC);