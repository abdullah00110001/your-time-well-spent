
-- Create daily_entries table for the Daily Life Input System
CREATE TABLE public.daily_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Study Time
    focused_study_minutes INTEGER DEFAULT 0,
    revision_minutes INTEGER DEFAULT 0,
    skill_learning_minutes INTEGER DEFAULT 0,
    
    -- Salah Tracker
    fajr_completed BOOLEAN DEFAULT false,
    fajr_on_time BOOLEAN DEFAULT false,
    dhuhr_completed BOOLEAN DEFAULT false,
    dhuhr_on_time BOOLEAN DEFAULT false,
    asr_completed BOOLEAN DEFAULT false,
    asr_on_time BOOLEAN DEFAULT false,
    maghrib_completed BOOLEAN DEFAULT false,
    maghrib_on_time BOOLEAN DEFAULT false,
    isha_completed BOOLEAN DEFAULT false,
    isha_on_time BOOLEAN DEFAULT false,
    khushu_level INTEGER CHECK (khushu_level >= 1 AND khushu_level <= 5),
    
    -- Quran Engagement
    quran_read BOOLEAN DEFAULT false,
    quran_surah TEXT,
    quran_ayah_from INTEGER,
    quran_ayah_to INTEGER,
    quran_type TEXT CHECK (quran_type IN ('reading', 'memorization', 'tafsir')),
    quran_minutes INTEGER DEFAULT 0,
    
    -- Digital Usage
    device_time_minutes INTEGER DEFAULT 0,
    social_media_minutes INTEGER DEFAULT 0,
    shorts_reels_minutes INTEGER DEFAULT 0,
    
    -- Physical Health
    exercise_done BOOLEAN DEFAULT false,
    exercise_type TEXT,
    exercise_intensity TEXT CHECK (exercise_intensity IN ('low', 'medium', 'high')),
    exercise_duration_minutes INTEGER DEFAULT 0,
    
    -- Sleep & Energy
    sleep_duration_minutes INTEGER DEFAULT 0,
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
    
    -- Productivity Metrics
    focus_level INTEGER CHECK (focus_level >= 1 AND focus_level <= 5),
    discipline_level INTEGER CHECK (discipline_level >= 1 AND discipline_level <= 5),
    overall_day_rating INTEGER CHECK (overall_day_rating >= 1 AND overall_day_rating <= 10),
    
    -- Task Status
    task_status TEXT CHECK (task_status IN ('complete_on_time', 'complete_late', 'incomplete', 'not_submitted')) DEFAULT 'not_submitted',
    
    -- Mental State & Self-Awareness
    mental_state TEXT CHECK (mental_state IN ('calm', 'distracted', 'stressed', 'motivated')),
    most_important_task TEXT,
    biggest_time_leak TEXT,
    regret_of_day TEXT,
    free_reflection TEXT,
    
    -- Lock status
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, date)
);

-- Create night_muhasaba table for Day-End Reflection
CREATE TABLE public.night_muhasaba (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    daily_entry_id UUID REFERENCES public.daily_entries(id) ON DELETE CASCADE,
    
    what_went_right TEXT,
    what_went_wrong TEXT,
    helpful_habit TEXT,
    harmful_habit TEXT,
    fix_tomorrow TEXT,
    
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, date)
);

-- Create admin_feedback table for mentoring
CREATE TABLE public.admin_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    admin_id UUID NOT NULL,
    daily_entry_id UUID REFERENCES public.daily_entries(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    feedback_type TEXT CHECK (feedback_type IN ('daily', 'weekly', 'motivation', 'advice')) NOT NULL,
    message TEXT NOT NULL,
    is_private BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_scores table for Intelligence Engine
CREATE TABLE public.user_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    discipline_score INTEGER DEFAULT 0,
    deen_score INTEGER DEFAULT 0,
    focus_score INTEGER DEFAULT 0,
    consistency_index INTEGER DEFAULT 0,
    productivity_score INTEGER DEFAULT 0,
    
    study_streak INTEGER DEFAULT 0,
    salah_streak INTEGER DEFAULT 0,
    quran_streak INTEGER DEFAULT 0,
    
    level INTEGER DEFAULT 1,
    total_points INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, date)
);

-- Create admin_alerts table
CREATE TABLE public.admin_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.night_muhasaba ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_entries
CREATE POLICY "Users can view their own entries" ON public.daily_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own entries" ON public.daily_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update unlocked entries" ON public.daily_entries FOR UPDATE USING (auth.uid() = user_id AND is_locked = false);
CREATE POLICY "Admins can view all entries" ON public.daily_entries FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all entries" ON public.daily_entries FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for night_muhasaba
CREATE POLICY "Users can view their own muhasaba" ON public.night_muhasaba FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own muhasaba" ON public.night_muhasaba FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all muhasaba" ON public.night_muhasaba FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for admin_feedback
CREATE POLICY "Users can view non-private feedback" ON public.admin_feedback FOR SELECT USING (auth.uid() = user_id AND is_private = false);
CREATE POLICY "Admins can manage feedback" ON public.admin_feedback FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_scores
CREATE POLICY "Users can view their own scores" ON public.user_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage scores" ON public.user_scores FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can upsert scores" ON public.user_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update scores" ON public.user_scores FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for admin_alerts
CREATE POLICY "Admins can manage alerts" ON public.admin_alerts FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_daily_entries_updated_at BEFORE UPDATE ON public.daily_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_scores_updated_at BEFORE UPDATE ON public.user_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
