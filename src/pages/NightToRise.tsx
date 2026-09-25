/**
 * NightToRise — full-page route at /rise/night-to-rise.
 *
 * Sections 1–4 of the Sleep-to-Rise overhaul:
 *  - shadcn/ui throughout (Card, Tabs, Slider, Switch, Sheet, Dialog, Badge,
 *    Progress, Select, sonner) — no ad hoc styled divs for structure.
 *  - Dynamic time-of-day ombré via useTimeTheme(), scoped to this route with
 *    --stf-* custom properties, pinned warm-dim while a lock is enforcing.
 *  - The Night Arc as the signature header.
 *  - Strict Mode with a real 24h commitment + delayed emergency unlock.
 *  - Pause with reason + weekly cap, chronotype onboarding, gradual shift.
 */

import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Moon, Sunrise, Smartphone, MessageSquare, CalendarDays, X,
  PauseCircle, ShieldCheck, Flame, Lock, BarChart3, Settings2, Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { OfflineBadge } from '@/components/OfflineGuard';

import { useNightToRise } from '@/components/rise/night-to-rise/useNightToRise';
import { useNightToRiseStreak } from '@/components/rise/night-to-rise/useNightToRiseStreak';
import { useNightToRiseLogs } from '@/hooks/useNightToRiseLogs';
import { NightArc } from '@/components/rise/night-to-rise/NightArc';
import { NightToRiseInsights } from '@/components/rise/night-to-rise/NightToRiseInsights';
import { useNextRiseAlarm } from '@/components/rise/night-to-rise/nextRiseAlarm';
import { InstalledAppPicker } from '@/components/rise/night-to-rise/InstalledAppPicker';
import { NightToRisePermissions } from '@/components/rise/night-to-rise/NightToRisePermissions';
import { NightToRiseSelfTest } from '@/components/rise/night-to-rise/NightToRiseSelfTest';
import { ChronotypeOnboarding } from '@/components/rise/night-to-rise/ChronotypeOnboarding';
import { SleepCoachNotes } from '@/components/rise/night-to-rise/SleepCoachNotes';
import {
  ALWAYS_ALLOWED_IDS, MAX_PAUSES_PER_WEEK, PAUSE_REASONS, type PauseReason,
  type ScheduleMode,
} from '@/components/rise/night-to-rise/types';
import { formatClock, parseHM } from '@/components/rise/night-to-rise/timeMath';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


function msToClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function NightToRisePage() {
  const navigate = useNavigate();
  // Single source of truth: nearest upcoming alarm, weekday-aware, merging
  // this phone's alarms with the ones saved in the account.
  const riseAlarm = useNextRiseAlarm();
  const riseAlarmTime = riseAlarm?.time ?? null;

  const {
    config, update, status, windows, isLockEnforcing,
    pauseTonight, canPauseTonight, pausesThisWeek,
    strictLocked, strictLockRemainingMs, enableStrictMode, disableStrictMode,
    requestEmergencyUnlock, emergencyUnlockMsLeft,
  } = useNightToRise(riseAlarm);


  const { streak: localStreak } = useNightToRiseStreak();
  const { streak: serverStreak, protectedNights, successRate, averageSleepMinutes } = useNightToRiseLogs();
  const streak = Math.max(serverStreak, localStreak);


  const [pickerOpen, setPickerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<PauseReason>('Other');
  const [strictDialog, setStrictDialog] = useState(false);
  const [chronoOpen, setChronoOpen] = useState(false);
  const [, tick] = useState(0);

  // Live second-tick only while an emergency unlock countdown is running.
  useEffect(() => {
    if (emergencyUnlockMsLeft == null) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [emergencyUnlockMsLeft]);

  // First run → chronotype onboarding.
  useEffect(() => {
    if (!config.configured && !config.chronotypeAnswered) {
      const t = setTimeout(() => setChronoOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [config.configured, config.chronotypeAnswered]);

  const guarded = (fn: () => void) => () => {
    if (strictLocked) {
      toast('Strict Mode is holding your settings', {
        description: `Unlocks in ${msToClock(strictLockRemainingMs)}.`,
      });
      return;
    }
    fn();
  };

  const toggleDay = (d: number) => {
    const set = new Set(config.scheduleDays);
    set.has(d) ? set.delete(d) : set.add(d);
    update({ scheduleDays: Array.from(set).sort() });
  };

  const removeApp = (id: string) =>
    update({ allowedApps: config.allowedApps.filter((a) => a.id !== id) });

  const confirmPause = () => {
    if (pauseTonight(pauseReason)) {
      toast.success('Paused for tonight', { description: 'Protection resumes tomorrow.' });
      setPauseOpen(false);
    } else {
      toast.error(`Only ${MAX_PAUSES_PER_WEEK} pause per week`, { description: 'It comes back on Monday.' });
    }
  };

  const summary = useMemo(() => {
    if (status.phase === 'off') return 'Protection is off. Turn it on to guard tonight.';
    if (status.phase === 'paused') return 'Paused for tonight — back tomorrow.';
    if (status.phase === 'inactive-day') return 'Not scheduled tonight.';
    if (status.phase === 'sleep-lock') return 'Sleep Guard is holding the line right now.';
    if (status.phase === 'rise-lock') return 'Rise Guard is protecting your morning.';
    return `Wind-down starts at ${formatClock(windows.sleepStart)}.`;
  }, [status.phase, windows.sleepStart]);

  return (
    <AppLayout hideMobileHeader>
      <div className="n2r min-h-screen pb-28" data-phase={status.phase}>
        {/* ---------------------------- Header ---------------------------- */}
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
                <h1 className="truncate text-xl font-bold">Sleep to Rise</h1>
                <p className="text-xs text-muted-foreground">Protecting your night and morning</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OfflineBadge />
              <Button
                variant="ghost" size="icon" aria-label="Advanced settings"
                onClick={() => setAdvancedOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Switch
                checked={config.enabled}
                onCheckedChange={guarded(() => update({ enabled: !config.enabled }))}
                aria-label="Enable Sleep to Rise"
              />
            </div>
          </div>

          {/* -------------------------- Night Arc -------------------------- */}
          <div className="mt-3">
            <NightArc
              sleepTime={config.sleepTime}
              shiftTargetTime={config.shiftTargetTime}
              riseTime={riseAlarmTime}
              lockBeforeMin={config.sleepLockMinutesBefore}
              lockAfterMin={config.riseLockMinutesAfter}
              phase={config.enabled ? status.phase : 'off'}
            />
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-2xl space-y-4 px-4">
          {/* --------------------------- Today card -------------------------- */}
          <Card className="n2r-surface">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-overline text-xs uppercase tracking-wide text-muted-foreground">Today</p>
                  <p className="mt-1 text-sm">{summary}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="n2r-display text-4xl leading-none n2r-accent-text">{streak}</p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                    <Flame className="h-3 w-3 text-warning" /> night streak
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm" variant="outline"
                  onClick={() => (strictLocked ? guarded(() => {})() : setPauseOpen(true))}
                >
                  <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                  Pause tonight
                </Button>
                <Badge
                  variant={config.strictMode ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => setStrictDialog(true)}
                >
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {config.strictMode
                    ? strictLocked ? `Strict · ${msToClock(strictLockRemainingMs)}` : 'Strict on'
                    : 'Strict off'}
                </Badge>
                {config.enabled && <Badge variant="outline">Native blocking</Badge>}
              </div>

              {emergencyUnlockMsLeft != null && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                  <p className="text-xs text-muted-foreground">Emergency unlock in</p>
                  <p className="n2r-mono text-lg font-semibold">{msToClock(emergencyUnlockMsLeft)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <SleepCoachNotes
            config={config}
            update={update}
            averageSleepMinutes={averageSleepMinutes}
            disabled={strictLocked}
          />

          {strictLocked && (
            <Card className="border-warning/40 n2r-surface">
              <CardContent className="flex items-center gap-3 p-3">
                <Lock className="h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-muted-foreground">
                  Strict Mode is active. Settings are held for{' '}
                  <span className="n2r-mono">{msToClock(strictLockRemainingMs)}</span>. You chose this — it holds.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ----------------------------- Tabs ----------------------------- */}
          <Tabs defaultValue="insights" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="insights" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> Insights
              </TabsTrigger>
              <TabsTrigger value="setup" className="gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" /> Setup
              </TabsTrigger>
            </TabsList>

            {/* ============================ SETUP ============================ */}
            <TabsContent value="setup" className="mt-4 space-y-5">
              <NightToRisePermissions />
              <NightToRiseSelfTest />

              <GroupLabel>Timing</GroupLabel>

              <Section icon={<Moon className="h-4 w-4" />} title="Sleep Guard" subtitle="Lock distracting apps before bed">
                <div className="space-y-4">
                  {/* NEW (v4): independent on/off — user can run Sleep Guard,
                      Rise Guard, or both. */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-medium">Sleep Guard on</p>
                      <p className="text-xs text-muted-foreground">Lock apps in the evening/night</p>
                    </div>
                    <Switch
                      checked={config.sleepGuardEnabled}
                      disabled={strictLocked}
                      onCheckedChange={(v) => update({ sleepGuardEnabled: v })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Target sleep time</Label>
                    <Input
                      type="time"
                      value={config.sleepTime}
                      disabled={strictLocked || !config.sleepGuardEnabled}
                      onChange={(e) => update({ sleepTime: e.target.value })}
                      className="n2r-mono mt-1 text-base"
                    />
                  </div>
                  <SliderRow
                    label="Lock starts before sleep"
                    value={config.sleepLockMinutesBefore}
                    min={0} max={120} step={5}
                    disabled={strictLocked || !config.sleepGuardEnabled}
                    onChange={(v) => update({ sleepLockMinutesBefore: v })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Wind-down begins at{' '}
                    <span className="n2r-mono">{formatClock(windows.sleepStart)}</span>.
                  </p>

                  {/* NEW (v4): how Sleep Guard ends — either it runs straight
                      through until the Rise alarm, or it auto-releases after a
                      fixed duration (leaving a gap until Rise Guard starts at
                      the alarm). */}
                  <div className="space-y-2 border-t border-border pt-4">
                    <Label className="text-xs text-muted-foreground">Sleep Guard ends</Label>
                    <ToggleGroup
                      type="single"
                      value={config.sleepGuardEndMode}
                      onValueChange={(v) => {
                        if (v === 'until-alarm' || v === 'duration') update({ sleepGuardEndMode: v });
                      }}
                      disabled={strictLocked || !config.sleepGuardEnabled}
                      className="grid grid-cols-2 gap-2"
                    >
                      <ToggleGroupItem value="until-alarm" className="text-xs">
                        Until Rise alarm
                      </ToggleGroupItem>
                      <ToggleGroupItem value="duration" className="text-xs">
                        Auto-off after a set time
                      </ToggleGroupItem>
                    </ToggleGroup>
                    {config.sleepGuardEndMode === 'duration' && (
                      <>
                        <SliderRow
                          label="Sleep Guard runs for"
                          value={config.sleepGuardDurationMinutes}
                          min={30} max={480} step={15}
                          disabled={strictLocked || !config.sleepGuardEnabled}
                          onChange={(v) => update({ sleepGuardDurationMinutes: v })}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Sleep Guard turns off on its own{' '}
                          {Math.round(config.sleepGuardDurationMinutes / 60 * 10) / 10}h after it starts —
                          even if the Rise alarm hasn't gone off yet. Rise Guard still starts separately
                          when the alarm fires.
                        </p>
                      </>
                    )}
                    {config.sleepGuardEndMode === 'until-alarm' && (
                      <>
                        <SliderRow
                          label="Safety limit with no alarm set"
                          value={config.safetyCapHours ?? 10}
                          min={4} max={12} step={1}
                          disabled={strictLocked || !config.sleepGuardEnabled}
                          onChange={(v) => update({ safetyCapHours: v })}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          If no alarm is set, Sleep Guard releases itself{' '}
                          {config.safetyCapHours ?? 10}h after the lock starts, so a missing alarm can
                          never keep your phone locked.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </Section>

              <Section icon={<Sunrise className="h-4 w-4" />} title="Rise Guard" subtitle="Stay off the feed after waking">
                <div className="space-y-4">
                  {/* NEW (v4): independent on/off. */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-medium">Rise Guard on</p>
                      <p className="text-xs text-muted-foreground">Lock apps after the alarm rings</p>
                    </div>
                    <Switch
                      checked={config.riseGuardEnabled}
                      disabled={strictLocked}
                      onCheckedChange={(v) => update({ riseGuardEnabled: v })}
                    />
                  </div>
                  <div className="n2r-row justify-between">
                    <span className="text-sm">Alarm time</span>
                    <span className="n2r-mono text-sm font-semibold text-warning">
                      {riseAlarmTime ? formatClock(parseHM(riseAlarmTime)) : 'No alarm set'}
                    </span>
                  </div>
                  <SliderRow
                    label="Lock stays for"
                    value={config.riseLockMinutesAfter}
                    min={5} max={120} step={5}
                    disabled={strictLocked || !config.riseGuardEnabled}
                    onChange={(v) => update({ riseLockMinutesAfter: v })}
                  />
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-warning" />
                      <div>
                        <p className="text-sm font-medium">Morning light prompt</p>
                        <p className="text-xs text-muted-foreground">Nudge to step into daylight after the alarm</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.showStreakOnBlock}
                      disabled={strictLocked}
                      onCheckedChange={(v) => update({ showStreakOnBlock: v })}
                    />
                  </div>
                </div>
              </Section>

              <GroupLabel>Blocking</GroupLabel>

              <Section
                icon={<Smartphone className="h-4 w-4" />}
                title="Allowed Apps"
                subtitle="Only these stay open during locked windows — everything else is blocked"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {config.allowedApps.map((a) => {
                      const locked = ALWAYS_ALLOWED_IDS.includes(a.id);
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                            locked
                              ? 'border border-dashed border-border bg-muted/40 text-muted-foreground'
                              : 'border border-border bg-card',
                          )}
                        >
                          {locked ? <Lock className="h-3 w-3" /> : null}
                          {a.name}
                          {!locked && !strictLocked && (
                            <button onClick={() => removeApp(a.id)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${a.name}`}>
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Button variant="outline" size="sm" disabled={strictLocked} onClick={() => setPickerOpen(true)}>
                    Choose from installed apps
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    While a lock window is active, apps outside your allowed list can't be
                    opened. Phone, Messages, Clock and Emergency are always available.
                  </p>
                </div>
              </Section>

              <GroupLabel>Schedule</GroupLabel>

              <Section icon={<CalendarDays className="h-4 w-4" />} title="When it runs" subtitle="Everyday, weekdays or your own days">
                <div className="space-y-3">
                  <ToggleGroup
                    type="single"
                    value={config.scheduleMode}
                    onValueChange={(v) => v && !strictLocked && update({ scheduleMode: v as ScheduleMode })}
                    className="grid w-full grid-cols-3 gap-2"
                  >
                    {(['everyday', 'weekdays', 'custom'] as ScheduleMode[]).map((m) => (
                      <ToggleGroupItem key={m} value={m} className="w-full text-xs capitalize" disabled={strictLocked}>
                        {m}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>

                  {config.scheduleMode === 'custom' && (
                    <>
                      <div className="flex gap-1">
                        {DAYS.map((d, i) => (
                          <button
                            key={d}
                            disabled={strictLocked}
                            onClick={() => toggleDay(i)}
                            className={cn(
                              'flex-1 rounded-md border py-2 text-[11px] font-medium transition-colors',
                              config.scheduleDays.includes(i)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground',
                            )}
                          >{d}</button>
                        ))}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Weekend target (optional)</Label>
                        <Input
                          type="time"
                          value={config.weekendSleepTime ?? ''}
                          disabled={strictLocked}
                          onChange={(e) => update({ weekendSleepTime: e.target.value || null })}
                          className="n2r-mono mt-1"
                        />
                      </div>
                    </>
                  )}
                </div>
              </Section>

              <GroupLabel>Protection</GroupLabel>

              <Section icon={<ShieldCheck className="h-4 w-4" />} title="Strict Mode" subtitle="A 24-hour commitment you can't undo on impulse">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-medium">Strict Mode</p>
                      <p className="text-xs text-muted-foreground">
                        {strictLocked
                          ? `Locked for ${msToClock(strictLockRemainingMs)}`
                          : 'Settings lock for 24 hours; emergency unlock takes 10 minutes'}
                      </p>
                    </div>
                    <Switch
                      checked={config.strictMode}
                      onCheckedChange={(v) => {
                        if (v) setStrictDialog(true);
                        else if (strictLocked) guarded(() => {})();
                        else disableStrictMode();
                      }}
                    />
                  </div>

                  {config.strictMode && (
                    <Button
                      variant="outline" size="sm"
                      disabled={emergencyUnlockMsLeft != null}
                      onClick={() => {
                        requestEmergencyUnlock();
                        toast('Emergency unlock started', { description: 'It becomes available in 10 minutes.' });
                      }}
                    >
                      {emergencyUnlockMsLeft != null
                        ? `Unlock in ${msToClock(emergencyUnlockMsLeft)}`
                        : 'Start emergency unlock'}
                    </Button>
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-medium">Pause for one night</p>
                      <p className="text-xs text-muted-foreground">
                        {pausesThisWeek}/{MAX_PAUSES_PER_WEEK} used this week
                      </p>
                    </div>
                    <Button size="sm" variant="outline" disabled={!canPauseTonight} onClick={() => setPauseOpen(true)}>
                      Pause
                    </Button>
                  </div>
                </div>
              </Section>
            </TabsContent>

            {/* =========================== INSIGHTS =========================== */}
            <TabsContent value="insights" className="mt-4 space-y-4">
              <Card className="n2r-surface">
                <CardContent className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <p className="n2r-display text-3xl n2r-accent-text">{streak}</p>
                    <p className="text-xs text-muted-foreground">Current streak</p>
                  </div>
                  <div>
                    <p className="n2r-display text-3xl n2r-accent-text">{successRate}%</p>
                    <p className="text-xs text-muted-foreground">Success rate</p>
                  </div>
                  <div className="col-span-2 flex items-center gap-6 border-t border-border/60 pt-3">
                    <div>
                      <p className="n2r-mono text-sm font-semibold">{protectedNights}</p>
                      <p className="text-[11px] text-muted-foreground">Protected nights</p>
                    </div>
                    <div>
                      <p className="n2r-mono text-sm font-semibold">
                        {averageSleepMinutes != null ? formatClock(averageSleepMinutes) : '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Average bedtime</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Section icon={<BarChart3 className="h-4 w-4" />} title="Night log" subtitle="Your recent nights, week strip and recap">
                <NightToRiseInsights config={config} update={update} />
              </Section>
            </TabsContent>
          </Tabs>
        </div>

        {/* ------------------------- Advanced sheet ------------------------- */}
        <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Advanced</SheetTitle>
              <SheetDescription>Block screen wording and device permissions.</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <Section icon={<MessageSquare className="h-4 w-4" />} title="Block Screen" subtitle="What the lock screen says">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Sleep window message</Label>
                    <Textarea
                      value={config.sleepBlockMessage}
                      disabled={strictLocked}
                      onChange={(e) => update({ sleepBlockMessage: e.target.value })}
                      rows={2}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Rise window message</Label>
                    <Textarea
                      value={config.riseBlockMessage}
                      disabled={strictLocked}
                      onChange={(e) => update({ riseBlockMessage: e.target.value })}
                      rows={2}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-medium">Show streak on block screen</p>
                      <p className="text-xs text-muted-foreground">"7 mornings protected in a row"</p>
                    </div>
                    <Switch
                      checked={config.showStreakOnBlock}
                      disabled={strictLocked}
                      onCheckedChange={(v) => update({ showStreakOnBlock: v })}
                    />
                  </div>
                </div>
              </Section>

              <Section icon={<Lock className="h-4 w-4" />} title="Permissions" subtitle="Required for native blocking">
                <NightToRisePermissions />
              </Section>

              <Section icon={<Moon className="h-4 w-4" />} title="Your rhythm" subtitle="Chronotype estimate used for suggestions">
                <div className="flex items-center justify-between">
                  <p className="text-sm capitalize">{config.chronotype ?? 'not set'}</p>
                  <Button size="sm" variant="outline" onClick={() => setChronoOpen(true)}>
                    {config.chronotype ? 'Redo' : 'Take the quiz'}
                  </Button>
                </div>
              </Section>

              <div className="h-6" />
            </div>
          </SheetContent>
        </Sheet>

        {/* --------------------------- Pause sheet --------------------------- */}
        <Sheet open={pauseOpen} onOpenChange={setPauseOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle>Pause for one night</SheetTitle>
              <SheetDescription>
                {canPauseTonight
                  ? `Protection resumes tomorrow. ${pausesThisWeek}/${MAX_PAUSES_PER_WEEK} used this week.`
                  : 'Your weekly pause is already used — it comes back on Monday.'}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                <Select value={pauseReason} onValueChange={(v) => setPauseReason(v as PauseReason)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAUSE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!canPauseTonight} onClick={confirmPause}>
                Pause tonight
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* ------------------------ Strict Mode dialog ----------------------- */}
        <Dialog open={strictDialog} onOpenChange={setStrictDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Turn on Strict Mode?</DialogTitle>
              <DialogDescription>
                Your Sleep to Rise settings will be locked for 24 hours. No PIN override — an
                emergency unlock is still available, but it takes 10 minutes to open.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setStrictDialog(false)}>Not now</Button>
              <Button
                onClick={() => {
                  enableStrictMode();
                  setStrictDialog(false);
                  toast.success('Strict Mode on', { description: 'Locked for the next 24 hours.' });
                }}
              >
                Yes, lock it in
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* -------------------------- App picker ----------------------------- */}
        <InstalledAppPicker
          open={pickerOpen}
          title="Allowed during lock"
          selected={config.allowedApps.map((a) => a.id)}
          lockedIds={ALWAYS_ALLOWED_IDS}
          onClose={() => setPickerOpen(false)}
          onSave={(apps) => { update({ allowedApps: apps }); setPickerOpen(false); toast.success('Allowed apps saved'); }}
        />

        {/* ----------------------- Chronotype onboarding --------------------- */}
        <ChronotypeOnboarding
          open={chronoOpen}
          onOpenChange={(v) => {
            setChronoOpen(v);
            if (!v) update({ chronotypeAnswered: true });
          }}
          onDone={({ chronotype, suggestedSleepTime }) => {
            update({ chronotype, chronotypeAnswered: true, sleepTime: suggestedSleepTime });
            toast.success('Target set', {
              description: `Suggested bedtime ${formatClock(parseHM(suggestedSleepTime))} for a ${chronotype} rhythm.`,
            });
          }}
        />
      </div>
    </AppLayout>
  );
}

/* ------------------------------ primitives ------------------------------ */

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function Section({
  icon, title, subtitle, children,
}: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="n2r-surface">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="n2r-accent-text">{icon}</span>
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, disabled,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="n2r-mono text-sm font-semibold">{value} min</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}


