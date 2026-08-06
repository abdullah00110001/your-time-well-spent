
-- ============================================================
-- LIVE GROUP DISCIPLINE ENGINE — Phase 1 Schema
-- ============================================================

-- 1. GROUP ROOMS (live study/focus/wake rooms)
CREATE TABLE public.group_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'study', -- study | deep_work | wake_up | quran | detox | custom
  description text,
  target_minutes integer DEFAULT 60,
  scheduled_start timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_rooms_group ON public.group_rooms(group_id, is_active);

-- 2. ROOM PARTICIPANTS
CREATE TABLE public.room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.group_rooms(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  focus_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'focusing', -- focusing | paused | distracted | done
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_room_participants_room ON public.room_participants(room_id, left_at);
CREATE INDEX idx_room_participants_user ON public.room_participants(user_id);

-- 3. USER PRESENCE (live status)
CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'offline', -- sleeping | waking | in_rise_mission | deep_work | shield_focus | distracted | idle | offline
  current_room_id uuid REFERENCES public.group_rooms(id) ON DELETE SET NULL,
  current_group_id uuid REFERENCES public.lifeos_groups(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_presence_group ON public.user_presence(current_group_id, last_seen DESC);

-- 4. GROUP CHALLENGES (wake races / focus marathons / anti-relapse)
CREATE TABLE public.group_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL, -- wake_race | focus_marathon | anti_relapse | streak_battle | custom
  description text,
  target_value numeric NOT NULL DEFAULT 0,
  target_unit text NOT NULL DEFAULT 'minutes', -- minutes | days | sessions
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  prize text,
  status text NOT NULL DEFAULT 'active', -- active | completed | cancelled
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_challenges_group ON public.group_challenges(group_id, status);

-- 5. CHALLENGE PARTICIPANTS
CREATE TABLE public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.group_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  progress_value numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  rank integer,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
CREATE INDEX idx_challenge_participants_challenge ON public.challenge_participants(challenge_id, progress_value DESC);

-- 6. ACCOUNTABILITY FAILURES (public failure log)
CREATE TABLE public.accountability_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lifeos_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL, -- missed_wake | focus_abandon | relapse | streak_break
  severity text NOT NULL DEFAULT 'medium', -- low | medium | high
  penalty_points integer NOT NULL DEFAULT 0,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accountability_failures_group ON public.accountability_failures(group_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.group_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_failures ENABLE ROW LEVEL SECURITY;

-- group_rooms
CREATE POLICY "members view rooms" ON public.group_rooms FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "members create rooms" ON public.group_rooms FOR INSERT
  WITH CHECK (public.is_lifeos_group_member(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "creator updates rooms" ON public.group_rooms FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "creator deletes rooms" ON public.group_rooms FOR DELETE
  USING (created_by = auth.uid());

-- room_participants
CREATE POLICY "members view participants" ON public.room_participants FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "self join room" ON public.room_participants FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "self update participation" ON public.room_participants FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "self leave room" ON public.room_participants FOR DELETE
  USING (user_id = auth.uid());

-- user_presence (visible to anyone in same current_group_id, plus self)
CREATE POLICY "view presence in same group or self" ON public.user_presence FOR SELECT
  USING (
    user_id = auth.uid()
    OR (current_group_id IS NOT NULL AND public.is_lifeos_group_member(current_group_id, auth.uid()))
  );
CREATE POLICY "self upsert presence" ON public.user_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "self update presence" ON public.user_presence FOR UPDATE
  USING (user_id = auth.uid());

-- group_challenges
CREATE POLICY "members view challenges" ON public.group_challenges FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "members create challenges" ON public.group_challenges FOR INSERT
  WITH CHECK (public.is_lifeos_group_member(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "creator updates challenges" ON public.group_challenges FOR UPDATE
  USING (created_by = auth.uid());

-- challenge_participants
CREATE POLICY "view challenge participants" ON public.challenge_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_challenges c
      WHERE c.id = challenge_id AND public.is_lifeos_group_member(c.group_id, auth.uid())
    )
  );
CREATE POLICY "self join challenge" ON public.challenge_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "self update progress" ON public.challenge_participants FOR UPDATE
  USING (user_id = auth.uid());

-- accountability_failures
CREATE POLICY "members view failures" ON public.accountability_failures FOR SELECT
  USING (public.is_lifeos_group_member(group_id, auth.uid()));
CREATE POLICY "self insert failure" ON public.accountability_failures FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_lifeos_group_member(group_id, auth.uid()));

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER trg_group_rooms_updated BEFORE UPDATE ON public.group_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_room_participants_updated BEFORE UPDATE ON public.room_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_user_presence_updated BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_group_challenges_updated BEFORE UPDATE ON public.group_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_challenge_participants_updated BEFORE UPDATE ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accountability_failures;

ALTER TABLE public.group_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
ALTER TABLE public.group_challenges REPLICA IDENTITY FULL;
ALTER TABLE public.challenge_participants REPLICA IDENTITY FULL;
ALTER TABLE public.accountability_failures REPLICA IDENTITY FULL;
