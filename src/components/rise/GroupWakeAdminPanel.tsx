import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Clock, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GroupWakeAlarm } from '@/hooks/useGroupWakeAlarm';

const DAYS = [
  { key: 0, label: 'S' }, { key: 1, label: 'M' }, { key: 2, label: 'T' },
  { key: 3, label: 'W' }, { key: 4, label: 'T' }, { key: 5, label: 'F' }, { key: 6, label: 'S' },
];

const MISSIONS = [
  { value: 'none', label: 'Tap to dismiss' },
  { value: 'math', label: 'Math problem' },
  { value: 'shake', label: 'Shake phone' },
  { value: 'photo', label: 'Photo proof' },
  { value: 'barcode', label: 'Scan barcode' },
];

const MAX_CALL_OPTIONS = [1, 2, 3, 5];

interface SaveInput {
  wake_time: string;
  days_of_week: number[];
  mission_type: string;
  follow_up_minutes?: number;
  max_wake_calls?: number;
  roll_call_minutes_after?: number;
}

interface Props {
  alarm: (GroupWakeAlarm & {
    follow_up_minutes?: number;
    max_wake_calls?: number;
    roll_call_minutes_after?: number;
  }) | null;
  onSave: (input: SaveInput) => Promise<void> | void;
  onDisable?: () => Promise<void> | void;
}

export function GroupWakeAdminPanel({ alarm, onSave, onDisable }: Props) {
  const [time, setTime] = useState('05:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [mission, setMission] = useState('math');
  const [active, setActive] = useState(true);
  const [followUp, setFollowUp] = useState<number>(15);
  const [maxCalls, setMaxCalls] = useState<number>(2);
  const [rollCall, setRollCall] = useState<number>(60);

  useEffect(() => {
    if (alarm) {
      setTime(alarm.wake_time.slice(0, 5));
      setDays(alarm.days_of_week);
      setMission(alarm.mission_type);
      setActive(alarm.is_active);
      if (alarm.follow_up_minutes) setFollowUp(alarm.follow_up_minutes);
      if (alarm.max_wake_calls) setMaxCalls(alarm.max_wake_calls);
      if (alarm.roll_call_minutes_after) setRollCall(alarm.roll_call_minutes_after);
    }
  }, [alarm?.id]);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Group Wake Alarm
        </CardTitle>
        <CardDescription>Fires on every member's phone at the same time. Mission required to dismiss.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Wake time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="text-2xl font-bold tabular-nums h-14" />
        </div>

        <div className="space-y-2">
          <Label>Days</Label>
          <div className="flex justify-between gap-1">
            {DAYS.map((d) => (
              <button key={d.key} onClick={() => toggleDay(d.key)}
                className={cn('flex-1 h-11 rounded-xl text-sm font-bold transition-all',
                  days.includes(d.key) ? 'bg-primary text-primary-foreground shadow' : 'bg-muted text-muted-foreground')}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mission to dismiss</Label>
          <div className="flex flex-wrap gap-2">
            {MISSIONS.map((m) => (
              <Badge key={m.value} variant={mission === m.value ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1.5" onClick={() => setMission(m.value)}>
                {m.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Follow-up alarm</Label>
            <span className="text-sm font-bold tabular-nums">{followUp} min</span>
          </div>
          <Slider min={5} max={30} step={5} value={[followUp]} onValueChange={(v) => setFollowUp(v[0])} />
          <p className="text-xs text-muted-foreground">Members who haven't completed the mission get a second alarm after this delay.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Max wake calls per member / morning</Label>
          <div className="flex gap-2">
            {MAX_CALL_OPTIONS.map((n) => (
              <Badge key={n} variant={maxCalls === n ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-2 text-sm" onClick={() => setMaxCalls(n)}>
                {n}×
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Trusted wakers bypass this cap (60s gap between calls).</p>
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Roll-call window</Label>
            <span className="text-sm font-bold tabular-nums">+{rollCall} min</span>
          </div>
          <Slider min={30} max={180} step={15} value={[rollCall]} onValueChange={(v) => setRollCall(v[0])} />
          <p className="text-xs text-muted-foreground">Final attendance summary posts to chat this long after wake time.</p>
        </div>

        {alarm && (
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="font-semibold text-sm">Active</p>
              <p className="text-xs text-muted-foreground">Disable to stop firing on all members.</p>
            </div>
            <Switch checked={active} onCheckedChange={async (v) => { setActive(v); if (!v && onDisable) await onDisable(); }} />
          </div>
        )}

        <Button className="w-full h-12" onClick={() => onSave({
            wake_time: `${time}:00`, days_of_week: days, mission_type: mission,
            follow_up_minutes: followUp, max_wake_calls: maxCalls, roll_call_minutes_after: rollCall,
          })} disabled={days.length === 0}>
          <Save className="h-4 w-4 mr-2" />
          {alarm ? 'Update group alarm' : 'Create group alarm'}
        </Button>
      </CardContent>
    </Card>
  );
}
