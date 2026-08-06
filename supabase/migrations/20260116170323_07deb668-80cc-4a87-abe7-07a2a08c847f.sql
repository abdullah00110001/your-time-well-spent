-- Add app_mode preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS app_mode TEXT DEFAULT 'islamic' CHECK (app_mode IN ('islamic', 'regular'));