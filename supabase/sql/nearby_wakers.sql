-- ============================================================
-- NEARBY WAKERS — run this in Supabase SQL Editor
-- ============================================================
create extension if not exists cube;
create extension if not exists earthdistance;

-- rise_wake_events
create table if not exists public.rise_wake_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  woke_at timestamptz not null default now(),
  mission_type text,
  status_text text,
  status_emoji text,
  city text,
  district text,
  country text,
  country_code text,
  lat double precision,
  lng double precision,
  location_mode text not null default 'city' check (location_mode in ('global','city','nearby','private')),
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_rise_wake_events_user_woke on public.rise_wake_events (user_id, woke_at desc);
create index if not exists idx_rise_wake_events_city_woke on public.rise_wake_events (city, woke_at desc);
create index if not exists idx_rise_wake_events_woke on public.rise_wake_events (woke_at desc);
create index if not exists idx_rise_wake_events_geo on public.rise_wake_events using gist (ll_to_earth(lat, lng))
  where lat is not null and lng is not null;

alter table public.rise_wake_events enable row level security;

drop policy if exists "wake_events_insert_own" on public.rise_wake_events;
create policy "wake_events_insert_own" on public.rise_wake_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "wake_events_select_visible" on public.rise_wake_events;
create policy "wake_events_select_visible" on public.rise_wake_events
  for select using (location_mode <> 'private' or auth.uid() = user_id);

drop policy if exists "wake_events_update_own" on public.rise_wake_events;
create policy "wake_events_update_own" on public.rise_wake_events
  for update using (auth.uid() = user_id);

drop policy if exists "wake_events_delete_own" on public.rise_wake_events;
create policy "wake_events_delete_own" on public.rise_wake_events
  for delete using (auth.uid() = user_id);

-- rise_location_settings
create table if not exists public.rise_location_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  location_mode text not null default 'city' check (location_mode in ('global','city','nearby','private')),
  is_anonymous boolean not null default false,
  has_seen_prompt boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.rise_location_settings enable row level security;

drop policy if exists "loc_settings_select_all" on public.rise_location_settings;
create policy "loc_settings_select_all" on public.rise_location_settings
  for select using (true);

drop policy if exists "loc_settings_manage_own" on public.rise_location_settings;
create policy "loc_settings_manage_own" on public.rise_location_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- get_nearby_wakers
create or replace function public.get_nearby_wakers(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision default 5,
  since_hours int default 24
)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  woke_at timestamptz,
  status_text text,
  status_emoji text,
  city text,
  country text,
  distance_km double precision,
  location_mode text,
  is_anonymous boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    e.id, e.user_id,
    case when e.is_anonymous then 'Anonymous'::text else p.full_name end,
    case when e.is_anonymous then null::text else p.avatar_url end,
    e.woke_at, e.status_text, e.status_emoji, e.city, e.country,
    case when e.lat is not null and e.lng is not null
      then round((earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(e.lat, e.lng)) / 1000)::numeric, 1)::double precision
      else null end,
    e.location_mode, e.is_anonymous
  from public.rise_wake_events e
  left join public.profiles p on p.user_id = e.user_id
  where e.location_mode <> 'private'
    and e.woke_at > now() - (since_hours || ' hours')::interval
    and e.lat is not null and e.lng is not null
    and earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(e.lat, e.lng)) <= radius_km * 1000
  order by e.woke_at desc;
end;
$$;

grant execute on function public.get_nearby_wakers(double precision, double precision, double precision, int) to authenticated;

-- Cleanup
create or replace function public.cleanup_old_wake_events()
returns void language sql security definer set search_path = public as $$
  delete from public.rise_wake_events where woke_at < now() - interval '7 days';
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cleanup-rise-wake-events', '0 3 * * *', $cron$select public.cleanup_old_wake_events()$cron$);
  end if;
exception when others then null;
end $$;

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.rise_wake_events;
exception when duplicate_object then null;
end $$;
