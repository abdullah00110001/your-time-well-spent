/**
 * NightToRise — full-page route at /rise/night-to-rise.
 *
 * Uses the app's own design system (Glacier tokens + Nunito / Hind Siliguri),
 * so it feels like the rest of LifeOS. Behaviour comes from useNightToRise /
 * useNightToRiseStreak; Phase 2 (blocklist + strict mode) and Phase 3
 * (analytics, weekly recap, group sharing) live in their own tabs.
 */

import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft, Moon, Sunrise, Smartphone, MessageSquare, CalendarDays, Plus, X,
  PauseCircle, Shield, ShieldCheck, Flame, Lock, Ban, BarChart3, Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNightToRise } from '@/components/rise/night-to-rise/useNightToRise';
import AppLayout from '@/components/layout/AppLayout';
import { useNightToRiseStreak } from '@/components/rise/night-to-rise/useNightToRiseStreak';
import { NightArc } from '@/components/rise/night-to-rise/NightArc';
import { NightToRiseBlocklist } from '@/components/rise/night-to-rise/NightToRiseBlocklist';
import { NightToRiseInsights } from '@/components/rise/night-to-rise/NightToRiseInsights';
import { InstalledAppPicker } from '@/components/rise/night-to-rise/InstalledAppPicker';
import { NightToRisePermissions } from '@/components/rise/night-to-rise/NightToRisePermissions';
import { ALWAYS_ALLOWED_IDS, MAX_PAUSES_PER_WEEK, type AllowedApp } from '@/components/rise/night-to-rise/types';
import { isNative } from '@/lib/capacitor/platform';
import { OfflineBadge } from '@/components/OfflineGuard';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function readNextAlarm(): string | null {
  try {
    const raw = localStorage.getItem('local_alarms');
    if (!raw) return null;
    const list = JSON.parse(raw) as Array<{ enabled?: boolean; time?: string }>;
    return list.find((a) => a.enabled && a.time)?.time ?? null;
  } catch { return null; }
}

export default function NightToRisePage() {
  const navigate = useNavigate();
  const riseAlarmTime = readNextAlarm();
  const { config, update, status, pauseTonight, canPauseTonight } = useNightToRise(riseAlarmTime);
  const { streak } = useNightToRiseStreak();
  const [newApp, setNewApp] = useState('');

  const toggleDay = (d: number) => {
    const set = new Set(config.scheduleDays);
    set.has(d) ? set.delete(d) : set.add(d);
    update({ scheduleDays: Array.from(set).sort() });
  };

  const addApp = () => {
    const name = newApp.trim();
    if (!name) return;
    const app: AllowedApp = { id: name.toLowerCase().replace(/\s+/g, '-'), name };
    if (config.allowedApps.some((a) => a.id === app.id)) { setNewApp(''); return; }
    update({ allowedApps: [...config.allowedApps, app] });
    setNewApp('');
  };

  const removeApp = (id: string) =>
    update({ allowedApps: config.allowedApps.filter((a) => a.id !== id) });

  const handlePause = () => {
    if (pauseTonight()) toast('Paused for tonight. Protection resumes tomorrow.');
    else toast(`Only ${MAX_PAUSES_PER_WEEK} pause per week — it comes back Monday.`);
  };

  return (
    <AppLayout hideMobileHeader>
      <div className="n2r min-h-screen pb-28" data-phase={status.phase}>
        {/* ---------- Header ---------- */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="n2r-display truncate text-xl">Sleep to Rise</h1>
                <p className="text-xs text-muted-foreground">Protecting your night and your morning</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OfflineBadge />
              <Switch checked={config.enabled} onCheckedChange={(v) => update({ enabled: v })} aria-label="Enable Sleep to Rise" />
            </div>
          </div>

          {/* ---------- The Night Arc ---------- */}
          <div className="mt-3">
            <NightArc
              sleepTime={config.sleepTime}
              riseTime={riseAlarmTime}
              lockBeforeMin={config.sleepLockMinutesBefore}
              lockAfterMin={config.riseLockMinutesAfter}
              phase={config.enabled ? status.phase : 'off'}
            />
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-2xl px-4">
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="setup" className="gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" /> Setup
              </TabsTrigger>
              <TabsTrigger value="blocking" className="gap-1.5 text-xs">
                <Ban className="h-3.5 w-3.5" /> Blocking
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> Insights
              </TabsTrigger>
            </TabsList>

            {/* ============================= SETUP ============================= */}
            <TabsContent value="setup" className="mt-4 space-y-4">
              {/* Streak */}
              <div className="n2r-card flex items-center justify-between p-4">
                <div>
                  <p className="text-overline">Nights protected</p>
                  <p className="n2r-display mt-1 text-3xl text-primary">{streak}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {streak === 0 ? 'Tonight can be the first one.' : 'In a row. Keep it quiet and steady.'}
                  </p>
                </div>
                <Flame className="n2r-flame h-9 w-9 text-warning" />
              </div>

              <Section icon={<Moon className="h-4 w-4" />} title="Sleep Guard" subtitle="Lock distracting apps before bed">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Target sleep time</Label>
                    <Input
                      type="time"
                      value={config.sleepTime}
                      onChange={(e) => update({ sleepTime: e.target.value })}
                      className="n2r-mono mt-1 text-base"
                    />
                  </div>
                  <SliderRow
                    label="Lock starts before sleep"
                    value={config.sleepLockMinutesBefore}
                    min={0} max={120} step={5}
                    onChange={(v) => update({ sleepLockMinutesBefore: v })}
                  />
                </div>
              </Section>

              <Section icon={<Sunrise className="h-4 w-4" />} title="Rise Guard" subtitle="Stay off the feed after waking" tone="dawn">
                <div className="space-y-4">
                  <div className="n2r-row justify-between">
                    <span className="text-sm">Alarm time</span>
                    <span className="n2r-mono text-sm font-semibold text-warning">
                      {riseAlarmTime ?? 'No alarm set'}
                    </span>
                  </div>
                  <SliderRow
                    label="Lock stays for"
                    value={config.riseLockMinutesAfter}
                    min={5} max={120} step={5}
                    onChange={(v) => update({ riseLockMinutesAfter: v })}
                  />
                </div>
              </Section>

              <Section icon={<Smartphone className="h-4 w-4" />} title="Allowed Apps" subtitle="These stay open during locked windows">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {config.allowedApps.map((a) => {
                      const locked = ALWAYS_ALLOWED_IDS.includes(a.id);
                      return (
                        <div
                          key={a.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium"
                        >
                          {locked ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
                          {a.name}
                          {!locked && (
                            <button onClick={() => removeApp(a.id)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${a.name}`}>
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Choose apps from your phone
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Phone, Clock and Emergency stay reachable at all times — they can't be removed.
                  </p>
                </div>
              </Section>

              <Section icon={<ShieldCheck className="h-4 w-4" />} title="Permissions" subtitle="Required for real app blocking">
                <NightToRisePermissions />
              </Section>

              <InstalledAppPicker
                open={pickerOpen}
                title="Allowed apps"
                selected={config.allowedApps.map((a) => a.id)}
                lockedIds={ALWAYS_ALLOWED_IDS}
                onClose={() => setPickerOpen(false)}
                onSave={(apps) => update({ allowedApps: apps })}
              />


              <Section icon={<MessageSquare className="h-4 w-4" />} title="Block Screen" subtitle="What you'll read when the lock appears">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Sleep window message</Label>
                    <Textarea
                      value={config.sleepBlockMessage}
                      onChange={(e) => update({ sleepBlockMessage: e.target.value })}
                      rows={2} className="mt-1 resize-none"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Rise window message</Label>
                    <Textarea
                      value={config.riseBlockMessage}
                      onChange={(e) => update({ riseBlockMessage: e.target.value })}
                      rows={2} className="mt-1 resize-none"
                    />
                  </div>
                  <div className="n2r-row justify-between">
                    <div>
                      <p className="text-sm">Show streak on the block screen</p>
                      <p className="text-xs text-muted-foreground">A quiet reminder of what you're protecting</p>
                    </div>
                    <Switch checked={config.showStreakOnBlock} onCheckedChange={(v) => update({ showStreakOnBlock: v })} />
                  </div>
                </div>
              </Section>

              <Section icon={<CalendarDays className="h-4 w-4" />} title="Schedule" subtitle="Which nights this runs">
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                    {(['everyday', 'weekdays', 'custom'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => update({ scheduleMode: m })}
                        className={cn(
                          'rounded-lg py-2 text-xs font-semibold capitalize transition-colors',
                          config.scheduleMode === m
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {config.scheduleMode === 'custom' && (
                    <div className="flex gap-1">
                      {DAYS.map((d, i) => (
                        <button
                          key={d}
                          onClick={() => toggleDay(i)}
                          className={cn(
                            'flex-1 rounded-lg py-2 text-[11px] font-semibold transition-colors',
                            config.scheduleDays.includes(i)
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="n2r-row justify-between">
                    <div className="flex items-center gap-3">
                      <PauseCircle className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm">Pause for one night</p>
                        <p className="text-xs text-muted-foreground">
                          {canPauseTonight ? 'One pause per week' : 'Used this week — returns Monday'}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" disabled={!canPauseTonight} onClick={handlePause}>
                      {canPauseTonight ? 'Pause' : 'Used'}
                    </Button>
                  </div>

                  <div className="n2r-row justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm">Strict mode</p>
                        <p className="text-xs text-muted-foreground">
                          Emergency unlock takes a 10 minute wait
                        </p>
                      </div>
                    </div>
                    <Switch checked={config.strictMode} onCheckedChange={(v) => update({ strictMode: v })} />
                  </div>
                </div>
              </Section>

              <div className="n2r-row justify-center text-center text-xs text-muted-foreground">
                {isNative ? (
                  <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Blocking is enforced by Android</span>
                ) : (
                  <span>On the web preview the lock shows an in-app overlay. Install the Android app for OS-level blocking.</span>
                )}
              </div>
            </TabsContent>

            {/* =========================== BLOCKING =========================== */}
            <TabsContent value="blocking" className="mt-4">
              <Section icon={<Ban className="h-4 w-4" />} title="Blocklist" subtitle="What gets locked during the night windows">
                <NightToRiseBlocklist config={config} update={update} />
              </Section>
            </TabsContent>

            {/* =========================== INSIGHTS =========================== */}
            <TabsContent value="insights" className="mt-4">
              <Section icon={<BarChart3 className="h-4 w-4" />} title="Insights" subtitle="Your nights, week by week">
                <NightToRiseInsights config={config} update={update} />
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

function Section({
  icon, title, subtitle, tone = 'night', children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone?: 'night' | 'dawn';
  children: React.ReactNode;
}) {
  return (
    <section className="n2r-card p-4">
      <div className="mb-4 flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            tone === 'dawn' ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary',
          )}
        >
          {icon}
        </span>
        <div>
          <h2 className="n2r-display text-base leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SliderRow({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="n2r-mono text-sm font-semibold">{value} min</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
