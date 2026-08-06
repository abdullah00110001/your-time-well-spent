
-- ============================================================
-- Rise Community: wake events, settings, reports, RPC, triggers
-- ============================================================

-- 1) rise_wake_events
CREATE TABLE IF NOT EXISTS public.rise_wake_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alarm_id UUID,
  woke_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_text TEXT,
  status_emoji TEXT,
  alarm_label TEXT,
  mission_type TEXT,
  city TEXT,
  district TEXT,
  country TEXT,
  country_code TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_mode TEXT NOT NULL DEFAULT 'city',
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  first_in_thana BOOLEAN NOT NULL DEFAULT false,
  report_count INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rise_wake_events TO authenticated;
GRANT ALL ON public.rise_wake_events TO service_role;

ALTER TABLE public.rise_wake_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View non-hidden wake events"
  ON public.rise_wake_events FOR SELECT TO authenticated
  USING (is_hidden = false AND location_mode <> 'private');

CREATE POLICY "View own wake events always"
  ON public.rise_wake_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own wake events"
  ON public.rise_wake_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own wake events"
  ON public.rise_wake_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Delete own wake events"
  ON public.rise_wake_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_rise_wake_events_woke_at ON public.rise_wake_events(woke_at DESC);
CREATE INDEX IF NOT EXISTS idx_rise_wake_events_city_woke ON public.rise_wake_events(city, woke_at DESC);
CREATE INDEX IF NOT EXISTS idx_rise_wake_events_user_woke ON public.rise_wake_events(user_id, woke_at DESC);
CREATE INDEX IF NOT EXISTS idx_rise_wake_events_district_woke ON public.rise_wake_events(district, woke_at DESC);

-- 2) rise_community_settings
CREATE TABLE IF NOT EXISTS public.rise_community_settings (
  user_id UUID PRIMARY KEY,
  show_in_community BOOLEAN NOT NULL DEFAULT true,
  anonymous_mode BOOLEAN NOT NULL DEFAULT true,
  nearby_radius_km INTEGER NOT NULL DEFAULT 5,
  show_alarm_label BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rise_community_settings TO authenticated;
GRANT ALL ON public.rise_community_settings TO service_role;

ALTER TABLE public.rise_community_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own community settings"
  ON public.rise_community_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER rise_community_settings_updated_at
  BEFORE UPDATE ON public.rise_community_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) rise_wake_reports
CREATE TABLE IF NOT EXISTS public.rise_wake_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.rise_wake_events(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, reporter_id)
);

GRANT SELECT, INSERT ON public.rise_wake_reports TO authenticated;
GRANT ALL ON public.rise_wake_reports TO service_role;

ALTER TABLE public.rise_wake_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reports"
  ON public.rise_wake_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users view own reports"
  ON public.rise_wake_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- 4) Trigger: set first_in_thana on insert if first in district today
CREATE OR REPLACE FUNCTION public.rise_set_first_in_thana()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF NEW.district IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.rise_wake_events
    WHERE district = NEW.district
      AND woke_at::date = NEW.woke_at::date
      AND id <> NEW.id
      AND is_hidden = false
  ) INTO v_exists;
  IF NOT v_exists THEN NEW.first_in_thana := true; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rise_first_in_thana ON public.rise_wake_events;
CREATE TRIGGER trg_rise_first_in_thana
  BEFORE INSERT ON public.rise_wake_events
  FOR EACH ROW EXECUTE FUNCTION public.rise_set_first_in_thana();

-- 5) Trigger: auto-hide wake event when 3+ reports
CREATE OR REPLACE FUNCTION public.rise_handle_wake_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.rise_wake_reports WHERE event_id = NEW.event_id;
  UPDATE public.rise_wake_events
    SET report_count = v_count,
        is_hidden = CASE WHEN v_count >= 3 THEN true ELSE is_hidden END
    WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rise_handle_wake_report ON public.rise_wake_reports;
CREATE TRIGGER trg_rise_handle_wake_report
  AFTER INSERT ON public.rise_wake_reports
  FOR EACH ROW EXECUTE FUNCTION public.rise_handle_wake_report();

-- 6) RPC: get_nearby_wakers (haversine)
CREATE OR REPLACE FUNCTION public.get_nearby_wakers(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision DEFAULT 5,
  since_hours integer DEFAULT 24
)
RETURNS TABLE (
  id uuid, user_id uuid, woke_at timestamptz, status_text text, status_emoji text,
  alarm_label text, mission_type text, city text, district text, country text,
  lat double precision, lng double precision, location_mode text, is_anonymous boolean,
  first_in_thana boolean, distance_km double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.user_id, e.woke_at, e.status_text, e.status_emoji,
         e.alarm_label, e.mission_type, e.city, e.district, e.country,
         e.lat, e.lng, e.location_mode, e.is_anonymous, e.first_in_thana,
         (6371 * acos(
           greatest(-1, least(1,
             cos(radians(user_lat)) * cos(radians(e.lat)) *
             cos(radians(e.lng) - radians(user_lng)) +
             sin(radians(user_lat)) * sin(radians(e.lat))
           ))
         )) AS distance_km
  FROM public.rise_wake_events e
  WHERE e.is_hidden = false
    AND e.location_mode = 'nearby'
    AND e.lat IS NOT NULL AND e.lng IS NOT NULL
    AND e.woke_at >= now() - (since_hours || ' hours')::interval
    AND (6371 * acos(
           greatest(-1, least(1,
             cos(radians(user_lat)) * cos(radians(e.lat)) *
             cos(radians(e.lng) - radians(user_lng)) +
             sin(radians(user_lat)) * sin(radians(e.lat))
           ))
         )) <= radius_km
  ORDER BY e.woke_at DESC
  LIMIT 200
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_wakers(double precision,double precision,double precision,integer) TO authenticated;
