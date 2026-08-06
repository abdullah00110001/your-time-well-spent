import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWakeLocation, type LocationMode, type ResolvedLocation } from '@/hooks/useWakeLocation';

export type FilterMode = 'global' | 'city' | 'nearby';

export interface WakerProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  woke_at: string;
  status_text: string | null;
  status_emoji: string | null;
  alarm_label: string | null;
  first_in_thana: boolean;
  city: string | null;
  country: string | null;
  distance_km: number | null;
  location_mode: LocationMode;
  is_anonymous: boolean;
  mission_type?: string | null;
  lat?: number | null;
  lng?: number | null;
}


export interface WakeEvent extends WakerProfile {}

const NEARBY_RADIUS_KM = 5;

function offsetCoord(v: number, meters = 500) {
  const deg = meters / 111_000;
  return v + (Math.random() * 2 - 1) * deg;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function useNearbyWakers() {
  const { user } = useAuth();
  const { locationSettings, getCurrentLocation, getCityFromIP } = useWakeLocation();

  const [wakers, setWakers] = useState<WakerProfile[]>([]);
  const [myEvent, setMyEvent] = useState<WakeEvent | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('global');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<ResolvedLocation | null>(null);
  const [stats, setStats] = useState<{ global: number; city: number; nearby: number }>({ global: 0, city: 0, nearby: 0 });
  const profileCache = useRef<Map<string, { full_name: string | null; avatar_url: string | null }>>(new Map());

  const todayStartIso = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);

  const enrichProfiles = useCallback(async (rows: any[]): Promise<WakerProfile[]> => {
    const ids = Array.from(new Set(rows.map(r => r.user_id).filter(uid => !profileCache.current.has(uid))));
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', ids);
      (data || []).forEach((p: any) => profileCache.current.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }));
    }
    return rows.map((r): WakerProfile => {

      const p = profileCache.current.get(r.user_id);
      const showName = !r.is_anonymous;
      return {
        id: r.id,
        user_id: r.user_id,
        display_name: showName ? (p?.full_name || 'Member') : 'Anonymous',
        avatar_url: showName ? (p?.avatar_url || null) : null,
        woke_at: r.woke_at,
        status_text: r.status_text,
        status_emoji: r.status_emoji,
        alarm_label: r.alarm_label ?? null,
        first_in_thana: !!r.first_in_thana,
        city: r.city,
        country: r.country,
        distance_km: r.distance_km ?? null,
        location_mode: r.location_mode,
        is_anonymous: !!r.is_anonymous,
        mission_type: r.mission_type,
        lat: r.lat != null && r.is_anonymous ? offsetCoord(r.lat) : r.lat,
        lng: r.lng != null && r.is_anonymous ? offsetCoord(r.lng) : r.lng,
      };
    });
  }, []);

  const fetchGlobal = useCallback(async () => {
    const { data } = await supabase
      .from('rise_wake_events' as any)
      .select('*')
      .neq('location_mode', 'private')
      .gte('woke_at', todayStartIso)
      .order('woke_at', { ascending: false })
      .limit(100);
    return await enrichProfiles((data as any[]) || []);
  }, [enrichProfiles, todayStartIso]);

  const fetchCity = useCallback(async (city: string | undefined) => {
    if (!city) return [];
    const { data } = await supabase
      .from('rise_wake_events' as any)
      .select('*')
      .neq('location_mode', 'private')
      .eq('city', city)
      .gte('woke_at', todayStartIso)
      .order('woke_at', { ascending: false })
      .limit(100);
    return await enrichProfiles((data as any[]) || []);
  }, [enrichProfiles, todayStartIso]);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    const { data, error } = await supabase.rpc('get_nearby_wakers' as any, {
      user_lat: lat, user_lng: lng, radius_km: NEARBY_RADIUS_KM, since_hours: 24,
    });
    if (error) { console.warn('get_nearby_wakers err', error); return []; }
    return await enrichProfiles((data as any[]) || []);
  }, [enrichProfiles]);

  const ensureLocation = useCallback(async (): Promise<ResolvedLocation | null> => {
    if (userLocation) return userLocation;
    const loc = (locationSettings?.location_mode === 'nearby')
      ? await getCurrentLocation()
      : await getCityFromIP();
    if (loc) setUserLocation(loc);
    return loc;
  }, [userLocation, locationSettings, getCurrentLocation, getCityFromIP]);

  const refreshFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const loc = await ensureLocation();
      let list: WakerProfile[] = [];
      if (filterMode === 'global') list = await fetchGlobal();
      else if (filterMode === 'city') list = await fetchCity(loc?.city);
      else if (filterMode === 'nearby') {
        if (loc?.lat != null && loc?.lng != null) list = await fetchNearby(loc.lat, loc.lng);
      }
      setWakers(list);
    } finally {
      setIsLoading(false);
    }
  }, [filterMode, ensureLocation, fetchGlobal, fetchCity, fetchNearby]);

  useEffect(() => { void refreshFeed(); }, [refreshFeed]);

  // load my latest event today
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('rise_wake_events' as any)
        .select('*')
        .eq('user_id', user.id)
        .gte('woke_at', todayStartIso)
        .order('woke_at', { ascending: false })
        .limit(1);
      const row = (data as any[])?.[0];
      if (row) setMyEvent({ ...row, display_name: 'You', distance_km: 0, avatar_url: null });
    })();
  }, [user, todayStartIso]);

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel('rise_wake_events_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rise_wake_events' }, () => {
        void refreshFeed();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [refreshFeed]);

  const saveMyWakeEvent = useCallback(async (statusText?: string, statusEmoji?: string, missionType?: string) => {
    if (!user) return;
    const settings = locationSettings || { location_mode: 'city' as LocationMode, is_anonymous: false, has_seen_prompt: false };
    if (settings.location_mode === 'private') return; // still don't insert if private
    const loc = settings.location_mode === 'nearby'
      ? await getCurrentLocation()
      : await getCityFromIP();

    const payload: any = {
      user_id: user.id,
      woke_at: new Date().toISOString(),
      mission_type: missionType ?? null,
      status_text: statusText ?? null,
      status_emoji: statusEmoji ?? null,
      city: loc?.city ?? null,
      district: loc?.district ?? null,
      country: loc?.country ?? null,
      country_code: loc?.country_code ?? null,
      lat: settings.location_mode === 'nearby' ? loc?.lat ?? null : null,
      lng: settings.location_mode === 'nearby' ? loc?.lng ?? null : null,
      location_mode: settings.location_mode,
      is_anonymous: settings.is_anonymous,
    };
    const { data, error } = await supabase
      .from('rise_wake_events' as any)
      .insert(payload)
      .select()
      .single();
    if (error) { console.warn('saveMyWakeEvent', error); return; }
    setMyEvent({ ...(data as any), display_name: 'You', distance_km: 0 });
    await refreshFeed();
  }, [user, locationSettings, getCurrentLocation, getCityFromIP, refreshFeed]);

  const updateMyStatus = useCallback(async (statusText: string, statusEmoji?: string) => {
    if (!user || !myEvent) return;
    const { error } = await supabase
      .from('rise_wake_events' as any)
      .update({ status_text: statusText, status_emoji: statusEmoji ?? null })
      .eq('id', myEvent.id);
    if (!error) {
      setMyEvent({ ...myEvent, status_text: statusText, status_emoji: statusEmoji ?? null });
      await refreshFeed();
    }
  }, [user, myEvent, refreshFeed]);

  const deleteMyEvent = useCallback(async (eventId: string) => {
    await supabase.from('rise_wake_events' as any).delete().eq('id', eventId);
    if (myEvent?.id === eventId) setMyEvent(null);
    await refreshFeed();
  }, [myEvent, refreshFeed]);

  // Independent stats fetch (counts must reflect ALL today's events, not the current tab)
  const refreshStats = useCallback(async () => {
    const loc = userLocation;
    const { data } = await supabase
      .from('rise_wake_events' as any)
      .select('user_id, city, lat, lng, location_mode, is_anonymous, woke_at')
      .neq('location_mode', 'private')
      .gte('woke_at', todayStartIso)
      .limit(2000);
    const rows = (data as any[]) || [];
    const global = rows.length;
    const city = loc?.city ? rows.filter(r => r.city === loc.city).length : 0;
    const nearby = (loc?.lat != null && loc?.lng != null)
      ? rows.filter(r => r.lat != null && r.lng != null &&
          haversineKm(loc.lat!, loc.lng!, r.lat, r.lng) <= NEARBY_RADIUS_KM).length
      : 0;
    setStats({ global, city, nearby });
  }, [userLocation, todayStartIso]);

  useEffect(() => { void refreshStats(); }, [refreshStats]);

  // Silent 60s refresh for counts only
  useEffect(() => {
    const id = setInterval(() => { void refreshStats(); }, 60_000);
    return () => clearInterval(id);
  }, [refreshStats]);

  const totalToday = stats.global;
  const cityCount = stats.city;
  const nearbyCount = stats.nearby;

  return {
    wakers, myEvent, filterMode, isLoading, totalToday, cityCount, nearbyCount, userLocation,
    setFilterMode, refreshFeed, saveMyWakeEvent, updateMyStatus, deleteMyEvent,
  };
}
