import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { BedDouble, Check, ChevronRight, Loader2, Search, ShieldAlert, Sunrise } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { isNative } from '@/lib/capacitor/platform';
import Shield, { type InstalledApp, type SleepToRiseState } from '@/lib/capacitor/shieldPlugin';

const WEB_KEY = 'sleep_to_rise_config';

const DEFAULT_STATE: SleepToRiseState = {
  enabled: false, startMin: 23 * 60, endMin: 6 * 60, riseGuardMin: 15,
  allowedApps: [], phase: 'OFF', pausedUntil: 0, lastSafetyTrip: 0,
};

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromTime = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

type Perms = { accessibility: boolean; usageStats: boolean; overlay: boolean; battery: boolean };

const PHASE_LABEL: Record<SleepToRiseState['phase'], string> = {
  OFF: 'Off', IDLE: 'Waiting for bedtime', SLEEP: 'Sleep guard active',
  RISE: 'Rise guard active', PAUSED: 'Paused for safety',
};

export function SleepToRiseSection() {
  const native = isNative();
  const [state, setState] = useState<SleepToRiseState>(DEFAULT_STATE);
  const [perms, setPerms] = useState<Perms | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    try {
      if (native) {
        const [s, p] = await Promise.all([Shield.getSleepToRise(), Shield.checkPermissions()]);
        setState({ ...DEFAULT_STATE, ...s });
        setPerms(p);
      } else {
        const { value } = await Preferences.get({ key: WEB_KEY });
        if (value) setState({ ...DEFAULT_STATE, ...JSON.parse(value) });
      }
    } catch (e) {
      console.warn('[SleepToRise] refresh failed', e);
    }
  }, [native]);

  useEffect(() => {
    refresh();
    if (!native) return;
    const sub = CapApp.addListener('resume', refresh);
    const id = window.setInterval(refresh, 30_000);
    return () => { sub.then((h) => h.remove()); window.clearInterval(id); };
  }, [native, refresh]);

  const permsOk = !native || (perms?.accessibility && perms?.overlay);

  const save = async (patch: Partial<SleepToRiseState>) => {
    const next = { ...state, ...patch };
    if (patch.enabled && native && !permsOk) {
      toast.error('Allow Accessibility and "Display over other apps" first');
      return;
    }
    setState(next);
    setSaving(true);
    try {
      const cfg = {
        enabled: next.enabled, startMin: next.startMin, endMin: next.endMin,
        riseGuardMin: next.riseGuardMin, allowedApps: next.allowedApps,
      };
      if (native) setState({ ...DEFAULT_STATE, ...(await Shield.setSleepToRise(cfg)) });
      else await Preferences.set({ key: WEB_KEY, value: JSON.stringify(cfg) });
    } catch (e) {
      toast.error('Could not save Sleep to Rise');
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const openPicker = async () => {
    if (!native) { toast.info('Choosing apps works in the Android app'); return; }
    setPickerOpen(true);
    if (apps.length) return;
    setAppsLoading(true);
    try {
      const res = await Shield.getInstalledApps({ icons: true });
      setApps(res.apps.sort((a, b) => a.appName.localeCompare(b.appName)));
    } catch {
      toast.error('Could not load your apps');
    } finally {
      setAppsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? apps.filter((a) => a.appName.toLowerCase().includes(q)) : apps;
  }, [apps, query]);

  const toggleApp = (pkg: string) => {
    const set = new Set(state.allowedApps);
    set.has(pkg) ? set.delete(pkg) : set.add(pkg);
    setState((s) => ({ ...s, allowedApps: [...set] }));
  };

  const permRows: Array<{ key: keyof Perms; label: string; req: () => Promise<void>; required: boolean }> = [
    { key: 'accessibility', label: 'Accessibility (sees which app opens)', req: () => Shield.requestAccessibility(), required: true },
    { key: 'overlay', label: 'Display over other apps (block card)', req: () => Shield.requestOverlay(), required: true },
    { key: 'usageStats', label: 'Usage access (backup detection)', req: () => Shield.requestUsageStats(), required: false },
    { key: 'battery', label: 'Ignore battery optimisation', req: () => Shield.requestBattery(), required: false },
  ];

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BedDouble className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">Sleep to Rise</p>
              <p className={cn('text-xs', state.phase === 'SLEEP' || state.phase === 'RISE' ? 'text-primary' : 'text-muted-foreground')}>
                {PHASE_LABEL[state.phase] ?? 'Off'}
              </p>
            </div>
          </div>
          <Switch checked={state.enabled} disabled={saving} onCheckedChange={(v) => save({ enabled: v })} />
        </div>

        {state.phase === 'PAUSED' && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
            <p className="flex items-center gap-2 font-medium"><ShieldAlert className="h-4 w-4" />Paused to keep your phone safe</p>
            <p className="text-muted-foreground">Blocking fired too many times in a minute, so it paused for 10 minutes.</p>
            <Button size="sm" variant="outline" onClick={async () => setState({ ...DEFAULT_STATE, ...(await Shield.resumeSleepToRise()) })}>Resume now</Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><BedDouble className="h-3 w-3" />Bedtime</Label>
            <Input type="time" value={toTime(state.startMin)} onChange={(e) => save({ startMin: fromTime(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Sunrise className="h-3 w-3" />Wake up</Label>
            <Input type="time" value={toTime(state.endMin)} onChange={(e) => save({ endMin: fromTime(e.target.value) })} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <Label>Rise guard after wake-up</Label>
            <span className="text-muted-foreground">{state.riseGuardMin === 0 ? 'Off' : `${state.riseGuardMin} min`}</span>
          </div>
          <Slider min={0} max={120} step={5} value={[state.riseGuardMin]}
            onValueChange={([v]) => setState((s) => ({ ...s, riseGuardMin: v }))}
            onValueCommit={([v]) => save({ riseGuardMin: v })} />
        </div>

        <button type="button" onClick={openPicker}
          className="w-full flex items-center justify-between rounded-lg border p-3 text-left">
          <div>
            <p className="text-sm font-medium">Allowed apps at night</p>
            <p className="text-xs text-muted-foreground">
              {state.allowedApps.length} chosen · Phone, Clock, keyboard and home screen are always allowed
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {native && perms && (
          <div className="space-y-2">
            {permRows.map((r) => (
              <div key={r.key} className="flex items-center justify-between text-xs">
                <span className={cn(!perms[r.key] && r.required && 'text-destructive')}>{r.label}</span>
                {perms[r.key]
                  ? <Check className="h-4 w-4 text-primary" />
                  : <Button size="sm" variant="outline" className="h-7" onClick={() => r.req().then(refresh)}>Allow</Button>}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Sheet open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) save({ allowedApps: state.allowedApps }); }}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader><SheetTitle>Allowed apps at night</SheetTitle></SheetHeader>
          <div className="relative my-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search apps" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {appsLoading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>}
            {!appsLoading && filtered.map((a) => {
              const on = state.allowedApps.includes(a.packageName);
              return (
                <button key={a.packageName} type="button" onClick={() => toggleApp(a.packageName)}
                  className={cn('w-full flex items-center gap-3 rounded-lg p-2 text-left', on && 'bg-primary/10')}>
                  {a.icon ? <img src={a.icon} alt="" className="h-9 w-9 rounded-lg" loading="lazy" /> : <div className="h-9 w-9 rounded-lg bg-muted" />}
                  <span className="flex-1 text-sm">{a.appName}</span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <Button className="mt-3" onClick={() => setPickerOpen(false)}>Save ({state.allowedApps.length})</Button>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

export default SleepToRiseSection;
