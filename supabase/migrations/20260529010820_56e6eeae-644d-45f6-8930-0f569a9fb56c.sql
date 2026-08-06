
REVOKE EXECUTE ON FUNCTION public.get_nearby_wakers(double precision,double precision,double precision,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rise_set_first_in_thana() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rise_handle_wake_report() FROM PUBLIC, anon, authenticated;
