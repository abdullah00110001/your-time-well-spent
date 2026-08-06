-- =============================================
-- SHIELD & RISE SYSTEM DATABASE SCHEMA
-- Life Discipline Operating System
-- =============================================

-- 1. DISCIPLINE PROFILES (Shield Modes)
CREATE TABLE public.discipline_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🎯',
  description TEXT,
  
  -- Blocking Rules
  blocked_apps JSONB DEFAULT '[]'::jsonb,
  allowed_apps JSONB DEFAULT '[]'::jsonb,
  blocked_websites JSONB DEFAULT '[]'::jsonb,
  blocked_keywords JSONB DEFAULT '[]'::jsonb,
  block_infinite_content BOOLEAN DEFAULT true,
  block_adult_content BOOLEAN DEFAULT true,
  
  -- Time Rules
  schedule JSONB DEFAULT '[]'::jsonb,
  auto_triggers JSONB DEFAULT '[]'::jsonb,
  
  -- Strictness (normal, hard, absolute)
  strictness_level TEXT DEFAULT 'normal' CHECK (strictness_level IN ('normal', 'hard', 'absolute')),
  
  -- Duration
  duration_type TEXT DEFAULT 'manual' CHECK (duration_type IN ('scheduled', 'manual', 'until_complete')),
  default_duration_minutes INTEGER DEFAULT 60,
  
  is_active BOOLEAN DEFAULT false,
  is_preset BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. SHIELD SESSIONS (Active Focus/Blocking Sessions)
CREATE TABLE public.shield_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.discipline_profiles(id) ON DELETE SET NULL,
  profile_name TEXT NOT NULL,
  strictness_level TEXT NOT NULL DEFAULT 'normal',
  
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_end_at TIMESTAMP WITH TIME ZONE,
  actual_end_at TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'paused')),
  
  -- Stats
  bypass_attempts INTEGER DEFAULT 0,
  apps_blocked_count INTEGER DEFAULT 0,
  sites_blocked_count INTEGER DEFAULT 0,
  time_saved_minutes INTEGER DEFAULT 0,
  
  -- Completion
  completed_successfully BOOLEAN,
  early_exit_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. SHIELD BYPASS LOGS (Anti-bypass tracking)
CREATE TABLE public.shield_bypass_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.shield_sessions(id) ON DELETE CASCADE,
  
  attempt_type TEXT NOT NULL CHECK (attempt_type IN (
    'disable_attempt', 'uninstall_attempt', 'force_stop', 
    'settings_change', 'time_manipulation', 'vpn_change',
    'unlock_request', 'emergency_unlock', 'snooze'
  )),
  
  was_blocked BOOLEAN DEFAULT true,
  details JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. DISCIPLINE SCORE (User's discipline metric)
CREATE TABLE public.discipline_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  
  current_score INTEGER DEFAULT 50 CHECK (current_score >= 0 AND current_score <= 100),
  
  -- Component scores
  focus_completion_score INTEGER DEFAULT 0,
  bypass_penalty INTEGER DEFAULT 0,
  unlock_penalty INTEGER DEFAULT 0,
  consistency_bonus INTEGER DEFAULT 0,
  time_saved_bonus INTEGER DEFAULT 0,
  
  -- Streaks
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  total_focus_minutes INTEGER DEFAULT 0,
  total_time_saved_minutes INTEGER DEFAULT 0,
  
  -- Level unlocks
  can_use_absolute_mode BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. ACCOUNTABILITY GROUPS
CREATE TABLE public.accountability_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE,
  
  created_by UUID NOT NULL,
  
  -- Permissions
  can_view_shield_status BOOLEAN DEFAULT true,
  can_approve_unlock BOOLEAN DEFAULT true,
  can_extend_focus BOOLEAN DEFAULT false,
  can_send_encouragement BOOLEAN DEFAULT true,
  
  notification_level TEXT DEFAULT 'critical' CHECK (notification_level IN ('all', 'critical', 'none')),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. ACCOUNTABILITY GROUP MEMBERS
CREATE TABLE public.accountability_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.accountability_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(group_id, user_id)
);

-- 7. UNLOCK REQUESTS (For Hard/Absolute modes)
CREATE TABLE public.unlock_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.shield_sessions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.accountability_groups(id) ON DELETE SET NULL,
  
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  
  approvals_required INTEGER DEFAULT 1,
  approvals_received INTEGER DEFAULT 0,
  
  expires_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. UNLOCK REQUEST RESPONSES
CREATE TABLE public.unlock_request_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.unlock_requests(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL,
  
  response TEXT NOT NULL CHECK (response IN ('approve', 'deny', 'extend')),
  message TEXT,
  extend_minutes INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- RISE ALARM SYSTEM TABLES
-- =============================================

-- 9. RISE ALARMS
CREATE TABLE public.rise_alarms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Time settings
  alarm_time TIME NOT NULL,
  days_of_week INTEGER[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun, 6=Sat
  
  -- Type and mode
  alarm_type TEXT DEFAULT 'personal' CHECK (alarm_type IN ('personal', 'group', 'recovery', 'fajr')),
  is_enabled BOOLEAN DEFAULT true,
  
  -- Intention
  intention TEXT,
  who_depends TEXT,
  is_intention_shared BOOLEAN DEFAULT false,
  
  -- Sound and behavior
  sound_type TEXT DEFAULT 'gentle',
  vibration_enabled BOOLEAN DEFAULT true,
  snooze_limit INTEGER DEFAULT 3,
  snooze_interval_minutes INTEGER DEFAULT 5,
  
  -- Wake verification
  verification_type TEXT DEFAULT 'breath_hold' CHECK (verification_type IN (
    'breath_hold', 'morning_intention', 'stand_detection', 'qr_scan', 'photo', 'none'
  )),
  
  -- Group settings
  group_id UUID REFERENCES public.accountability_groups(id) ON DELETE SET NULL,
  allow_friend_enforce BOOLEAN DEFAULT false,
  
  -- Labels
  label TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. RISE ALARM LOGS (Wake history)
CREATE TABLE public.rise_alarm_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alarm_id UUID REFERENCES public.rise_alarms(id) ON DELETE SET NULL,
  
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_wake_time TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'woke_on_time', 'woke_late', 'snoozed', 'missed', 'dismissed'
  )),
  
  snooze_count INTEGER DEFAULT 0,
  verification_completed BOOLEAN DEFAULT false,
  
  -- Wake quality
  feeling TEXT CHECK (feeling IN ('tired', 'okay', 'energized')),
  
  -- Group wake
  group_help_requested BOOLEAN DEFAULT false,
  friend_wake_signal_sent BOOLEAN DEFAULT false,
  
  minutes_late INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. RISE STREAKS
CREATE TABLE public.rise_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_on_time_wakes INTEGER DEFAULT 0,
  total_alarms INTEGER DEFAULT 0,
  
  -- Recovery mode
  is_recovery_mode BOOLEAN DEFAULT false,
  recovery_started_at TIMESTAMP WITH TIME ZONE,
  
  last_wake_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. GROUP WAKE STATUS (Real-time wake status for groups)
CREATE TABLE public.group_wake_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.accountability_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  alarm_log_id UUID REFERENCES public.rise_alarm_logs(id) ON DELETE CASCADE,
  
  wake_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'sleeping' CHECK (status IN ('sleeping', 'waking', 'awake', 'confirmed')),
  
  scheduled_time TIME,
  woke_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  needs_help BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(group_id, user_id, wake_date)
);

-- 13. DAILY INTENTIONS (Home dashboard)
CREATE TABLE public.daily_intentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  morning_intention TEXT,
  evening_reflection TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, date)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_discipline_profiles_user ON public.discipline_profiles(user_id);
CREATE INDEX idx_discipline_profiles_active ON public.discipline_profiles(user_id, is_active);
CREATE INDEX idx_shield_sessions_user ON public.shield_sessions(user_id);
CREATE INDEX idx_shield_sessions_active ON public.shield_sessions(user_id, status);
CREATE INDEX idx_shield_bypass_logs_session ON public.shield_bypass_logs(session_id);
CREATE INDEX idx_rise_alarms_user ON public.rise_alarms(user_id);
CREATE INDEX idx_rise_alarms_enabled ON public.rise_alarms(user_id, is_enabled);
CREATE INDEX idx_rise_alarm_logs_user ON public.rise_alarm_logs(user_id);
CREATE INDEX idx_rise_alarm_logs_date ON public.rise_alarm_logs(scheduled_time);
CREATE INDEX idx_group_wake_status_date ON public.group_wake_status(group_id, wake_date);
CREATE INDEX idx_daily_intentions_date ON public.daily_intentions(user_id, date);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.discipline_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shield_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shield_bypass_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlock_request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rise_alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rise_alarm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rise_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_wake_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_intentions ENABLE ROW LEVEL SECURITY;

-- Discipline Profiles policies
CREATE POLICY "Users can view own profiles" ON public.discipline_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own profiles" ON public.discipline_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profiles" ON public.discipline_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profiles" ON public.discipline_profiles FOR DELETE USING (auth.uid() = user_id);

-- Shield Sessions policies
CREATE POLICY "Users can view own sessions" ON public.shield_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON public.shield_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.shield_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Shield Bypass Logs policies
CREATE POLICY "Users can view own bypass logs" ON public.shield_bypass_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own bypass logs" ON public.shield_bypass_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Discipline Scores policies
CREATE POLICY "Users can view own score" ON public.discipline_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own score" ON public.discipline_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own score" ON public.discipline_scores FOR UPDATE USING (auth.uid() = user_id);

-- Accountability Groups policies (members can view)
CREATE POLICY "Members can view groups" ON public.accountability_groups FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.accountability_group_members WHERE group_id = id AND user_id = auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Users can create groups" ON public.accountability_groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update groups" ON public.accountability_groups FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete groups" ON public.accountability_groups FOR DELETE USING (auth.uid() = created_by);

-- Accountability Group Members policies
CREATE POLICY "Members can view group members" ON public.accountability_group_members FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.accountability_group_members agm WHERE agm.group_id = group_id AND agm.user_id = auth.uid()));
CREATE POLICY "Users can join groups" ON public.accountability_group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.accountability_group_members FOR DELETE USING (auth.uid() = user_id);

-- Unlock Requests policies
CREATE POLICY "Users can view own unlock requests" ON public.unlock_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create unlock requests" ON public.unlock_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own unlock requests" ON public.unlock_requests FOR UPDATE USING (auth.uid() = user_id);

-- Unlock Request Responses policies
CREATE POLICY "Group members can respond" ON public.unlock_request_responses FOR SELECT USING (auth.uid() = responder_id);
CREATE POLICY "Group members can create responses" ON public.unlock_request_responses FOR INSERT WITH CHECK (auth.uid() = responder_id);

-- Rise Alarms policies
CREATE POLICY "Users can view own alarms" ON public.rise_alarms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own alarms" ON public.rise_alarms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alarms" ON public.rise_alarms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alarms" ON public.rise_alarms FOR DELETE USING (auth.uid() = user_id);

-- Rise Alarm Logs policies
CREATE POLICY "Users can view own alarm logs" ON public.rise_alarm_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own alarm logs" ON public.rise_alarm_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alarm logs" ON public.rise_alarm_logs FOR UPDATE USING (auth.uid() = user_id);

-- Rise Streaks policies
CREATE POLICY "Users can view own streaks" ON public.rise_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own streaks" ON public.rise_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streaks" ON public.rise_streaks FOR UPDATE USING (auth.uid() = user_id);

-- Group Wake Status policies
CREATE POLICY "Group members can view wake status" ON public.group_wake_status FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.accountability_group_members WHERE group_id = group_wake_status.group_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own wake status" ON public.group_wake_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wake status" ON public.group_wake_status FOR UPDATE USING (auth.uid() = user_id);

-- Daily Intentions policies
CREATE POLICY "Users can view own intentions" ON public.daily_intentions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own intentions" ON public.daily_intentions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own intentions" ON public.daily_intentions FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_discipline_profiles_updated_at BEFORE UPDATE ON public.discipline_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_discipline_scores_updated_at BEFORE UPDATE ON public.discipline_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accountability_groups_updated_at BEFORE UPDATE ON public.accountability_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rise_alarms_updated_at BEFORE UPDATE ON public.rise_alarms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rise_streaks_updated_at BEFORE UPDATE ON public.rise_streaks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_group_wake_status_updated_at BEFORE UPDATE ON public.group_wake_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_daily_intentions_updated_at BEFORE UPDATE ON public.daily_intentions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();