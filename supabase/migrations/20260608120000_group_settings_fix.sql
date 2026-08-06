-- Add missing settings columns
ALTER TABLE public.lifeos_groups
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS require_approval boolean NOT NULL DEFAULT false;

-- Storage bucket for group avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-avatars', 'group-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read; authenticated users can upload/update/delete their own group avatar files
DROP POLICY IF EXISTS "group avatars public read" ON storage.objects;
CREATE POLICY "group avatars public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'group-avatars');

DROP POLICY IF EXISTS "group avatars auth write" ON storage.objects;
CREATE POLICY "group avatars auth write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'group-avatars');

DROP POLICY IF EXISTS "group avatars auth update" ON storage.objects;
CREATE POLICY "group avatars auth update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'group-avatars');

DROP POLICY IF EXISTS "group avatars auth delete" ON storage.objects;
CREATE POLICY "group avatars auth delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'group-avatars');

-- Security-definer RPC returning best display name for a list of users.
-- Falls back: profiles.full_name -> auth metadata full_name -> email prefix.
CREATE OR REPLACE FUNCTION public.get_user_display_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    COALESCE(
      NULLIF(TRIM(p.full_name), ''),
      NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(u.email, '@', 1),
      'Member'
    ) AS display_name,
    p.avatar_url
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = ANY(_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_display_names(uuid[]) TO authenticated;
