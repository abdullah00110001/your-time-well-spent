/**
 * SleepCoachNotes — SECTION 4: the Gradual Shift Assistant and the social
 * jetlag warning. Both are advisory, never blocking, never guilt-worded.
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { parseHM, forwardDelta, formatClock, norm } from './timeMath';
import type { NightToRiseConfig } from './types';

interface Props {
  config: NightToRiseConfig;
  update: (patch: Partial<NightToRiseConfig>) => void;
  /** Rolling average actual bedtime (minutes of day) or null when unknown. */
  averageSleepMinutes: number | null;
  disabled?: boolean;
}

/** How much earlier the target is than the current average, in minutes. */
export function shiftGap(targetHM: string, averageMinutes: number | null): number {
  if (averageMinutes == null) return 0;
  // "Earlier" means going backwards around the clock from the average.
  return forwardDelta(parseHM(targetHM), averageMinutes);
}

export function SleepCoachNotes({ config, update, averageSleepMinutes, disabled }: Props) {
  const gap = useMemo(
    () => shiftGap(config.sleepTime, averageSleepMinutes),
    [config.sleepTime, averageSleepMinutes],
  );

  // Only meaningful when the target is genuinely earlier (gap under ~6h).
  const needsShift = gap > 45 && gap < 360;

  const jetlagGap = useMemo(() => {
    if (config.scheduleMode !== 'custom' || !config.weekendSleepTime) return 0;
    const a = parseHM(config.sleepTime);
    const b = parseHM(config.weekendSleepTime);
    return Math.min(forwardDelta(a, b), forwardDelta(b, a));
  }, [config.scheduleMode, config.sleepTime, config.weekendSleepTime]);

  const startShift = () => {
    if (averageSleepMinutes == null) return;
    // First intermediate step: 20 minutes earlier than the current average.
    const first = norm(averageSleepMinutes - 20);
    update({ shiftTargetTime: `${String(Math.floor(first / 60)).padStart(2, '0')}:${String(first % 60).padStart(2, '0')}` });
  };

  if (!needsShift && jetlagGap <= 60 && !config.shiftTargetTime) return null;

  return (
    <div className="space-y-2">
      {config.shiftTargetTime && (
        <Card className="n2r-surface border-border/70">
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Gradual shift in progress</p>
              <p className="text-xs text-muted-foreground">
                Tonight aim for <span className="n2r-mono">{formatClock(parseHM(config.shiftTargetTime))}</span>,
                then move 20 minutes earlier every few days toward{' '}
                <span className="n2r-mono">{formatClock(parseHM(config.sleepTime))}</span>.
              </p>
            </div>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => update({ shiftTargetTime: null })}>
              End
            </Button>
          </CardContent>
        </Card>
      )}

      {needsShift && !config.shiftTargetTime && (
        <Card className="n2r-surface border-border/70">
          <CardContent className="flex items-start gap-3 p-3">
            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 n2r-accent-text" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">That's a big jump</p>
              <p className="text-xs text-muted-foreground">
                Your recent average bedtime is about{' '}
                <span className="n2r-mono">{formatClock(averageSleepMinutes ?? 0)}</span> — roughly{' '}
                {Math.round(gap / 5) * 5} minutes later than your target. Shifting in small steps sticks better.
              </p>
              <Button size="sm" variant="outline" className="mt-2" disabled={disabled} onClick={startShift}>
                Start a gradual shift
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {jetlagGap > 60 && (
        <Card className="n2r-surface border-warning/40">
          <CardContent className="flex items-start gap-3 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              Your weekend target is more than an hour away from your weekday one. Large weekend
              shifts (social jetlag) undo the consistency you build during the week — try keeping
              them within an hour of each other.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SleepCoachNotes;
