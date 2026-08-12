CREATE TABLE IF NOT EXISTS public.group_wake_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  alarm_date DATE NOT NULL,
  triggered_by UUID,
  wake_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, alarm_date)
);

GRANT SELECT ON public.group_wake_sessions TO authenticated;
GRANT ALL ON public.group_wake_sessions TO service_role;

ALTER TABLE public.group_wake_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their group wake sessions"
ON public.group_wake_sessions
FOR SELECT
TO authenticated
USING (public.is_lifeos_group_member(group_id, auth.uid()));