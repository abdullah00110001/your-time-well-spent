
CREATE OR REPLACE FUNCTION public.get_user_display_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         COALESCE(NULLIF(TRIM(p.full_name), ''), 'Member') AS display_name,
         p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_display_names(uuid[]) TO authenticated, anon, service_role;
