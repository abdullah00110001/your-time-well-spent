-- ============================================================
-- Rise Community — New Features Migration
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Add streak columns to profiles (if not exists)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0;

-- 2. Add first_in_area flag to rise_wake_events (if not exists)
ALTER TABLE rise_wake_events
  ADD COLUMN IF NOT EXISTS is_first_in_area boolean DEFAULT false;

-- 3. Weekly recaps table
CREATE TABLE IF NOT EXISTS rise_weekly_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  days_woken integer DEFAULT 0,
  avg_wake_time time,
  best_day text,
  current_streak integer DEFAULT 0,
  city_total_wakers integer DEFAULT 0,
  city_earliest_wake time,
  city_most_active_day text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rise_weekly_recaps_user_week
  ON rise_weekly_recaps(user_id, week_start_date);

-- 4. RLS for weekly recaps
ALTER TABLE rise_weekly_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recaps"
  ON rise_weekly_recaps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recaps"
  ON rise_weekly_recaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Function: check if user is first waker in their area today
CREATE OR REPLACE FUNCTION check_first_in_area(
  p_user_id uuid,
  p_city text,
  p_wake_event_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM rise_wake_events
  WHERE city = p_city
    AND id != p_wake_event_id
    AND date_trunc('day', woke_at) = date_trunc('day', now())
    AND user_id != p_user_id;

  IF v_count = 0 THEN
    UPDATE rise_wake_events
      SET is_first_in_area = true
      WHERE id = p_wake_event_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 6. Function: calculate and update user streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_dates date[];
  v_streak integer := 0;
  v_longest integer := 0;
  v_temp integer := 1;
  v_check_date date := CURRENT_DATE;
  v_i integer;
BEGIN
  -- Get unique wake dates desc
  SELECT ARRAY(
    SELECT DISTINCT date_trunc('day', woke_at)::date
    FROM rise_wake_events
    WHERE user_id = p_user_id
    ORDER BY 1 DESC
  ) INTO v_dates;

  IF array_length(v_dates, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Current streak
  FOR v_i IN 1..array_length(v_dates, 1) LOOP
    IF v_dates[v_i] = v_check_date THEN
      v_streak := v_streak + 1;
      v_check_date := v_check_date - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Longest streak
  v_longest := v_streak;
  FOR v_i IN 2..COALESCE(array_length(v_dates, 1), 1) LOOP
    IF v_dates[v_i] = v_dates[v_i-1] - 1 THEN
      v_temp := v_temp + 1;
      v_longest := GREATEST(v_longest, v_temp);
    ELSE
      v_temp := 1;
    END IF;
  END LOOP;

  -- Update profiles
  UPDATE profiles
    SET current_streak = v_streak,
        longest_streak = GREATEST(longest_streak, v_longest)
    WHERE user_id = p_user_id;

  RETURN v_streak;
END;
$$;

-- 7. Midnight cleanup cron (uses pg_cron — enable in Supabase dashboard first)
-- SELECT cron.schedule('rise-cleanup', '0 0 * * *', $$
--   DELETE FROM rise_wake_events
--   WHERE woke_at < date_trunc('day', now())
--   AND location_mode = 'nearby';
-- $$);

-- 8. Index for fast nearby/city queries
CREATE INDEX IF NOT EXISTS rise_wake_events_city_date
  ON rise_wake_events(city, woke_at DESC);

CREATE INDEX IF NOT EXISTS rise_wake_events_user_date
  ON rise_wake_events(user_id, woke_at DESC);
