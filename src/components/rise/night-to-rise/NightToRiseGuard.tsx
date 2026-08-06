/**
 * NightToRiseGuard — global full-screen overlay shown whenever the Night-to-Rise
 * lock window is active. Mounted once at the App root. Reads config from
 * localStorage via useNightToRise and the next rise alarm from local_alarms.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Lock, Smartphone, ShieldOff, Flame, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNightToRise } from './useNightToRise';
import { useNightToRiseStreak } from './useNightToRiseStreak';
import { nightToRiseBridge } from '@/lib/capacitor/nightToRiseBridge';
import { cn } from '@/lib/utils';

function readNextAlarmTime(): string | null {
  try {
    const raw = localStorage.getItem('local_alarms');
    if (!raw) return null;
    const list = JSON.parse(raw) as Array<{ enabled?: boolean; time?: string }>;
    const found = list.find((a) => a.enabled && a.time);
    return found?.time ?? null;
  } catch { return null; }
}

const EXEMPT_ROUTES = ['/rise/ring', '/auth', '/reset-password'];

export function NightToRiseGuard() {
  const { pathname } = useLocation();
  const [alarmTime, setAlarmTime] = useState<string | null>(readNextAlarmTime);
  const { config, status } = useNightToRise(alarmTime);
  const { streak, recordBreak, recordCleanNight } = useNightToRiseStreak();
  const [now, setNow] = useState(new Date());
  const [overridden, setOverridden] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'local_alarms') setAlarmTime(readNextAlarmTime());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // FIX (v2): pick up breaks that happened on the NATIVE block screen (which
  // can't call back into JS directly since the app may not be running). We
  // check on mount and every time the app comes back to the foreground.
  useEffect(() => {
    const checkPendingBreak = async () => {
      const broke = await nightToRiseBridge.consumePendingBreak();
      if (broke) recordBreak();
    };
    void checkPendingBreak();

    const onVisibility = () => {
      if (!document.hidden) void checkPendingBreak();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [recordBreak]);

  const isExempt = EXEMPT_ROUTES.some((r) => pathname.startsWith(r));
  const phase = status.phase;
  const isLocked = (phase === 'sleep-lock' || phase === 'rise-lock') && !isExempt && !overridden;

  // When phase transitions off after a lock, record a clean night.
  useEffect(() => {
    if (phase === 'armed' || phase === 'off' || phase === 'inactive-day') {
      if (alarmTime) recordCleanNight();
    }
  }, [phase, alarmTime, recordCleanNight]);

  // Reset override when window ends
  useEffect(() => { if (!isLocked) setOverridden(false); }, [isLocked]);

  const message = phase === 'sleep-lock' ? config.sleepBlockMessage : config.riseBlockMessage;

  const endTime = useMemo(() => {
    if (phase === 'sleep-lock') {
      const [h, m] = config.sleepTime.split(':').map(Number);
      const end = new Date();
      end.setHours(h, m + 30, 0, 0);
      if (end < now) end.setDate(end.getDate() + 1);
      return end;
    }
    if (phase === 'rise-lock' && alarmTime) {
      const [h, m] = alarmTime.split(':').map(Number);
      const end = new Date();
      end.setHours(h, m + config.riseLockMinutesAfter, 0, 0);
      if (end < now) end.setDate(end.getDate() + 1);
      return end;
    }
    return null;
  }, [phase, alarmTime, config, now]);

  const remaining = endTime ? Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000)) : 0;
  const hh = Math.floor(remaining / 3600);
  const mm = Math.floor((remaining % 3600) / 60);
  const ss = remaining % 60;
  const countdown = hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`;

  const handleEmergencyUnlock = () => {
    if (config.strictMode) return;
    // PIN: stored at 'app_lock_pin'; fall back to allowing override without PIN
    let storedPin: string | null = null;
    try { storedPin = localStorage.getItem('app_lock_pin'); } catch {}
    if (storedPin && pinInput !== storedPin) return;
    recordBreak();
    setOverridden(true);
  };

  if (!isLocked) return null;

  return (
    <div className="n2r fixed inset-0 z-[200] flex flex-col" data-phase={phase}>
      {phase === 'rise-lock' ? (
        <div
          className="n2r-dawn-glow pointer-events-none absolute -bottom-32 left-1/2 h-96 w-[130%] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(255,201,120,0.45), rgba(255,155,113,0.15), transparent)' }}
        />
      ) : (
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[120%] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(74,59,107,0.5), transparent)' }}
        />
      )}

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className="mb-7 flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: 'color-mix(in srgb, var(--n2r-moon) 12%, transparent)', color: phase === 'rise-lock' ? 'var(--n2r-gold)' : 'var(--n2r-moon)' }}
        >
          <Lock className="h-7 w-7" />
        </div>

        <h1 className="n2r-display text-4xl leading-tight">{phase === 'sleep-lock' ? 'Rest now' : 'Ease into the day'}</h1>
        <p className="mt-4 max-w-sm text-base n2r-muted">{message}</p>

        <div className="mt-9">
          <div className="text-[10px] uppercase tracking-[0.2em] n2r-muted">Ends in</div>
          <div className="n2r-mono mt-2 text-5xl font-semibold" style={{ color: 'var(--n2r-ink)' }}>{countdown}</div>
        </div>

        {config.showStreakOnBlock && streak > 0 && (
          <div className="n2r-pill mt-7" data-tone="dawn">
            <Flame className="n2r-flame h-4 w-4" /> {streak} night{streak === 1 ? '' : 's'} protected
          </div>
        )}

        {config.allowedApps.length > 0 && (
          <div className="mt-9 w-full max-w-sm">
            <div className="mb-2 text-[10px] uppercase tracking-[0.2em] n2r-muted">Still available</div>
            <div className="flex flex-wrap justify-center gap-2">
              {config.allowedApps.map((a) => (
                <span key={a.id} className="n2r-pill">
                  <Smartphone className="h-3 w-3" /> {a.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative px-6 pb-9">
        {!config.strictMode ? (
          showPin ? (
            <div className="mx-auto max-w-xs space-y-2">
              <input
                type="password"
                inputMode="numeric"
                placeholder="Emergency PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="n2r-mono w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-lg tracking-widest placeholder:opacity-40"
                style={{ color: 'var(--n2r-ink)' }}
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 n2r-muted" onClick={() => { setShowPin(false); setPinInput(''); }}>Cancel</Button>
                <Button className="flex-1" onClick={handleEmergencyUnlock}>Unlock</Button>
              </div>
              <p className="text-center text-[11px] n2r-muted">Unlocking now starts your streak over. That's alright.</p>
            </div>
          ) : (
            <button
              onClick={() => setShowPin(true)}
              className="mx-auto block text-xs n2r-muted underline-offset-4 hover:underline"
            >
              Emergency unlock
            </button>
          )
        ) : (
          <div className={cn('n2r-pill mx-auto flex w-fit')}>
            <ShieldOff className="h-3 w-3" /> Strict mode — no override tonight
          </div>
        )}

        <p className="mt-4 text-center text-[11px] n2r-muted">
          Phone and emergency calls are always reachable.
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.2em] opacity-40">
          <Sparkles className="h-3 w-3" /> Sleep to Rise
        </div>
      </div>
    </div>
  );
}

