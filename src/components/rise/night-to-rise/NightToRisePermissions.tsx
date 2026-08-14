/**
 * NightToRisePermissions — real permission status + request row for Sleep to Rise.
 *
 * Native enforcement (ShieldAccessibilityService + NightToRiseManager) needs
 * Usage Access, Accessibility and Overlay. Without them the lock silently does
 * nothing, so we surface the exact missing pieces with working request buttons.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isNative, isAndroid } from '@/lib/capacitor/platform';
import Shield from '@/lib/capacitor/shieldPlugin';
import { lightImpact } from '@/lib/capacitor/nativeHaptics';

type Key = 'usageStats' | 'accessibility' | 'overlay' | 'battery';

const ROWS: Array<{ key: Key; label: string; why: string; request: () => Promise<void> }> = [
  {
    key: 'usageStats',
    label: 'Usage access',
    why: 'Detects which app is open during a lock window',
    request: () => Shield.requestUsageStats(),
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    why: 'Closes blocked apps and blocks distracting sites',
    request: () => Shield.requestAccessibility(),
  },
  {
    key: 'overlay',
    label: 'Display over other apps',
    why: 'Shows the block screen on top of blocked apps',
    request: () => Shield.requestOverlay(),
  },
  {
    key: 'battery',
    label: 'Run in background',
    why: 'Keeps the lock alive while you sleep',
    request: () => Shield.requestBattery(),
  },
];

export function NightToRisePermissions() {
  const [state, setState] = useState<Record<Key, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isNative || !isAndroid) { setLoading(false); return; }
    try {
      const p = await Shield.checkPermissions();
      setState({
        usageStats: !!p?.usageStats,
        accessibility: !!p?.accessibility,
        overlay: !!p?.overlay,
        battery: !!p?.battery,
      });
    } catch (e) {
      console.warn('[NightToRise] checkPermissions failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  if (!isNative || !isAndroid) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          App blocking runs only inside the Android app. On the web you can configure everything, but
          nothing is enforced.
        </p>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking permissions…
      </div>
    );
  }

  const missing = ROWS.filter((r) => !state[r.key]);

  return (
    <div className="space-y-2">
      {missing.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium text-primary">All permissions granted — blocking is live.</p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {missing.length} permission{missing.length > 1 ? 's' : ''} missing — blocking will not work
          until these are granted.
        </p>
      )}

      {ROWS.map((row) => {
        const ok = state[row.key];
        return (
          <div
            key={row.key}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5',
              ok ? 'border-border bg-muted/30' : 'border-destructive/40 bg-destructive/5',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{row.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{row.why}</p>
            </div>
            {ok ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Check className="h-4 w-4 text-primary" />
              </span>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  void lightImpact();
                  try { await row.request(); } catch { toast.error('Could not open settings'); }
                }}
                className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground active:scale-95 transition-transform"
              >
                Grant
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default NightToRisePermissions;
