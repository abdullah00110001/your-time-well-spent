SELECT cron.schedule(
  'group-lifecycle-daily',
  '0 3 * * *',
  $$select net.http_post(
    url:='https://nxvtoviyldffcqbtgriw.supabase.co/functions/v1/group-lifecycle-cron',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;$$
);

SELECT cron.schedule(
  'group-roll-call-morning',
  '0 10 * * *',
  $$select net.http_post(
    url:='https://nxvtoviyldffcqbtgriw.supabase.co/functions/v1/group-roll-call',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;$$
);