import { useState } from 'react';
import { ArrowLeft, Moon, Sunrise, Smartphone, MessageSquare, CalendarDays, Plus, X, PauseCircle, Shield, Ban, BarChart3 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNightToRise } from './useNightToRise';
import { NightToRiseBlocklist } from './NightToRiseBlocklist';
import { NightToRiseInsights } from './NightToRiseInsights';
import { InstalledAppPicker } from './InstalledAppPicker';
import { ScheduleMode, ALWAYS_ALLOWED_IDS } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  riseAlarmTime?: string | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function NightToRisePage({ open, onClose, riseAlarmTime }: Props) {
  const { config, update, status, pauseTonight, canPauseTonight } = useNightToRise(riseAlarmTime);
  const [pickerOpen, setPickerOpen] = useState(false);

  const toggleDay = (d: number) => {
    const set = new Set(config.scheduleDays);
    set.has(d) ? set.delete(d) : set.add(d);
    update({ scheduleDays: Array.from(set).sort() });
  };

  const removeApp = (id: string) =>
    update({ allowedApps: config.allowedApps.filter((a) => a.id !== id) });

  const handlePause = () => {
    const ok = pauseTonight();
    if (ok) toast.success('Paused for tonight');
    else toast.error('You have already used your pause for this week');
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[95vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 px-4 py-4 text-white">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Sleep to Rise</h2>
              <p className="text-xs text-indigo-200/80">Sleep & Wake Protection</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
            />
          </div>
          {status.phase !== 'off' && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
              <span className={cn(
                'h-2 w-2 rounded-full',
                status.phase === 'sleep-lock' || status.phase === 'rise-lock' ? 'bg-emerald-400 animate-pulse' :
                status.phase === 'paused' ? 'bg-amber-400' : 'bg-indigo-300',
              )} />
              {status.label ?? 'Armed'}
            </div>
          )}
        </div>

        <div className="space-y-4 p-4">
          {/* Sleep Guard */}
          <Section icon={<Moon className="h-4 w-4" />} title="Sleep Guard" subtitle="Lock distracting apps before bed">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Target sleep time</Label>
                <Input
                  type="time"
                  value={config.sleepTime}
                  onChange={(e) => update({ sleepTime: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-xs">Lock starts before sleep</Label>
                  <span className="text-xs font-medium text-primary">{config.sleepLockMinutesBefore} min</span>
                </div>
                <Slider
                  min={0} max={120} step={5}
                  value={[config.sleepLockMinutesBefore]}
                  onValueChange={([v]) => update({ sleepLockMinutesBefore: v })}
                />
              </div>
            </div>
          </Section>

          {/* Rise Guard */}
          <Section icon={<Sunrise className="h-4 w-4" />} title="Rise Guard" subtitle="Stay focused after waking up">
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-xs">
                <span className="text-muted-foreground">Alarm time: </span>
                <span className="font-medium">{riseAlarmTime ?? 'No alarm set'}</span>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-xs">Lock stays for</Label>
                  <span className="text-xs font-medium text-primary">{config.riseLockMinutesAfter} min</span>
                </div>
                <Slider
                  min={5} max={120} step={5}
                  value={[config.riseLockMinutesAfter]}
                  onValueChange={([v]) => update({ riseLockMinutesAfter: v })}
                />
              </div>
            </div>
          </Section>

          {/* Allowed Apps */}
          <Section icon={<Smartphone className="h-4 w-4" />} title="Allowed Apps" subtitle="These work during locked windows">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {config.allowedApps.map((a) => (
                  <div key={a.id} className="group inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                    {a.name}
                    <button onClick={() => removeApp(a.id)} className="opacity-60 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Choose allowed apps
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Phone, Clock and Emergency are always allowed.
              </p>
              <InstalledAppPicker
                open={pickerOpen}
                title="Allowed apps"
                selected={config.allowedApps.map((a) => a.id)}
                lockedIds={ALWAYS_ALLOWED_IDS}
                onClose={() => setPickerOpen(false)}
                onSave={(apps) => { update({ allowedApps: apps }); setPickerOpen(false); }}
              />
            </div>
          </Section>

          {/* Blocklist — PHASE 2 */}
          <Section icon={<Ban className="h-4 w-4" />} title="Blocklist" subtitle="Apps, sites & keywords locked during windows">
            <NightToRiseBlocklist config={config} update={update} />
          </Section>

          {/* Block Screen */}
          <Section icon={<MessageSquare className="h-4 w-4" />} title="Block Screen" subtitle="Customize the lock messages">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Sleep window message</Label>
                <Textarea
                  value={config.sleepBlockMessage}
                  onChange={(e) => update({ sleepBlockMessage: e.target.value })}
                  rows={2}
                  className="mt-1 resize-none"
                />
              </div>
              <div>
                <Label className="text-xs">Rise window message</Label>
                <Textarea
                  value={config.riseBlockMessage}
                  onChange={(e) => update({ riseBlockMessage: e.target.value })}
                  rows={2}
                  className="mt-1 resize-none"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <div>
                  <p className="text-sm font-medium">Show streak on block screen</p>
                  <p className="text-xs text-muted-foreground">"7 mornings protected in a row 🔥"</p>
                </div>
                <Switch
                  checked={config.showStreakOnBlock}
                  onCheckedChange={(v) => update({ showStreakOnBlock: v })}
                />
              </div>
            </div>
          </Section>

          {/* Schedule */}
          <Section icon={<CalendarDays className="h-4 w-4" />} title="Schedule" subtitle="When Sleep to Rise runs">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(['everyday', 'weekdays', 'custom'] as ScheduleMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => update({ scheduleMode: m })}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-colors',
                      config.scheduleMode === m
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >{m}</button>
                ))}
              </div>
              {config.scheduleMode === 'custom' && (
                <div className="flex gap-1">
                  {DAYS.map((d, i) => (
                    <button
                      key={d}
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
              )}
              <Button
                variant="outline"
                className="w-full"
                disabled={!canPauseTonight}
                onClick={handlePause}
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                {canPauseTonight ? 'Pause for one night' : 'Weekly pause already used'}
              </Button>
              {!canPauseTonight && (
                <p className="text-center text-[11px] text-muted-foreground">
                  You can pause Sleep to Rise once per week. It resets next Monday.
                </p>
              )}
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">Strict mode</p>
                    <p className="text-xs text-muted-foreground">No PIN override allowed</p>
                  </div>
                </div>
                <Switch
                  checked={config.strictMode}
                  onCheckedChange={(v) => update({ strictMode: v })}
                />
              </div>
            </div>
          </Section>

          {/* Insights & Recap — PHASE 3 */}
          <Section icon={<BarChart3 className="h-4 w-4" />} title="Insights & Recap" subtitle="Streaks, weekly recap and group sharing">
            <NightToRiseInsights config={config} update={update} />
          </Section>

          <div className="h-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
