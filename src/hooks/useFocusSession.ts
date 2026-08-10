// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Bridges the native focus session (Light Orb) into React.
// The native side owns the clock (wall-clock end timestamp in SharedPreferences),
// so nothing drifts and the timer keeps running while the app is backgrounded.

import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import ShieldPlugin, { type FocusSessionState } from '@/lib/capacitor/shieldPlugin';

const EMPTY: FocusSessionState = {
  active: false,
  paused: false,
  remainingMs: 0,
  orbEnabled: false,
};

const isAndroid = () => Capacitor.getPlatform() === 'android';

export function useFocusSession(pollMs = 1000) {
  const [session, setSession] = useState<FocusSessionState>(EMPTY);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAndroid()) return;
    try {
      setSession(await ShieldPlugin.getFocusSession());
    } catch {
      /* plugin not ready yet — keep last known state */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  const wrap = useCallback(
    async (fn: () => Promise<FocusSessionState>) => {
      if (!isAndroid()) return EMPTY;
      setBusy(true);
      try {
        const next = await fn();
        setSession(next);
        return next;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return {
    session,
    busy,
    refresh,
    start: (minutes: number) => wrap(() => ShieldPlugin.startFocusSession({ minutes })),
    pause: () => wrap(() => ShieldPlugin.pauseFocusSession()),
    resume: () => wrap(() => ShieldPlugin.resumeFocusSession()),
    addMinutes: (minutes = 5) => wrap(() => ShieldPlugin.addFocusMinutes({ minutes })),
    stop: () => wrap(() => ShieldPlugin.stopFocusSession()),
  };
}

/** mm:ss / h:mm:ss formatter shared by the in-app timer UIs. */
export function formatRemaining(ms: number, showSeconds = true): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (!showSeconds) return h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default useFocusSession;
