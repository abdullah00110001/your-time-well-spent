REVOKE EXECUTE ON FUNCTION public.set_lifeos_group_member_role(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_lifeos_group_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_lifeos_group_ownership(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_lifeos_group_member_role(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_lifeos_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_lifeos_group_ownership(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_lifeos_group_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_lifeos_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_lifeos_group_ownership(uuid, uuid) TO authenticated;