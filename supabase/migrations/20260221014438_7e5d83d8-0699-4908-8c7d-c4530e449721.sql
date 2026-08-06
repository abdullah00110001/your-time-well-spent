
-- Add push_token column to profiles for FCM device token storage
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token_updated_at timestamp with time zone;

-- Create index for quick token lookups when sending push notifications
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON public.profiles(push_token) WHERE push_token IS NOT NULL;
