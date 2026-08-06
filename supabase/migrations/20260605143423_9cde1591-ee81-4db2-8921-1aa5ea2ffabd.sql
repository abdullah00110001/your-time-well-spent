CREATE OR REPLACE FUNCTION public.share_lifeos_group(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lifeos_group_members m1
    JOIN public.lifeos_group_members m2 ON m1.group_id = m2.group_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  );
$$;

GRANT EXECUTE ON FUNCTION public.share_lifeos_group(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Group members can view each other profiles" ON public.profiles;
CREATE POLICY "Group members can view each other profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.share_lifeos_group(auth.uid(), user_id));