-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Set replica identity to full so realtime works with RLS filters
ALTER TABLE public.notifications REPLICA IDENTITY FULL;