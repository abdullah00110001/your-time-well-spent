
-- Create app_metadata table for version management
CREATE TABLE IF NOT EXISTS public.app_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  latest_version_code integer NOT NULL DEFAULT 1,
  download_url text NOT NULL DEFAULT '',
  is_force_update boolean NOT NULL DEFAULT false,
  release_notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.app_metadata ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Anyone can read app metadata"
ON public.app_metadata FOR SELECT
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage app metadata"
ON public.app_metadata FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial row
INSERT INTO public.app_metadata (latest_version_code, download_url, is_force_update)
VALUES (1, '', false);
