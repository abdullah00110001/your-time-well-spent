
-- 1. Extend group_wake_alarms with admin settings
ALTER TABLE public.group_wake_alarms
  ADD COLUMN IF NOT EXISTS follow_up_minutes INT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS max_wake_calls INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS roll_call_minutes_after INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS shared_ringtone_url TEXT,
  ADD COLUMN IF NOT EXISTS shared_ringtone_title TEXT;

-- 2. Extend existing group_wake_calls with date + trusted flag
ALTER TABLE public.group_wake_calls
  ADD COLUMN IF NOT EXISTS call_date DATE NOT NULL DEFAULT (now()::date),
  ADD COLUMN IF NOT EXISTS trusted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS group_wake_calls_to_date_idx
  ON public.group_wake_calls (group_id, to_user_id, call_date);
CREATE INDEX IF NOT EXISTS group_wake_calls_pair_date_idx
  ON public.group_wake_calls (group_id, from_user_id, to_user_id, call_date);

-- 3. New attendance table
CREATE TABLE IF NOT EXISTS public.group_wake_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  alarm_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'sleeping' CHECK (status IN ('sleeping','woke','late')),
  woke_at TIMESTAMPTZ,
  mission_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, alarm_date)
);

GRANT SELECT, INSERT, UPDATE ON public.group_wake_attendance TO authenticated;
GRANT ALL ON public.group_wake_attendance TO service_role;

ALTER TABLE public.group_wake_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read attendance of own groups"
  ON public.group_wake_attendance FOR SELECT TO authenticated
  USING (public.is_lifeos_group_member(group_id, auth.uid()));

CREATE POLICY "user can insert own attendance"
  ON public.group_wake_attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_lifeos_group_member(group_id, auth.uid()));

CREATE POLICY "user can update own attendance"
  ON public.group_wake_attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS group_wake_attendance_group_date_idx
  ON public.group_wake_attendance (group_id, alarm_date);

-- updated_at trigger
DROP TRIGGER IF EXISTS group_wake_attendance_set_updated_at ON public.group_wake_attendance;
CREATE TRIGGER group_wake_attendance_set_updated_at
  BEFORE UPDATE ON public.group_wake_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RPC for mission completion
CREATE OR REPLACE FUNCTION public.record_group_wake(_group_id UUID, _alarm_date DATE DEFAULT (now()::date))
RETURNS public.group_wake_attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.group_wake_attendance;
BEGIN
  IF NOT public.is_lifeos_group_member(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of group';
  END IF;

  INSERT INTO public.group_wake_attendance (group_id, user_id, alarm_date, status, woke_at, mission_completed_at)
  VALUES (_group_id, auth.uid(), _alarm_date, 'woke', now(), now())
  ON CONFLICT (group_id, user_id, alarm_date)
  DO UPDATE SET
    status = 'woke',
    woke_at = COALESCE(public.group_wake_attendance.woke_at, now()),
    mission_completed_at = now(),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_group_wake(UUID, DATE) TO authenticated;
