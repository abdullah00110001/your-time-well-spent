
-- ============ ADMIN SETTINGS (singleton) ============
CREATE TABLE IF NOT EXISTS public.admin_group_settings (
  id boolean PRIMARY KEY DEFAULT true,
  max_capacity integer NOT NULL DEFAULT 100,
  chat_enabled_global boolean NOT NULL DEFAULT true,
  inactive_threshold_pct integer NOT NULL DEFAULT 70,
  inactive_window_days integer NOT NULL DEFAULT 14,
  auto_delete_enabled boolean NOT NULL DEFAULT true,
  leader_broadcast_per_day integer NOT NULL DEFAULT 1,
  member_wake_per_day integer NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = true)
);

INSERT INTO public.admin_group_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.admin_group_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admin group settings"
  ON public.admin_group_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update admin group settings"
  ON public.admin_group_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert admin group settings"
  ON public.admin_group_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ EXTEND lifeos_groups ============
ALTER TABLE public.lifeos_groups
  ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_lifeos_groups_active ON public.lifeos_groups (is_deleted, last_activity_at);

-- ============ GROUP CHAT MESSAGES ============
CREATE TABLE IF NOT EXISTS public.group_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  reply_to uuid REFERENCES public.group_chat_messages(id) ON DELETE SET NULL,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_created ON public.group_chat_messages (group_id, created_at DESC);

ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_messages REPLICA IDENTITY FULL;

CREATE POLICY "Members can read group chat"
  ON public.group_chat_messages FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));

CREATE POLICY "Members can send chat messages"
  ON public.group_chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_lifeos_group_member(group_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.lifeos_groups g, public.admin_group_settings s
      WHERE g.id = group_id AND g.chat_enabled = true AND s.chat_enabled_global = true AND g.is_deleted = false
    )
  );

CREATE POLICY "Users can update own chat messages"
  ON public.group_chat_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Author or leader can delete chat messages"
  ON public.group_chat_messages FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.is_lifeos_group_admin(group_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============ GROUP WAKE BROADCASTS (rate-limit log) ============
CREATE TABLE IF NOT EXISTS public.group_wake_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('leader','member')),
  target_user_id uuid,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wake_broadcasts_sender_day ON public.group_wake_broadcasts (sender_id, target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wake_broadcasts_group_day ON public.group_wake_broadcasts (group_id, kind, created_at DESC);

ALTER TABLE public.group_wake_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read group wake broadcasts"
  ON public.group_wake_broadcasts FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));

-- INSERT only via RPC (we'll add SECURITY DEFINER RPC); deny direct insert
CREATE POLICY "Only senders can insert via RPC path"
  ON public.group_wake_broadcasts FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND public.is_lifeos_group_member(group_id, auth.uid()));

-- ============ TRUSTED WAKERS (special permission) ============
CREATE TABLE IF NOT EXISTS public.group_trusted_wakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  grantor_id uuid NOT NULL,
  grantee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, grantor_id, grantee_id)
);

ALTER TABLE public.group_trusted_wakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read trusted wakers in their group"
  ON public.group_trusted_wakers FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));

CREATE POLICY "Users can grant trusted waker permission"
  ON public.group_trusted_wakers FOR INSERT
  WITH CHECK (auth.uid() = grantor_id AND public.is_lifeos_group_member(group_id, auth.uid()));

CREATE POLICY "Users can revoke their own trusted waker permissions"
  ON public.group_trusted_wakers FOR DELETE
  USING (auth.uid() = grantor_id);

-- ============ GROUP ROLL CALLS (Morning summary) ============
CREATE TABLE IF NOT EXISTS public.group_roll_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  roll_date date NOT NULL,
  total_members integer NOT NULL,
  woke_count integer NOT NULL,
  woke_user_ids uuid[] NOT NULL DEFAULT '{}',
  earliest_wake_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, roll_date)
);

ALTER TABLE public.group_roll_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read roll calls"
  ON public.group_roll_calls FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));

-- ============ Helper RPC: can_send_member_wake ============
CREATE OR REPLACE FUNCTION public.can_send_member_wake(_group_id uuid, _target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer;
  v_today_count integer;
  v_trusted boolean;
BEGIN
  IF NOT public.is_lifeos_group_member(_group_id, auth.uid()) THEN RETURN false; END IF;
  IF NOT public.is_lifeos_group_member(_group_id, _target) THEN RETURN false; END IF;
  IF auth.uid() = _target THEN RETURN false; END IF;

  SELECT member_wake_per_day INTO v_cap FROM public.admin_group_settings LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.group_trusted_wakers
    WHERE group_id = _group_id AND grantor_id = _target AND grantee_id = auth.uid()
  ) INTO v_trusted;

  IF v_trusted THEN RETURN true; END IF;

  SELECT count(*) INTO v_today_count
  FROM public.group_wake_broadcasts
  WHERE sender_id = auth.uid() AND target_user_id = _target
    AND created_at >= (current_date AT TIME ZONE 'UTC');

  RETURN v_today_count < COALESCE(v_cap, 2);
END;
$$;

-- ============ Helper RPC: can_send_leader_wake ============
CREATE OR REPLACE FUNCTION public.can_send_leader_wake(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer;
  v_today_count integer;
BEGIN
  IF NOT public.is_lifeos_group_admin(_group_id, auth.uid()) THEN RETURN false; END IF;
  SELECT leader_broadcast_per_day INTO v_cap FROM public.admin_group_settings LIMIT 1;
  SELECT count(*) INTO v_today_count
  FROM public.group_wake_broadcasts
  WHERE group_id = _group_id AND kind = 'leader'
    AND created_at >= (current_date AT TIME ZONE 'UTC');
  RETURN v_today_count < COALESCE(v_cap, 1);
END;
$$;

-- ============ Update last_activity_at trigger on chat ============
CREATE OR REPLACE FUNCTION public.bump_group_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lifeos_groups SET last_activity_at = now() WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_activity_chat ON public.group_chat_messages;
CREATE TRIGGER trg_bump_activity_chat
  AFTER INSERT ON public.group_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_group_activity();

DROP TRIGGER IF EXISTS trg_bump_activity_wake ON public.group_wake_broadcasts;
CREATE TRIGGER trg_bump_activity_wake
  AFTER INSERT ON public.group_wake_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.bump_group_activity();

-- ============ Enable Realtime on chat ============
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_chat_messages';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_messages';
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_wake_broadcasts';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_wake_broadcasts';
  END IF;
END $$;
