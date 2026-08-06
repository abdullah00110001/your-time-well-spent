/**
 * NightToRise — full-page route at /rise/night-to-rise.
 *
 * Rebuilt around the "Night Arc" visual identity: a living night/dawn system
 * rather than a settings list. All tokens live under the scoped `.n2r` theme
 * in index.css; behaviour still comes from useNightToRise / useNightToRiseStreak.
 */

import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft, Moon, Sunrise, Smartphone, MessageSquare, CalendarDays, Plus, X,
  PauseCircle, Shield, ShieldCheck, Flame, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNightToRise } from '@/components/rise/night-to-rise/useNightToRise';
import AppLayout from '@/components/layout/AppLayout';
import { useNightToRiseStreak } from '@/components/rise/night-to-rise/useNightToRiseStreak';
import { NightArc } from '@/components/rise/night-to-rise/NightArc';
import { ALWAYS_ALLOWED_IDS, type AllowedApp, type ScheduleMode } from '@/components/rise/night-to-rise/types';
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
    update({ allowedApps: [...config.allowedApps, app] });
    setNewApp('');
  };

  const removeApp = (id: string) =>
    update({ allowedApps: config.allowedApps.filter((a) => a.id !== id) });

  const handlePause = () => {
    if (pauseTonight()) toast('Paused for tonight. Protection resumes tomorrow.');
    else toast('Your pause for this week is already used. It comes back Monday.');
  };

  return (
    <AppLayout hideMobileHeader>
      <div className="n2r min-h-screen pb-28" data-phase={status.phase}>
        {/* ---------- Header ---------- */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl n2r-muted hover:bg-white/5"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="n2r-display truncate text-2xl">Sleep to Rise</h1>
                <p className="text-xs n2r-muted">Protecting your night and your morning</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OfflineBadge />
              <Switch checked={config.enabled} onCheckedChange={(v) => update({ enabled: v })} aria-label="Enable Sleep to Rise" />
            </div>
          </div>

          {/* ---------- The Night Arc ---------- */}
          <div className="mt-4">
            <NightArc
              sleepTime={config.sleepTime}
              riseTime={riseAlarmTime}
              lockBeforeMin={config.sleepLockMinutesBefore}
              lockAfterMin={config.riseLockMinutesAfter}
              phase={config.enabled ? status.phase : 'off'}
            />
          </div>
        </div>

        <div className="mx-auto mt-5 max-w-2xl space-y-4 px-5">
          {/* ---------- Streak ---------- */}
          <div className="n2r-card flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-widest n2r-muted">Nights protected</p>
              <p className="n2r-display mt-1 text-4xl" style={{ color: 'var(--n2r-gold)' }}>{streak}</p>
              <p className="mt-1 text-xs n2r-muted">
                {streak === 0 ? 'Tonight can be the first one.' : 'In a row. Keep it quiet and steady.'}
              </p>
            </div>
            <Flame className="n2r-flame h-10 w-10" style={{ color: 'var(--n2r-coral)' }} />
          </div>

          {/* ---------- Sleep Guard ---------- */}
          <Section icon={<Moon className="h-4 w-4" />} title="Sleep Guard" subtitle="Lock distracting apps before bed" tone="night">
            <div className="space-y-4">
              <div>
                <Label className="text-xs n2r-muted">Target sleep time</Label>
                <Input
                  type="time"
                  value={config.sleepTime}
                  onChange={(e) => update({ sleepTime: e.target.value })}
                  className="n2r-mono mt-1 border-white/10 bg-white/5 text-lg"
                />
              </div>
              <SliderRow
                label="Lock starts before sleep"
                value={config.sleepLockMinutesBefore}
                min={0} max={120} step={5}
                tone="night"
                onChange={(v) => update({ sleepLockMinutesBefore: v })}
              />
            </div>
          </Section>

          {/* ---------- Rise Guard ---------- */}
          <Section icon={<Sunrise className="h-4 w-4" />} title="Rise Guard" subtitle="Stay off the feed after waking" tone="dawn">
            <div className="space-y-4">
              <div className="n2r-row justify-between">
                <span className="text-sm">Alarm time</span>
                <span className="n2r-mono text-sm" style={{ color: 'var(--n2r-gold)' }}>
                  {riseAlarmTime ?? 'No alarm set'}
                </span>
              </div>
              <SliderRow
                label="Lock stays for"
                value={config.riseLockMinutesAfter}
                min={5} max={120} step={5}
                tone="dawn"
                onChange={(v) => update({ riseLockMinutesAfter: v })}
              />
            </div>
          </Section>

          {/* ---------- Allowed apps ---------- */}
          <Section icon={<Smartphone className="h-4 w-4" />} title="Allowed Apps" subtitle="These stay open during locked windows" tone="night">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {config.allowedApps.map((a) => {
                  const locked = ALWAYS_ALLOWED_IDS.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{
                        background: 'color-mix(in srgb, var(--n2r-moon) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--n2r-moon) 28%, transparent)',
                        color: 'var(--n2r-ink)',
                      }}
                    >
                      {locked ? <Lock className="h-3 w-3 n2r-muted" /> : null}
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
              <div className="flex gap-2">
                <Input
                  placeholder="Add app name (e.g. Spotify)"
                  value={newApp}
                  onChange={(e) => setNewApp(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addApp()}
                  className="border-white/10 bg-white/5"
                />
                <Button size="icon" onClick={addApp} aria-label="Add app"><Plus className="h-4 w-4" /></Button>
              </div>
              <p className="text-[11px] n2r-muted">
                Phone, Clock and Emergency stay reachable at all times — they can't be removed.
              </p>
            </div>
          </Section>

          {/* ---------- Block screen ---------- */}
          <Section icon={<MessageSquare className="h-4 w-4" />} title="Block Screen" subtitle="What you'll read when the lock appears" tone="night">
            <div className="space-y-3">
              <div>
                <Label className="text-xs n2r-muted">Sleep window message</Label>
                <Textarea
                  value={config.sleepBlockMessage}
                  onChange={(e) => update({ sleepBlockMessage: e.target.value })}
                  rows={2} className="mt-1 resize-none border-white/10 bg-white/5"
                />
              </div>
              <div>
                <Label className="text-xs n2r-muted">Rise window message</Label>
                <Textarea
                  value={config.riseBlockMessage}
                  onChange={(e) => update({ riseBlockMessage: e.target.value })}
                  rows={2} className="mt-1 resize-none border-white/10 bg-white/5"
                />
              </div>
              <div className="n2r-row justify-between">
                <div>
                  <p className="text-sm">Show streak on the block screen</p>
                  <p className="text-xs n2r-muted">A quiet reminder of how far you've come</p>
                </div>
                <Switch checked={config.showStreakOnBlock} onCheckedChange={(v) => update({ showStreakOnBlock: v })} />
              </div>
            </div>
          </Section>

          {/* ---------- Schedule ---------- */}
          <Section icon={<CalendarDays className="h-4 w-4" />} title="Schedule" subtitle="Which nights this runs" tone="night">
            <div className="space-y-3">
              <div
                className="grid grid-cols-3 gap-1 rounded-full p-1"
                style={{ background: 'color-mix(in srgb, var(--n2r-moon) 8%, transparent)' }}
              >
                {(['everyday', 'weekdays', 'custom'] as ScheduleMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => update({ scheduleMode: m })}
                    className={cn('rounded-full px-2 py-2 text-xs font-medium capitalize transition-colors')}
                    style={config.scheduleMode === m
                      ? { background: 'var(--n2r-surface)', color: 'var(--n2r-ink)', boxShadow: '0 1px 0 rgba(143,168,204,0.2)' }
                      : { color: 'var(--n2r-moon)' }}
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
                      className="flex-1 rounded-xl py-2 text-[11px] font-medium transition-colors"
                      style={config.scheduleDays.includes(i)
                        ? { background: 'color-mix(in srgb, var(--n2r-coral) 18%, transparent)', color: 'var(--n2r-gold)' }
                        : { background: 'color-mix(in srgb, var(--n2r-moon) 8%, transparent)', color: 'var(--n2r-moon)' }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {/* Pause row */}
              <div className="n2r-row justify-between">
                <div className="flex items-center gap-3">
                  <PauseCircle className="h-4 w-4 n2r-muted" />
                  <div>
                    <p className="text-sm">Pause for one night</p>
                    <p className="text-xs n2r-muted">
                      {canPauseTonight ? 'One pause per week' : 'Used this week — returns Monday'}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" disabled={!canPauseTonight} onClick={handlePause} className="n2r-pill">
                  {canPauseTonight ? 'Pause' : 'Used'}
                </Button>
              </div>

              {/* Strict mode row */}
              <div className="n2r-row justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 n2r-muted" />
                  <div>
                    <p className="text-sm">Strict mode</p>
                    <p className="text-xs n2r-muted">No override once the lock starts</p>
                  </div>
                </div>
                <Switch checked={config.strictMode} onCheckedChange={(v) => update({ strictMode: v })} />
              </div>
            </div>
          </Section>

          <div className="n2r-row justify-center text-center text-xs n2r-muted">
            {isNative ? (
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Blocking is enforced by Android</span>
            ) : (
              <span>On the web preview the lock shows an in-app overlay. Install the Android app for OS-level blocking.</span>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Section({
  icon, title, subtitle, tone, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: 'night' | 'dawn';
  children: React.ReactNode;
}) {
  const accent = tone === 'dawn' ? 'var(--n2r-coral)' : 'var(--n2r-moon)';
  return (
    <section className="n2r-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
        >
          {icon}
        </span>
        <div>
          <h2 className="n2r-display text-lg leading-tight">{title}</h2>
          <p className="text-xs n2r-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SliderRow({
  label, value, min, max, step, tone, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  tone: 'night' | 'dawn'; onChange: (v: number) => void;
}) {
  const grad = tone === 'dawn'
    ? 'linear-gradient(90deg, var(--n2r-twilight), var(--n2r-coral), var(--n2r-gold))'
    : 'linear-gradient(90deg, var(--n2r-moon), var(--n2r-twilight))';
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs n2r-muted">{label}</Label>
        <span className="n2r-mono text-sm" style={{ color: tone === 'dawn' ? 'var(--n2r-gold)' : 'var(--n2r-ink)' }}>
          {value} min
        </span>
      </div>
      <Slider
        min={min} max={max} step={step} value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="[&_[role=slider]]:border-0 [&_[role=slider]]:bg-[color:var(--n2r-ink)]"
        style={{ ['--n2r-track' as string]: grad }}
      />
      <div className="mt-1 h-[2px] w-full rounded-full opacity-40" style={{ background: grad }} />
    </div>
  );
}
