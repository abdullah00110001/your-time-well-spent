
CREATE TABLE IF NOT EXISTS public.group_wake_alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  wake_time time NOT NULL,
  days_of_week int[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  mission_type text NOT NULL DEFAULT 'none',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gwa_group ON public.group_wake_alarms(group_id);

CREATE TABLE IF NOT EXISTS public.group_wake_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_alarm_id uuid NOT NULL REFERENCES public.group_wake_alarms(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  session_date date NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_alarm_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_gws_group_date ON public.group_wake_sessions(group_id, session_date);

CREATE TABLE IF NOT EXISTS public.group_wake_member_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.group_wake_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  status_text text,
  mission_completed_at timestamptz,
  status_updated_at timestamptz,
  wake_up_calls_received int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gwms_session ON public.group_wake_member_status(session_id);
CREATE INDEX IF NOT EXISTS idx_gwms_user ON public.group_wake_member_status(user_id);

CREATE TABLE IF NOT EXISTS public.group_wake_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.group_wake_sessions(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  custom_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gwc_session_pair ON public.group_wake_calls(session_id, from_user_id, to_user_id);

ALTER TABLE public.group_wake_alarms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_wake_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_wake_member_status  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_wake_calls          ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_lifeos_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lifeos_group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role IN ('admin','owner','leader')
  );
$$;

CREATE POLICY "members read alarms" ON public.group_wake_alarms
  FOR SELECT USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "admins insert alarms" ON public.group_wake_alarms
  FOR INSERT WITH CHECK (public.is_lifeos_group_admin(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "admins update alarms" ON public.group_wake_alarms
  FOR UPDATE USING (public.is_lifeos_group_admin(group_id, auth.uid()));
CREATE POLICY "admins delete alarms" ON public.group_wake_alarms
  FOR DELETE USING (public.is_lifeos_group_admin(group_id, auth.uid()));

CREATE POLICY "members read sessions" ON public.group_wake_sessions
  FOR SELECT USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "members insert sessions" ON public.group_wake_sessions
  FOR INSERT WITH CHECK (public.is_lifeos_group_member(group_id, auth.uid()));

CREATE POLICY "members read member status" ON public.group_wake_member_status
  FOR SELECT USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "user inserts own member status" ON public.group_wake_member_status
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "user updates own member status" ON public.group_wake_member_status
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "members read calls" ON public.group_wake_calls
  FOR SELECT USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "members insert calls" ON public.group_wake_calls
  FOR INSERT WITH CHECK (from_user_id = auth.uid() AND public.is_lifeos_group_member(group_id, auth.uid()));

CREATE TRIGGER trg_gwa_updated BEFORE UPDATE ON public.group_wake_alarms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.group_wake_member_status REPLICA IDENTITY FULL;
ALTER TABLE public.group_wake_calls         REPLICA IDENTITY FULL;
ALTER TABLE public.group_wake_sessions      REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_wake_member_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_wake_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_wake_sessions;
