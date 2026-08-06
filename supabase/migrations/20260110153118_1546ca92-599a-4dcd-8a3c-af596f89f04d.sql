-- Create time_entries table for daily time tracking
CREATE TABLE public.time_entries (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    hours numeric(4,2) NOT NULL DEFAULT 0,
    activity text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, date, activity)
);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_entries
CREATE POLICY "Users can view their own entries"
ON public.time_entries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own entries"
ON public.time_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries"
ON public.time_entries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entries"
ON public.time_entries FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create app_settings table for admin controls
CREATE TABLE public.app_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can view settings"
ON public.app_settings FOR SELECT
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default leaderboard setting (public by default)
INSERT INTO public.app_settings (key, value) 
VALUES ('leaderboard_visibility', '{"public": true}'::jsonb);

-- Policy for public leaderboard data (when enabled)
CREATE POLICY "Public can view leaderboard data when enabled"
ON public.time_entries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.app_settings 
        WHERE key = 'leaderboard_visibility' 
        AND (value->>'public')::boolean = true
    )
);

-- Policy for viewing profiles in leaderboard
CREATE POLICY "Public can view profiles for leaderboard"
ON public.profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.app_settings 
        WHERE key = 'leaderboard_visibility' 
        AND (value->>'public')::boolean = true
    )
);

-- Policy for habit_entries leaderboard
CREATE POLICY "Public can view habit entries for leaderboard"
ON public.habit_entries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.app_settings 
        WHERE key = 'leaderboard_visibility' 
        AND (value->>'public')::boolean = true
    )
);