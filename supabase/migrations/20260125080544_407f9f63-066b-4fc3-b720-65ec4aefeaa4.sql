-- =============================================
-- CHALLENGES SYSTEM
-- =============================================

-- Challenge definitions (admin-created or system challenges)
CREATE TABLE public.challenges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    title_bn TEXT,
    description TEXT NOT NULL,
    description_bn TEXT,
    challenge_type TEXT NOT NULL DEFAULT 'weekly' CHECK (challenge_type IN ('daily', 'weekly', 'monthly')),
    target_metric TEXT NOT NULL, -- e.g., 'study_time', 'salah_streak', 'quran_pages'
    target_value INTEGER NOT NULL,
    reward_points INTEGER NOT NULL DEFAULT 100,
    badge_name TEXT,
    badge_icon TEXT,
    mode TEXT DEFAULT 'both' CHECK (mode IN ('islamic', 'regular', 'both')),
    is_active BOOLEAN DEFAULT true,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User challenge participation and progress
CREATE TABLE public.user_challenges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, challenge_id)
);

-- User badges/achievements
CREATE TABLE public.user_badges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    badge_name TEXT NOT NULL,
    badge_icon TEXT,
    badge_description TEXT,
    earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    source_challenge_id UUID REFERENCES public.challenges(id),
    UNIQUE(user_id, badge_name)
);

-- =============================================
-- GUIDED REFLECTION PROMPTS
-- =============================================

-- Reflection prompt templates
CREATE TABLE public.reflection_prompts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_text TEXT NOT NULL,
    prompt_text_bn TEXT,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('gratitude', 'growth', 'spiritual', 'productivity', 'relationships', 'general')),
    mode TEXT DEFAULT 'both' CHECK (mode IN ('islamic', 'regular', 'both')),
    mood_trigger TEXT[], -- triggers based on mood: ['low', 'medium', 'high']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User reflection responses
CREATE TABLE public.user_reflections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    prompt_id UUID REFERENCES public.reflection_prompts(id),
    custom_prompt TEXT, -- for when user writes their own prompt
    response TEXT NOT NULL,
    mood_before INTEGER CHECK (mood_before >= 1 AND mood_before <= 5),
    mood_after INTEGER CHECK (mood_after >= 1 AND mood_after <= 5),
    reflection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- SOCIAL SHARING
-- =============================================

-- Track shared achievements for analytics
CREATE TABLE public.shared_achievements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    achievement_type TEXT NOT NULL, -- 'streak', 'badge', 'challenge', 'milestone'
    achievement_data JSONB NOT NULL,
    platform TEXT, -- 'whatsapp', 'twitter', 'instagram', 'copy'
    shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- PUSH NOTIFICATIONS
-- =============================================

-- Push subscription storage
CREATE TABLE public.push_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

-- Notification preferences per user
CREATE TABLE public.notification_preferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    habit_reminders BOOLEAN DEFAULT true,
    prayer_reminders BOOLEAN DEFAULT true,
    daily_input_reminder BOOLEAN DEFAULT true,
    achievement_alerts BOOLEAN DEFAULT true,
    challenge_updates BOOLEAN DEFAULT true,
    mentor_messages BOOLEAN DEFAULT true,
    reminder_time TIME DEFAULT '20:00:00',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- ENABLE RLS
-- =============================================

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflection_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Challenges - viewable by all authenticated users
CREATE POLICY "Challenges are viewable by authenticated users" 
ON public.challenges FOR SELECT 
USING (auth.role() = 'authenticated');

-- User Challenges
CREATE POLICY "Users can view their own challenges" 
ON public.user_challenges FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can join challenges" 
ON public.user_challenges FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their challenge progress" 
ON public.user_challenges FOR UPDATE 
USING (auth.uid() = user_id);

-- User Badges
CREATE POLICY "Users can view their own badges" 
ON public.user_badges FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can earn badges" 
ON public.user_badges FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Reflection Prompts - viewable by all authenticated
CREATE POLICY "Reflection prompts are viewable by authenticated users" 
ON public.reflection_prompts FOR SELECT 
USING (auth.role() = 'authenticated');

-- User Reflections
CREATE POLICY "Users can view their own reflections" 
ON public.user_reflections FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create reflections" 
ON public.user_reflections FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their reflections" 
ON public.user_reflections FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their reflections" 
ON public.user_reflections FOR DELETE 
USING (auth.uid() = user_id);

-- Shared Achievements
CREATE POLICY "Users can view their shared achievements" 
ON public.shared_achievements FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can log shared achievements" 
ON public.shared_achievements FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Push Subscriptions
CREATE POLICY "Users can manage their push subscriptions" 
ON public.push_subscriptions FOR ALL 
USING (auth.uid() = user_id);

-- Notification Preferences
CREATE POLICY "Users can manage their notification preferences" 
ON public.notification_preferences FOR ALL 
USING (auth.uid() = user_id);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_user_challenges_user ON public.user_challenges(user_id);
CREATE INDEX idx_user_challenges_challenge ON public.user_challenges(challenge_id);
CREATE INDEX idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX idx_user_reflections_user ON public.user_reflections(user_id);
CREATE INDEX idx_user_reflections_date ON public.user_reflections(reflection_date);
CREATE INDEX idx_challenges_active ON public.challenges(is_active) WHERE is_active = true;
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- =============================================
-- SEED INITIAL CHALLENGES
-- =============================================

INSERT INTO public.challenges (title, title_bn, description, description_bn, challenge_type, target_metric, target_value, reward_points, badge_name, badge_icon, mode) VALUES
('7-Day Study Streak', '৭ দিনের পড়াশোনার ধারা', 'Study for at least 1 hour every day for 7 consecutive days', 'টানা ৭ দিন প্রতিদিন কমপক্ষে ১ ঘণ্টা পড়াশোনা করুন', 'weekly', 'study_streak', 7, 150, 'Study Champion', '📚', 'both'),
('Salah Perfection Week', 'সালাত পূর্ণতা সপ্তাহ', 'Complete all 5 daily prayers on time for 7 days', '৭ দিন সঠিক সময়ে ৫ ওয়াক্ত নামাজ আদায় করুন', 'weekly', 'salah_ontime', 35, 200, 'Salah Master', '🕌', 'islamic'),
('Digital Detox Challenge', 'ডিজিটাল ডিটক্স চ্যালেঞ্জ', 'Keep device time under 2 hours for 5 days', '৫ দিন ২ ঘণ্টার কম ডিভাইস ব্যবহার করুন', 'weekly', 'low_device', 5, 100, 'Digital Monk', '📵', 'both'),
('Quran Consistency', 'কুরআন ধারাবাহিকতা', 'Read Quran every day for a month', 'এক মাস প্রতিদিন কুরআন তেলাওয়াত করুন', 'monthly', 'quran_days', 30, 500, 'Quran Devotee', '📖', 'islamic'),
('Early Riser', 'ভোরে উঠুন', 'Wake up before Fajr for 7 days', '৭ দিন ফজরের আগে জাগুন', 'weekly', 'early_wake', 7, 150, 'Dawn Warrior', '🌅', 'islamic'),
('Gratitude Practice', 'কৃতজ্ঞতা অনুশীলন', 'Write 3 things you are grateful for every day for 2 weeks', '২ সপ্তাহ প্রতিদিন ৩টি কৃতজ্ঞতার বিষয় লিখুন', 'weekly', 'gratitude_entries', 14, 120, 'Grateful Soul', '🙏', 'both'),
('Focus Champion', 'ফোকাস চ্যাম্পিয়ন', 'Achieve 4+ focus score for 10 days', '১০ দিন ৪+ ফোকাস স্কোর অর্জন করুন', 'monthly', 'high_focus', 10, 180, 'Laser Focus', '🎯', 'both'),
('Community Service', 'সমাজসেবা', 'Log 10 hours of community service this month', 'এই মাসে ১০ ঘণ্টা সমাজসেবা করুন', 'monthly', 'service_hours', 10, 300, 'Community Hero', '🤝', 'both');

-- =============================================
-- SEED REFLECTION PROMPTS
-- =============================================

INSERT INTO public.reflection_prompts (prompt_text, prompt_text_bn, category, mode, mood_trigger) VALUES
('What are three things you are grateful for today?', 'আজ তুমি কোন তিনটি বিষয়ের জন্য কৃতজ্ঞ?', 'gratitude', 'both', ARRAY['low', 'medium', 'high']),
('What is one thing you learned today that you did not know yesterday?', 'আজ তুমি নতুন কী শিখেছ যা গতকাল জানতে না?', 'growth', 'both', ARRAY['medium', 'high']),
('How did you serve others today?', 'আজ তুমি কীভাবে অন্যদের সেবা করেছ?', 'relationships', 'both', ARRAY['medium', 'high']),
('What was the most challenging part of your day and how did you handle it?', 'আজকের সবচেয়ে কঠিন মুহূর্ত কী ছিল এবং তুমি কীভাবে তা সামলেছ?', 'growth', 'both', ARRAY['low', 'medium']),
('Did you feel connected to Allah today? In what moments?', 'আজ তুমি কি আল্লাহর সাথে সংযুক্ত অনুভব করেছ? কোন মুহূর্তে?', 'spiritual', 'islamic', ARRAY['low', 'medium', 'high']),
('What is one habit you want to improve tomorrow?', 'আগামীকাল তুমি কোন অভ্যাস উন্নত করতে চাও?', 'productivity', 'both', ARRAY['low', 'medium']),
('How did your Salah feel today? Were you present?', 'আজকের নামাজে তোমার মনোযোগ কেমন ছিল?', 'spiritual', 'islamic', ARRAY['medium', 'high']),
('What made you smile today?', 'আজ কী তোমাকে হাসিয়েছে?', 'gratitude', 'both', ARRAY['low', 'medium', 'high']),
('If you could relive one moment from today, which would it be?', 'আজকের কোন মুহূর্তটি তুমি আবার বাঁচতে চাইবে?', 'general', 'both', ARRAY['high']),
('What distracted you most today? How can you minimize it tomorrow?', 'আজ কী তোমাকে সবচেয়ে বেশি বিভ্রান্ত করেছে?', 'productivity', 'both', ARRAY['low', 'medium']),
('Did you make time for self-care today?', 'আজ তুমি কি নিজের যত্ন নেওয়ার সময় করেছ?', 'general', 'regular', ARRAY['low', 'medium']),
('What Ayah or Hadith resonated with you today?', 'আজ কোন আয়াত বা হাদিস তোমার মনে দাগ কেটেছে?', 'spiritual', 'islamic', ARRAY['medium', 'high']);

-- Trigger for updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();