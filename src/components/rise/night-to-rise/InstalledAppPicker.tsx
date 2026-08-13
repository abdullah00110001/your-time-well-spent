/**
 * InstalledAppPicker — real device app-list picker.
 *
 * On Android it reads the actually installed launchable apps through the
 * ShieldPlugin (`getInstalledApps`) so selections are saved as real package
 * names, which is what the native NightToRise enforcement matches against.
 * On web (and if the native call fails) it falls back to a curated list so the
 * UI stays usable for testing.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isNative, isAndroid } from '@/lib/capacitor/platform';
import Shield from '@/lib/capacitor/shieldPlugin';
import { lightImpact, successNotification } from '@/lib/capacitor/nativeHaptics';
import { AllowedApp, SUGGESTED_BLOCK_APPS, ALWAYS_ALLOWED_IDS } from './types';

const FALLBACK_APPS: AllowedApp[] = [
  { id: 'com.android.phone', name: 'Phone' },
  { id: 'com.android.dialer', name: 'Dialer' },
  { id: 'com.android.deskclock', name: 'Clock' },
  { id: 'com.android.camera', name: 'Camera' },
  { id: 'com.google.android.calendar', name: 'Calendar' },
  { id: 'com.google.android.keep', name: 'Keep Notes' },
  { id: 'com.whatsapp', name: 'WhatsApp' },
  { id: 'org.telegram.messenger', name: 'Telegram' },
  { id: 'com.spotify.music', name: 'Spotify' },
  { id: 'com.google.android.gm', name: 'Gmail' },
  ...SUGGESTED_BLOCK_APPS,
];

interface Props {
  open: boolean;
  title: string;
  /** Currently selected package names. */
  selected: string[];
  /** Package names that may never be deselected (safety). */
  lockedIds?: string[];
  onClose: () => void;
  onSave: (apps: AllowedApp[]) => void;
}

export function InstalledAppPicker({
  open,
  title,
  selected,
  lockedIds = [],
  onClose,
  onSave,
}: Props) {
  const [apps, setApps] = useState<AllowedApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [nativeUnavailable, setNativeUnavailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set([...selected, ...lockedIds]));
    setQuery('');

    let cancelled = false;
    const loadApps = async () => {
      setLoading(true);
      setNativeUnavailable(false);
      try {
        if (isNative && isAndroid) {
          const res = await Shield.getInstalledApps();
          const list = (res?.apps ?? [])
            .filter((a) => a?.packageName)
            .map((a) => ({ id: a.packageName, name: a.appName || a.packageName }));
          if (!cancelled && list.length > 0) {
            setApps(dedupe(list));
            return;
          }
        }
        if (!cancelled) {
          setNativeUnavailable(isNative);
          setApps(dedupe(FALLBACK_APPS));
        }
      } catch (e) {
        console.warn('[InstalledAppPicker] getInstalledApps failed', e);
        if (!cancelled) {
          setNativeUnavailable(true);
          setApps(dedupe(FALLBACK_APPS));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadApps();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Ensure already-selected apps are visible even if not returned by the OS.
  const merged = useMemo(() => {
    const known = new Set(apps.map((a) => a.id));
    const extras = selected
      .filter((id) => !known.has(id))
      .map((id) => ({ id, name: id }));
    return [...extras, ...apps];
  }, [apps, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? merged.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
      : merged;
    return [...list].sort((a, b) => {
      const as = picked.has(a.id) ? 0 : 1;
      const bs = picked.has(b.id) ? 0 : 1;
      if (as !== bs) return as - bs;
      return a.name.localeCompare(b.name);
    });
  }, [merged, query, picked]);

  const toggle = (id: string) => {
    if (lockedIds.includes(id)) {
      toast.info('This app is always allowed for safety');
      return;
    }
    void lightImpact();
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    void successNotification();
    const byId = new Map(merged.map((a) => [a.id, a]));
    const result: AllowedApp[] = Array.from(picked).map(
      (id) => byId.get(id) ?? { id, name: id },
    );
    onSave(result);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col bg-background text-foreground">
      {/* Header — single close button */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button
          type="button"
          onClick={() => { void lightImpact(); onClose(); }}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted active:scale-95 transition-transform"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">{picked.size} selected</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps..."
            className="h-11 w-full rounded-xl border border-border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {nativeUnavailable && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Could not read the installed app list (permission or OS restriction). Showing common apps —
            search still matches package names.
          </p>
        )}
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Reading installed apps…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Smartphone className="h-8 w-8 opacity-40" />
            <p className="text-sm">No apps match “{query}”</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((app) => {
              const on = picked.has(app.id);
              const locked = lockedIds.includes(app.id);
              return (
                <li key={app.id}>
                  <button
                    type="button"
                    onClick={() => toggle(app.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors active:scale-[0.99]',
                      on ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{app.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{app.id}</p>
                    </div>
                    {locked && <span className="text-[10px] text-muted-foreground">always</span>}
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Save */}
      <div className="border-t border-border bg-background px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <button
          type="button"
          onClick={handleSave}
          className="h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-[0.98] transition-transform"
        >
          Save {picked.size > 0 ? `(${picked.size})` : ''}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function dedupe(list: AllowedApp[]): AllowedApp[] {
  const seen = new Set<string>();
  const out: AllowedApp[] = [];
  for (const a of list) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

export { ALWAYS_ALLOWED_IDS };
