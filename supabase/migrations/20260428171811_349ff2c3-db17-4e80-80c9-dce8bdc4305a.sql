-- Enum for group type
DO $$ BEGIN
  CREATE TYPE public.lifeos_group_type AS ENUM ('rise', 'shield');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ GROUPS ============
CREATE TABLE IF NOT EXISTS public.lifeos_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type lifeos_group_type NOT NULL,
  goal text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  invite_code text UNIQUE NOT NULL DEFAULT upper(substring(md5(random()::text), 1, 6)),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lifeos_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Helper function to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_lifeos_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.lifeos_group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

-- ============ WAKE LOGS (Rise) ============
CREATE TABLE IF NOT EXISTS public.wake_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  wake_time time,
  scheduled_time time,
  on_time boolean NOT NULL DEFAULT false,
  missed boolean NOT NULL DEFAULT false,
  streak_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

-- ============ FOCUS SESSIONS (Shield) ============
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  focus_minutes integer NOT NULL DEFAULT 0,
  distracting_minutes integer NOT NULL DEFAULT 0,
  top_apps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text DEFAULT 'offline',
  status_updated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_date)
);

-- ============ ACTIVITY FEED ============
CREATE TABLE IF NOT EXISTS public.group_activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  user_id uuid,
  activity_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ NUDGES ============
CREATE TABLE IF NOT EXISTS public.group_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  message text DEFAULT 'Keep going! Your group believes in you.',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lifeos_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifeos_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wake_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_nudges ENABLE ROW LEVEL SECURITY;

-- ====== POLICIES: lifeos_groups ======
CREATE POLICY "View public or member groups" ON public.lifeos_groups FOR SELECT
  USING (is_public = true OR created_by = auth.uid() OR public.is_lifeos_group_member(id, auth.uid()));
CREATE POLICY "Users create groups" ON public.lifeos_groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator updates group" ON public.lifeos_groups FOR UPDATE
  USING (auth.uid() = created_by);
CREATE POLICY "Creator deletes group" ON public.lifeos_groups FOR DELETE
  USING (auth.uid() = created_by);

-- ====== POLICIES: lifeos_group_members ======
CREATE POLICY "Members view membership" ON public.lifeos_group_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "Users join groups" ON public.lifeos_group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave groups" ON public.lifeos_group_members FOR DELETE
  USING (auth.uid() = user_id);

-- ====== POLICIES: wake_logs ======
CREATE POLICY "View own or group wake logs" ON public.wake_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lifeos_group_members m1
      JOIN public.lifeos_group_members m2 ON m1.group_id = m2.group_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = wake_logs.user_id
    )
  );
CREATE POLICY "Users insert own wake logs" ON public.wake_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wake logs" ON public.wake_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- ====== POLICIES: focus_sessions ======
CREATE POLICY "View own or group focus sessions" ON public.focus_sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lifeos_group_members m1
      JOIN public.lifeos_group_members m2 ON m1.group_id = m2.group_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = focus_sessions.user_id
    )
  );
CREATE POLICY "Users insert own focus sessions" ON public.focus_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own focus sessions" ON public.focus_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ====== POLICIES: group_activity_feed ======
CREATE POLICY "Members view feed" ON public.group_activity_feed FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "Members insert feed" ON public.group_activity_feed FOR INSERT
  WITH CHECK (public.is_lifeos_group_member(group_id, auth.uid()));

-- ====== POLICIES: group_nudges ======
CREATE POLICY "Sender or recipient view nudges" ON public.group_nudges FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Members send nudges" ON public.group_nudges FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "Recipient marks read" ON public.group_nudges FOR UPDATE
  USING (auth.uid() = recipient_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lifeos_group_members_group ON public.lifeos_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_lifeos_group_members_user ON public.lifeos_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wake_logs_user_date ON public.wake_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON public.focus_sessions(user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_group ON public.group_activity_feed(group_id, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_activity_feed;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lifeos_group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_sessions;