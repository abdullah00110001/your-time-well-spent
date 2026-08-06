ALTER TABLE public.lifeos_groups
  ADD COLUMN IF NOT EXISTS pinned_announcement text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifeos_group_members TO authenticated;
GRANT ALL ON public.lifeos_groups TO service_role;
GRANT ALL ON public.lifeos_group_members TO service_role;

DROP POLICY IF EXISTS "Group admins update group" ON public.lifeos_groups;
CREATE POLICY "Group admins update group"
  ON public.lifeos_groups FOR UPDATE
  TO authenticated
  USING (public.is_lifeos_group_admin(id, auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_lifeos_group_admin(id, auth.uid()) OR created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.set_lifeos_group_member_role(
  _group_id uuid,
  _target_user_id uuid,
  _role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF _role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT created_by INTO v_owner FROM public.lifeos_groups WHERE id = _group_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
  IF NOT public.is_lifeos_group_admin(_group_id, auth.uid()) AND auth.uid() <> v_owner THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _target_user_id = v_owner THEN
    RAISE EXCEPTION 'Owner role cannot be changed';
  END IF;

  UPDATE public.lifeos_group_members
  SET role = _role
  WHERE group_id = _group_id AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_lifeos_group_member(
  _group_id uuid,
  _target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT created_by INTO v_owner FROM public.lifeos_groups WHERE id = _group_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
  IF _target_user_id = v_owner THEN
    RAISE EXCEPTION 'Owner cannot be removed';
  END IF;
  IF auth.uid() <> _target_user_id AND NOT public.is_lifeos_group_admin(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.lifeos_group_members
  WHERE group_id = _group_id AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_lifeos_group_ownership(
  _group_id uuid,
  _target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT created_by INTO v_owner FROM public.lifeos_groups WHERE id = _group_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
  IF auth.uid() <> v_owner THEN
    RAISE EXCEPTION 'Only owner can transfer ownership';
  END IF;
  IF NOT public.is_lifeos_group_member(_group_id, _target_user_id) THEN
    RAISE EXCEPTION 'Target user is not a group member';
  END IF;

  UPDATE public.lifeos_groups SET created_by = _target_user_id WHERE id = _group_id;
  UPDATE public.lifeos_group_members SET role = 'admin' WHERE group_id = _group_id AND user_id = v_owner;
  UPDATE public.lifeos_group_members SET role = 'owner' WHERE group_id = _group_id AND user_id = _target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_lifeos_group_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_lifeos_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_lifeos_group_ownership(uuid, uuid) TO authenticated;