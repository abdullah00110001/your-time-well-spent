import { supabase } from '@/integrations/supabase/client';
import { isNative } from '@/lib/capacitor/platform';

interface RecordOpts {
  userId: string;
  missionType?: string;
  statusText?: string;
  statusEmoji?: string;
  alarmLabel?: string;
}


async function fetchSettings(userId: string) {
  const { data } = await supabase
    .from('rise_location_settings' as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as any) || { location_mode: 'city', is_anonymous: false, has_seen_prompt: false };
}

async function ipLookup() {
  try {
    const r = await fetch('https://ipapi.co/json/');
    if (!r.ok) return null;
    const j = await r.json();
    return {
      city: j.city, district: j.region, country: j.country_name,
      country_code: j.country_code,
      lat: typeof j.latitude === 'number' ? j.latitude : undefined,
      lng: typeof j.longitude === 'number' ? j.longitude : undefined,
    };
  } catch { return null; }
}

async function gpsLookup() {
  try {
    if (isNative) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const status = await Geolocation.requestPermissions();
      if (status.location !== 'granted' && status.coarseLocation !== 'granted') return null;
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
    if (navigator.geolocation) {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 })
      );
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
  } catch {}
  return null;
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`);
    if (!r.ok) return {};
    const j = await r.json();
    const a = j.address || {};
    return {
      city: a.city || a.town || a.village || a.county,
      district: a.state_district || a.state,
      country: a.country,
      country_code: (a.country_code || '').toUpperCase(),
    };
  } catch { return {}; }
}

/** Records a wake event respecting user privacy settings. Safe to call anywhere. */
export async function recordWakeEvent(opts: RecordOpts) {
  try {
    const settings = await fetchSettings(opts.userId);
    if (settings.location_mode === 'private') return null;

    let loc: any = null;
    if (settings.location_mode === 'nearby') {
      const gps = await gpsLookup();
      if (gps) {
        const meta = await reverseGeocode(gps.lat, gps.lng);
        loc = { ...gps, ...meta };
      } else {
        loc = await ipLookup();
      }
    } else {
      loc = await ipLookup();
    }
    const payload = {
      user_id: opts.userId,
      woke_at: new Date().toISOString(),
      mission_type: opts.missionType ?? null,
      status_text: opts.statusText ?? null,
      status_emoji: opts.statusEmoji ?? null,
      alarm_label: opts.alarmLabel?.trim() ? opts.alarmLabel.trim().slice(0, 50) : null,
      city: loc?.city ?? null,
      district: loc?.district ?? null,
      country: loc?.country ?? null,
      country_code: loc?.country_code ?? null,
      lat: settings.location_mode === 'nearby' ? loc?.lat ?? null : null,
      lng: settings.location_mode === 'nearby' ? loc?.lng ?? null : null,
      location_mode: settings.location_mode,
      is_anonymous: !!settings.is_anonymous,
    };

    const { data, error } = await supabase
      .from('rise_wake_events' as any)
      .insert(payload)
      .select()
      .single();
    if (error) { console.warn('[recordWakeEvent]', error); return null; }
    return { event: data, hasSeenPrompt: !!settings.has_seen_prompt };
  } catch (e) {
    console.warn('[recordWakeEvent] failed', e);
    return null;
  }
}
