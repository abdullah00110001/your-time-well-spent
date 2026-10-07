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
import { useEffect, useState } from 'react';
import {
  ArrowLeft, Moon, Sunrise, Smartphone, MessageSquare, CalendarDays, X,
  PauseCircle, ShieldCheck, Flame, Lock, BarChart3, Settings2, Sun, ChevronDown, MoreHorizontal,
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
import { formatClock, formatGap, forwardDelta, minutesOfDay, parseHM } from '@/components/rise/night-to-rise/timeMath';

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
  const [sleepGoalHours, setSleepGoalHours] = useState(8);
  const [sleepLatencyMinutes, setSleepLatencyMinutes] = useState(15);

  // Device-safety notice: native side turned Sleep to Rise off after detecting
  // a block-screen flood right before a restart.
  useEffect(() => {
    import('@/lib/capacitor/nightToRiseBridge').then(async ({ nightToRiseBridge }) => {
      const st = await nightToRiseBridge.getStatus();
      if (st?.safeModeNotice) {
        toast.warning('Sleep to Rise was turned off to protect your phone', {
          description: 'Blocking repeated too fast before a restart. Review your allowed apps, then turn it on again.',
          duration: 12000,
        });
      }
    });
  }, []);
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

  const bedtimeMinutes = parseHM(config.shiftTargetTime ?? config.sleepTime);
  const sleepOpportunity = riseAlarmTime
    ? forwardDelta(bedtimeMinutes, parseHM(riseAlarmTime))
    : null;
  const estimatedSleep = sleepOpportunity == null ? null : Math.max(0, sleepOpportunity - sleepLatencyMinutes);
  const goalBedtime = riseAlarmTime
    ? (parseHM(riseAlarmTime) - sleepGoalHours * 60 - sleepLatencyMinutes + 1440) % 1440
    : null;
  const applyBedtime = (minutes: number) => {
    if (strictLocked) return;
    update({ sleepTime: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, shiftTargetTime: null });
    toast.success('Bedtime updated', { description: formatClock(minutes) });
  };

  return (
    <AppLayout hideMobileHeader>
      <div className="n2r min-h-screen pb-28" data-phase={status.phase}>
        {/* ---------------------------- Header ---------------------------- */}
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <Card className="n2r-surface rounded-lg border p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => navigate(-1)} aria-label="Back"
                  className="h-9 w-9 shrink-0 rounded-full"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <h1 className="n2r-display text-xl font-bold">Sleep to Rise</h1>
                  <p className="text-xs text-muted-foreground">Protecting your night and morning</p>
                </div>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <OfflineBadge />
                <Button
                  variant="ghost" size="icon" aria-label="More sleep settings" title="More sleep settings"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setAdvancedOpen(true)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={guarded(() => update({ enabled: !config.enabled }))}
                  aria-label="Enable Sleep to Rise"
                />
              </div>
            </div>
            <div className="mt-4">
              <NightArc
                sleepTime={config.sleepTime}
                shiftTargetTime={config.shiftTargetTime}
                riseTime={riseAlarmTime}
                lockBeforeMin={config.sleepLockMinutesBefore}
                lockAfterMin={config.riseLockMinutesAfter}
                phase={config.enabled ? status.phase : 'off'}
              />
            </div>
            <StatusCountdown phase={status.phase} sleepStart={windows.sleepStart} riseTime={riseAlarmTime} />
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px] font-normal">
                Bedtime <span className="n2r-mono ml-1">{formatClock(parseHM(config.sleepTime))}</span>
              </Badge>
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px] font-normal">
                Rise lock <span className="n2r-mono ml-1">{config.riseGuardEnabled ? `${config.riseLockMinutesAfter} min` : 'off'}</span>
              </Badge>
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px] font-normal">
                Strict {config.strictMode ? 'on' : 'off'}
              </Badge>
            </div>
          </Card>
        </div>

        <div className="mx-auto mt-4 max-w-2xl space-y-4 px-4">
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
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-full bg-muted/60 p-1">
              <TabsTrigger value="insights" className="h-10 gap-2 rounded-full text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <BarChart3 className="h-4 w-4" /> Insights
              </TabsTrigger>
              <TabsTrigger value="setup" className="h-10 gap-2 rounded-full text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Settings2 className="h-4 w-4" /> Setup
              </TabsTrigger>
            </TabsList>

            {/* ============================ SETUP ============================ */}
            <TabsContent value="setup" className="mt-4 space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
              <NightToRisePermissions />
              <NightToRiseSelfTest />

              <GroupLabel>Timing</GroupLabel>

              <Section icon={<Moon className="h-4 w-4" />} title="Sleep Guard" subtitle="Lock distracting apps before bed">
                <div className="space-y-4">
                  {/* NEW (v4): independent on/off — user can run Sleep Guard,
                      Rise Guard, or both. */}
                  <SettingRow title="Sleep Guard on" desc={'Lock apps in the evening/night'}>
                    <Switch
                      checked={config.sleepGuardEnabled}
                      disabled={strictLocked}
                      onCheckedChange={(v) => update({ sleepGuardEnabled: v })}
                    />
                  </SettingRow>
                  <div>
                    <Label className="text-xs text-muted-foreground">Target sleep time</Label>
                    <Input
                      type="time"
                      value={config.sleepTime}
                      disabled={strictLocked || !config.sleepGuardEnabled}
                      onChange={(e) => update({ sleepTime: e.target.value })}
                      className="n2r-mono mt-1 h-12 min-w-0 rounded-2xl text-base"
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
                      <ToggleGroupItem value="until-alarm" className="h-auto min-h-10 whitespace-normal rounded-full px-2 py-2 text-xs">
                        Until Rise alarm
                      </ToggleGroupItem>
                      <ToggleGroupItem value="duration" className="h-auto min-h-10 whitespace-normal rounded-full px-2 py-2 text-xs">
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
                          unit="h"
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
                  <SettingRow title="Rise Guard on" desc={'Lock apps after the alarm rings'}>
                    <Switch
                      checked={config.riseGuardEnabled}
                      disabled={strictLocked}
                      onCheckedChange={(v) => update({ riseGuardEnabled: v })}
                    />
                  </SettingRow>
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
                  <SettingRow icon={<Sun className="h-4 w-4 text-warning" />} title="Morning light prompt" desc="Nudge to step into daylight after the alarm">
                    <Switch
                      checked={config.showStreakOnBlock}
                      disabled={strictLocked}
                      onCheckedChange={(v) => update({ showStreakOnBlock: v })}
                    />
                  </SettingRow>
                </div>
              </Section>

              <GroupLabel>Blocking</GroupLabel>

              <Section
                icon={<Smartphone className="h-4 w-4" />}
                title="Allowed Apps"
                subtitle="Only these stay open during locked windows — everything else is blocked"
              >
                <div className="space-y-3">
                  <details className="group rounded-2xl border border-dashed border-border bg-muted/40">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl p-3.5 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">{ALWAYS_ALLOWED_IDS.length} system apps always allowed</span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <ul className="space-y-2 border-t border-dashed border-border px-3.5 py-3 text-xs text-muted-foreground">
                      {ALWAYS_ALLOWED_IDS.map((id) => (
                        <li key={id} className="flex items-center gap-2 break-all">
                          <ShieldCheck className="h-3 w-3 shrink-0" />
                          {config.allowedApps.find((app) => app.id === id)?.name ?? id.split('.').pop()}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <div className="flex flex-wrap gap-2">
                    {config.allowedApps.filter((a) => !ALWAYS_ALLOWED_IDS.includes(a.id)).map((a) => (
                      <div key={a.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-2 text-xs font-medium">
                        <span className="n2r-accent-text flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/60">{a.name.slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0 break-words">{a.name}</span>
                        {!strictLocked && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeApp(a.id)} className="h-7 w-7 shrink-0 rounded-full text-muted-foreground" aria-label={`Remove ${a.name}`}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="h-11 w-full rounded-full" disabled={strictLocked} onClick={() => setPickerOpen(true)}>
                    <Smartphone className="mr-2 h-4 w-4" /> Choose from installed apps
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
                      <ToggleGroupItem key={m} value={m} className="w-full rounded-full text-xs capitalize" disabled={strictLocked}>
                        {m}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>

                  {config.scheduleMode === 'custom' && (
                    <>
                      <div className="flex gap-1">
                        {DAYS.map((d, i) => (
                          <Button
                            type="button" variant="outline"
                            key={d}
                            disabled={strictLocked}
                            onClick={() => toggleDay(i)}
                            className={cn(
                              'h-10 min-w-0 flex-1 rounded-xl border px-0 py-2 text-[11px] font-medium transition-colors',
                              config.scheduleDays.includes(i)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground',
                            )}
                          >{d}</Button>
                        ))}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Weekend target (optional)</Label>
                        <Input
                          type="time"
                          value={config.weekendSleepTime ?? ''}
                          disabled={strictLocked}
                          onChange={(e) => update({ weekendSleepTime: e.target.value || null })}
                          className="n2r-mono mt-1 h-12 min-w-0 rounded-2xl"
                        />
                      </div>
                    </>
                  )}
                </div>
              </Section>

              <GroupLabel>Protection</GroupLabel>

              <Section icon={<ShieldCheck className="h-4 w-4" />} title="Strict Mode" subtitle="A 24-hour commitment you can't undo on impulse">
                <div className="space-y-3">
                  <SettingRow title="Strict Mode" desc={strictLocked
                    ? `Locked for ${msToClock(strictLockRemainingMs)}`
                    : 'Settings lock for 24 hours; emergency unlock takes 10 minutes'}>
                    <Switch
                      checked={config.strictMode}
                      onCheckedChange={(v) => {
                        if (v) setStrictDialog(true);
                        else if (strictLocked) guarded(() => {})();
                        else disableStrictMode();
                      }}
                    />
                  </SettingRow>

                  {config.strictMode && (
                    <Button
                      variant="outline" size="sm" className="rounded-full"
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

                  <SettingRow title="Pause for one night" desc={`${pausesThisWeek}/${MAX_PAUSES_PER_WEEK} used this week`}>
                    <Button size="sm" variant="outline" className="rounded-full" disabled={!canPauseTonight} onClick={() => setPauseOpen(true)}>
                      Pause
                    </Button>
                  </SettingRow>
                </div>
              </Section>
            </TabsContent>

            {/* =========================== INSIGHTS =========================== */}
            <TabsContent value="insights" className="mt-4 space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
              <div className="grid grid-cols-2 gap-3">
                <StatTile icon={<Flame className="h-5 w-5" />} label="Current streak" value={streak} />
                <StatTile icon={<BarChart3 className="h-5 w-5" />} label="Success rate" value={successRate} suffix="%" />
                <StatTile icon={<ShieldCheck className="h-5 w-5" />} label="Protected nights" value={protectedNights} />
                <StatTile icon={<Moon className="h-5 w-5" />} label="Average bedtime" value={averageSleepMinutes} clock />
              </div>

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
              <SheetTitle>Sleep settings</SheetTitle>
              <SheetDescription>Your sleep rhythm, bedtime suggestions and protection settings.</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <section aria-labelledby="sleep-cycle-title" className="space-y-4 border-b border-border pb-5">
                <div>
                  <h2 id="sleep-cycle-title" className="flex items-center gap-2 text-sm font-semibold"><Moon className="h-4 w-4" /> Sleep cycle &amp; bedtime</h2>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Sleep cycles vary through the night. Around 90 minutes is only an estimate, not a guarantee of waking refreshed. Most adults need 7–9 hours of sleep.</p>
                </div>
                <SliderRow label="Sleep goal" value={sleepGoalHours} min={7} max={9} step={0.5} unit="h" onChange={setSleepGoalHours} />
                <SliderRow label="Time to fall asleep (estimate)" value={sleepLatencyMinutes} min={0} max={60} step={5} onChange={setSleepLatencyMinutes} />
                {riseAlarmTime && goalBedtime != null ? (
                  <>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Rise alarm</dt><dd className="n2r-mono">{formatClock(parseHM(riseAlarmTime))}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Time in bed</dt><dd className="n2r-mono">{formatGap(sleepOpportunity ?? 0)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Estimated sleep</dt><dd className="n2r-mono">{formatGap(estimatedSleep ?? 0)}</dd></div>
                    </dl>
                    <p className="text-xs leading-relaxed text-muted-foreground" role="status">{estimatedSleep != null && estimatedSleep < sleepGoalHours * 60
                      ? `Your current bedtime leaves ${formatGap(sleepGoalHours * 60 - estimatedSleep)} less than your goal. Try ${formatClock(goalBedtime)} for more sleep opportunity.`
                      : estimatedSleep != null && estimatedSleep > 540
                        ? 'This schedule leaves more than 9 hours for sleep. Check your bedtime and next alarm; sleep needs vary.'
                        : 'Your schedule leaves room for your sleep goal. Keep bedtime and wake time consistent.'}</p>
                    <Button variant="outline" className="w-full" disabled={strictLocked} onClick={() => applyBedtime(goalBedtime)}>
                      Use bedtime · {formatClock(goalBedtime)}
                    </Button>
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Cycle-based estimates</p>
                      {[5, 6].map((cycles) => {
                        const minutes = (parseHM(riseAlarmTime) - cycles * 90 - sleepLatencyMinutes + 1440) % 1440;
                        return <div key={cycles} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                          <div className="min-w-0"><p className="text-sm">{cycles} cycles · {cycles * 1.5} h</p><p className="n2r-mono text-xs text-muted-foreground">Bedtime {formatClock(minutes)}</p></div>
                          <Button size="sm" variant="ghost" disabled={strictLocked} aria-label={`Use ${cycles}-cycle bedtime`} onClick={() => applyBedtime(minutes)}>Use</Button>
                        </div>;
                      })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Set a Rise alarm to calculate bedtime suggestions. A guard duration is not a sleep measurement.</p>
                    <Button variant="outline" onClick={() => { setAdvancedOpen(false); navigate('/rise'); }}>Set a Rise alarm</Button>
                  </div>
                )}
                <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                  <p>Allow a quiet wind-down before bed; avoid caffeine late in the day and get daylight after waking.</p>
                  {config.weekendSleepTime && Math.min(forwardDelta(parseHM(config.sleepTime), parseHM(config.weekendSleepTime)), forwardDelta(parseHM(config.weekendSleepTime), parseHM(config.sleepTime))) > 60 && <p className="text-warning">Your weekend bedtime differs by more than an hour. Bringing it closer can help keep your rhythm steady.</p>}
                  {config.chronotype === 'owl' && <p>For a later natural rhythm, move bedtime earlier gradually rather than making a large jump.</p>}
                  <p>These are planning estimates, not measured sleep or medical advice. Goal and fall-asleep estimates reset when you leave this page; applying a bedtime saves it.</p>
                </div>
              </section>
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
                  <SettingRow title="Show streak on block screen" desc={'"7 mornings protected in a row"'}>
                    <Switch
                      checked={config.showStreakOnBlock}
                      disabled={strictLocked}
                      onCheckedChange={(v) => update({ showStreakOnBlock: v })}
                    />
                  </SettingRow>
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
          <SheetContent side="bottom" className="rounded-t-3xl">
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
              <Button className="w-full rounded-full" disabled={!canPauseTonight} onClick={confirmPause}>
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
                className="rounded-full"
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
    <p className="px-1 pt-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {children}
    </p>
  );
}

function Section({
  icon, title, subtitle, children,
}: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="n2r-surface rounded-lg">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-4 pb-3">
        <span className="n2r-accent-text flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60">{icon}</span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm leading-5">{title}</CardTitle>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, disabled, unit = 'min',
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; disabled?: boolean; unit?: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="n2r-mono shrink-0 text-sm font-semibold">{value} {unit}</span>
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



function SettingRow({ icon, title, desc, children }: {
  icon?: React.ReactNode; title: string; desc: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3.5">
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

/** Presentation-only clock; enforcement continues to use the existing hook. */
function StatusCountdown({ phase, sleepStart, riseTime }: { phase: string; sleepStart: number; riseTime: string | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const currentMinute = minutesOfDay(now);
  const labels: Record<string, string> = { off: 'Off', paused: 'Paused', 'inactive-day': 'Rest day', 'rise-lock': 'Active' };
  const sleeping = phase === 'sleep-lock';
  const label = labels[phase];
  const eyebrow = label ? (phase === 'rise-lock' ? 'Rise Guard' : 'Tonight')
    : sleeping ? 'Sleep Guard active' : 'Sleep Guard starts in';
  const value = label ?? (sleeping
    ? riseTime ? formatGap(forwardDelta(currentMinute, parseHM(riseTime))) : 'Active'
    : formatGap(forwardDelta(currentMinute, sleepStart)));
  return (
    <div className="mt-6 text-center" role="status" aria-live="off">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{eyebrow}</p>
      <p className="n2r-display n2r-accent-text mt-2 break-words text-4xl leading-tight">{value}</p>
      {sleeping && riseTime && <p className="mt-1 text-xs text-muted-foreground">Until unlock</p>}
    </div>
  );
}

function StatTile({ icon, label, value, suffix = '', clock = false }: {
  icon: React.ReactNode; label: string; value: number | null; suffix?: string; clock?: boolean;
}) {
  const [display, setDisplay] = useState(value ?? 0);
  useEffect(() => {
    if (value == null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value ?? 0);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 650);
      setDisplay(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <Card className="n2r-surface min-w-0 rounded-lg">
      <CardContent className="p-4">
        <span className="n2r-accent-text mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60">{icon}</span>
        <p className={cn('n2r-display n2r-accent-text min-h-9 break-words leading-9', clock ? 'text-xl' : 'text-3xl')} aria-label={value == null ? 'No data' : clock ? formatClock(value) : `${value}${suffix}`}>
          <span aria-hidden="true">{value == null ? '—' : clock ? formatClock(display) : `${display}${suffix}`}</span>
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
