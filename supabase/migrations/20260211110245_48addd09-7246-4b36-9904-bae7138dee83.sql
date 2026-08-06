
-- Life Profile: stores user birth date, life expectancy settings
CREATE TABLE public.life_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  birth_date DATE NOT NULL,
  life_expectancy_years INTEGER NOT NULL DEFAULT 80,
  gender TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.life_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own life profile" ON public.life_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own life profile" ON public.life_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own life profile" ON public.life_profile FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_life_profile_updated_at BEFORE UPDATE ON public.life_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Life Weeks: stores per-week data (notes, reflections, milestones)
CREATE TABLE public.life_weeks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year_number INTEGER NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  discipline_score NUMERIC DEFAULT 0,
  focus_hours NUMERIC DEFAULT 0,
  mood_avg NUMERIC,
  notes TEXT,
  reflection TEXT,
  life_event TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year_number, week_number)
);

ALTER TABLE public.life_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own life weeks" ON public.life_weeks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own life weeks" ON public.life_weeks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own life weeks" ON public.life_weeks FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_life_weeks_updated_at BEFORE UPDATE ON public.life_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Life Milestones: major life events on the timeline
CREATE TABLE public.life_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  milestone_type TEXT NOT NULL DEFAULT 'achievement',
  milestone_date DATE NOT NULL,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.life_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestones" ON public.life_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own milestones" ON public.life_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own milestones" ON public.life_milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own milestones" ON public.life_milestones FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_life_milestones_updated_at BEFORE UPDATE ON public.life_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
