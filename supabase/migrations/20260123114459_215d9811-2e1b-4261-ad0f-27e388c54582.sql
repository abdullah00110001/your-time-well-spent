-- Add read_at column to admin_feedback for response tracking
ALTER TABLE admin_feedback ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Create feedback_templates table for reusable messages
CREATE TABLE IF NOT EXISTS public.feedback_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type = ANY (ARRAY[
    'encouragement', 'concern', 'suggestion', 'reminder',
    'broadcast', 'alert', 'celebration'
  ]::text[])),
  mode TEXT DEFAULT 'all' CHECK (mode = ANY (ARRAY['all', 'islamic', 'regular']::text[])),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on feedback_templates
ALTER TABLE public.feedback_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access (only admins can manage templates)
CREATE POLICY "Admins can manage feedback templates"
ON public.feedback_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create user_segments table for grouping users
CREATE TABLE IF NOT EXISTS public.user_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_segments
ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admins can manage user segments"
ON public.user_segments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at on new tables
CREATE TRIGGER update_feedback_templates_updated_at
BEFORE UPDATE ON public.feedback_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_segments_updated_at
BEFORE UPDATE ON public.user_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default feedback templates
INSERT INTO public.feedback_templates (name, message, feedback_type, mode) VALUES
('Welcome Back', 'We noticed you took a break. Welcome back! Every day is a new opportunity to improve. Let''s start fresh today. 💪', 'encouragement', 'all'),
('Great Streak', 'Amazing consistency! Your dedication is inspiring. Keep up the excellent work! 🌟', 'celebration', 'all'),
('Salah Reminder', 'The Prophet (ﷺ) said: "The first matter that the slave will be brought to account for on the Day of Judgment is the prayer." Stay consistent with your salah. 🤲', 'reminder', 'islamic'),
('Check-In', 'We haven''t heard from you in a while. Is everything okay? We''re here to support your journey. 💙', 'concern', 'all'),
('Weekly Goal', 'New week, new goals! Take a moment to set your intentions and plan your week ahead. 📝', 'suggestion', 'all'),
('Tahajjud Motivation', 'The last third of the night is when Allah descends to the lowest heaven. Consider waking up for tahajjud prayer. 🌙', 'reminder', 'islamic'),
('Self-Care Reminder', 'Remember to take care of yourself. Balance is key - mind, body, and soul all need attention. 🧘', 'reminder', 'regular'),
('Milestone Celebration', 'Congratulations on reaching this milestone! Your progress is remarkable. Keep going! 🎉', 'celebration', 'all')
ON CONFLICT DO NOTHING;