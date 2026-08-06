-- Add new columns to daily_entries for the 10 Islamic systems
ALTER TABLE public.daily_entries
ADD COLUMN IF NOT EXISTS niyyah_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS session_value_rating integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS barakah_index numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS urges_resisted integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS urges_succumbed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS day_reset_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS day_reset_time timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mindless_scrolling_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_mood text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS quran_mood_shift boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mawt_preparedness integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tahajjud_performed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sleep_start_time time DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sleep_end_time time DEFAULT NULL,
ADD COLUMN IF NOT EXISTS akhirah_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dunya_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weighted_daily_score numeric DEFAULT NULL;

-- Create table for Quranic mood anchors
CREATE TABLE IF NOT EXISTS public.quranic_anchors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mood text NOT NULL,
  mood_bn text NOT NULL,
  surah_name text NOT NULL,
  surah_number integer NOT NULL,
  ayah_start integer NOT NULL,
  ayah_end integer NOT NULL,
  arabic_text text,
  english_translation text,
  bengali_translation text,
  benefit text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quranic_anchors ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view anchors
CREATE POLICY "Anyone can view quranic anchors"
ON public.quranic_anchors
FOR SELECT
USING (true);

-- Create table for urge resistance logs
CREATE TABLE IF NOT EXISTS public.nafs_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  urge_type text DEFAULT 'general',
  resisted boolean NOT NULL,
  triggered_at timestamp with time zone NOT NULL DEFAULT now(),
  ayah_shown text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nafs_logs ENABLE ROW LEVEL SECURITY;

-- Users can manage their own logs
CREATE POLICY "Users can create their own nafs logs"
ON public.nafs_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own nafs logs"
ON public.nafs_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all nafs logs"
ON public.nafs_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table for study sessions with niyyah
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  niyyah text NOT NULL,
  niyyah_multiplier numeric NOT NULL DEFAULT 1,
  duration_minutes integer NOT NULL DEFAULT 0,
  session_value integer DEFAULT NULL,
  barakah_score numeric DEFAULT NULL,
  session_type text DEFAULT 'focused',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sessions"
ON public.study_sessions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
ON public.study_sessions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table for service/sadaqah time
CREATE TABLE IF NOT EXISTS public.service_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  service_type text NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  beneficiary text DEFAULT NULL,
  mood_before integer DEFAULT NULL,
  mood_after integer DEFAULT NULL,
  notes text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own service logs"
ON public.service_logs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Insert sample Quranic anchors for different moods
INSERT INTO public.quranic_anchors (mood, mood_bn, surah_name, surah_number, ayah_start, ayah_end, english_translation, benefit) VALUES
('anxious', 'উদ্বিগ্ন', 'Ar-Ra''d', 13, 28, 28, 'Verily, in the remembrance of Allah do hearts find rest.', 'Calms anxiety through divine remembrance'),
('angry', 'রাগান্বিত', 'Al-A''raf', 7, 199, 200, 'Take what is given freely, enjoin what is good, and turn away from the ignorant. And if an evil suggestion comes to you from Satan, then seek refuge in Allah.', 'Teaches patience and seeking refuge'),
('lazy', 'অলস', 'At-Tawbah', 9, 38, 39, 'O you who believe! What is the matter with you, that when you are asked to go forth in the cause of Allah, you cling heavily to the earth?', 'Motivation to take action'),
('sad', 'দুঃখিত', 'Ad-Duha', 93, 1, 11, 'By the morning brightness, and by the night when it covers with darkness, Your Lord has not taken leave of you, nor has He detested you.', 'Reassurance of Allah''s care'),
('hopeless', 'নিরাশ', 'Az-Zumar', 39, 53, 53, 'Say, O My servants who have transgressed against themselves: do not despair of the mercy of Allah. Indeed, Allah forgives all sins.', 'Hope in Allah''s mercy'),
('grateful', 'কৃতজ্ঞ', 'Ibrahim', 14, 7, 7, 'If you are grateful, I will surely increase you in favor.', 'Increase in blessings'),
('fearful', 'ভীত', 'Al-Baqarah', 2, 286, 286, 'Allah does not burden a soul beyond that it can bear.', 'Relief from overwhelming fear'),
('distracted', 'বিক্ষিপ্ত', 'Al-Mu''minun', 23, 1, 2, 'Successful indeed are the believers. Those who offer their prayers with humility and submissiveness.', 'Focus through prayer'),
('proud', 'অহংকারী', 'Luqman', 31, 18, 18, 'And do not turn your cheek in contempt toward people and do not walk through the earth exultantly. Indeed, Allah does not like everyone self-deluded and boastful.', 'Humility reminder'),
('overwhelmed', 'অভিভূত', 'At-Talaq', 65, 2, 3, 'And whoever fears Allah - He will make for him a way out. And will provide for him from where he does not expect.', 'Trust in Allah''s provision');

-- Insert warning ayahs for Nafs counter
INSERT INTO public.motivational_quotes (quote, quote_bn, author) VALUES
('And I do not acquit myself. Indeed, the soul is a persistent enjoiner of evil, except those upon which my Lord has mercy. - Yusuf 12:53', 'আমি নিজেকে নির্দোষ মনে করি না। নিশ্চয়ই মানুষের মন মন্দ কাজে প্রবৃত্ত হয়, তবে যাকে আমার প্রতিপালক দয়া করেন।', 'Al-Quran'),
('O you who believe, enter into Islam completely and do not follow the footsteps of Satan. - Al-Baqarah 2:208', 'হে মুমিনগণ! তোমরা সবাই পরিপূর্ণভাবে ইসলামে প্রবেশ কর এবং শয়তানের পদাঙ্ক অনুসরণ করো না।', 'Al-Quran'),
('Indeed, Satan is an enemy to you; so take him as an enemy. - Fatir 35:6', 'শয়তান তোমাদের শত্রু; অতএব তাকে শত্রু হিসেবেই গ্রহণ কর।', 'Al-Quran'),
('And whoever turns away from My remembrance - indeed, he will have a depressed life. - Ta-Ha 20:124', 'যে আমার স্মরণ থেকে মুখ ফিরিয়ে নেবে, তার জীবনযাত্রা হবে সংকীর্ণ।', 'Al-Quran'),
('Has the time not come for those who have believed that their hearts should become humbly submissive at the remembrance of Allah? - Al-Hadid 57:16', 'যারা ঈমান এনেছে, তাদের অন্তর কি আল্লাহর স্মরণে বিনীত হওয়ার সময় হয়নি?', 'Al-Quran'),
('Every soul will taste death. And you will only be given your full compensation on the Day of Resurrection. - Ali Imran 3:185', 'প্রত্যেক প্রাণী মৃত্যুর স্বাদ গ্রহণ করবে।', 'Al-Quran'),
('Know that the life of this world is but amusement and diversion and adornment. - Al-Hadid 57:20', 'জেনে রাখ, পার্থিব জীবন তো কেবল খেলাধুলা, সাজসজ্জা।', 'Al-Quran'),
('So flee to Allah. Indeed, I am to you from Him a clear warner. - Adh-Dhariyat 51:50', 'অতএব তোমরা আল্লাহর দিকে ধাবিত হও।', 'Al-Quran');