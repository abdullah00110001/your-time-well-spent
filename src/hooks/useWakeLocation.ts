import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isNative } from '@/lib/capacitor/platform';

export type LocationMode = 'global' | 'city' | 'nearby' | 'private';

export interface LocationSettings {
  location_mode: LocationMode;
  is_anonymous: boolean;
  has_seen_prompt: boolean;
}

export interface ResolvedLocation {
  lat?: number;
  lng?: number;
  city?: string;
  district?: string;
  country?: string;
  country_code?: string;
}

const DEFAULT: LocationSettings = {
  location_mode: 'city',
  is_anonymous: false,
  has_seen_prompt: false,
};

export function useWakeLocation() {
  const { user } = useAuth();
  const [locationSettings, setLocationSettings] = useState<LocationSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    if (!user) { setIsLoadingSettings(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('rise_location_settings' as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        setLocationSettings((data as any) ?? { ...DEFAULT });
      } catch (e) {
        console.warn('[useWakeLocation] load failed', e);
        setLocationSettings({ ...DEFAULT });
      } finally {
        setIsLoadingSettings(false);
      }
    })();
  }, [user]);

  const saveLocationSettings = useCallback(async (mode: LocationMode, isAnonymous: boolean) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      location_mode: mode,
      is_anonymous: isAnonymous,
      has_seen_prompt: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('rise_location_settings' as any)
      .upsert(payload as any, { onConflict: 'user_id' });
    if (error) throw error;
    setLocationSettings({
      location_mode: mode,
      is_anonymous: isAnonymous,
      has_seen_prompt: true,
    });
  }, [user]);

  const getCityFromIP = useCallback(async (): Promise<ResolvedLocation | null> => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) return null;
      const j = await res.json();
      return {
        city: j.city,
        district: j.region,
        country: j.country_name,
        country_code: j.country_code,
        lat: typeof j.latitude === 'number' ? j.latitude : undefined,
        lng: typeof j.longitude === 'number' ? j.longitude : undefined,
      };
    } catch (e) {
      console.warn('[useWakeLocation] ip lookup failed', e);
      return null;
    }
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<Partial<ResolvedLocation>> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`);
      if (!res.ok) return {};
      const j = await res.json();
      const a = j.address || {};
      return {
        city: a.city || a.town || a.village || a.county,
        district: a.state_district || a.state,
        country: a.country,
        country_code: (a.country_code || '').toUpperCase(),
      };
    } catch { return {}; }
  }, []);

  const requestGPSPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (isNative) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const status = await Geolocation.requestPermissions();
        return status.location === 'granted' || status.coarseLocation === 'granted';
      }
      // web
      return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(false);
        navigator.geolocation.getCurrentPosition(() => resolve(true), () => resolve(false), { timeout: 10000 });
      });
    } catch { return false; }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<ResolvedLocation | null> => {
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (isNative) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } else if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      }
      if (lat == null || lng == null) return await getCityFromIP();
      const meta = await reverseGeocode(lat, lng);
      return { lat, lng, ...meta };
    } catch (e) {
      console.warn('[useWakeLocation] gps failed, fallback to ip', e);
      return await getCityFromIP();
    }
  }, [getCityFromIP, reverseGeocode]);

  return {
    locationSettings,
    hasSeenPrompt: !!locationSettings?.has_seen_prompt,
    isLoadingSettings,
    saveLocationSettings,
    getCurrentLocation,
    getCityFromIP,
    requestGPSPermission,
  };
}
