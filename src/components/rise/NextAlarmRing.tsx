import { Sunrise } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NextAlarmRingProps {
  /** "HH:mm" 24h time of the next alarm, or null when none. */
  time: string | null;
  /** Countdown label, e.g. "Ring in 7 hr. 12 min" */
  countdown?: string | null;
  /** 0..1 — how much of the night has passed toward the alarm */
  progress: number;
  intention?: string | null;
  missionLabel?: string | null;
}

const SIZE = 220;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function NextAlarmRing({
  time,
  countdown,
  progress,
  intention,
  missionLabel,
}: NextAlarmRingProps) {
  const pct = Math.max(0, Math.min(1, progress || 0));

  let display = '--:--';
  let ampm = '';
  if (time) {
    const [h, m] = time.split(':');
    const hh = parseInt(h, 10);
    display = `${hh > 12 ? hh - 12 : hh === 0 ? 12 : hh}:${m}`;
    ampm = hh >= 12 ? 'PM' : 'AM';
  }

  return (
    <div className="flex flex-col items-center text-center py-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-muted"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            className="stroke-primary transition-[stroke-dashoffset] duration-700"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Sunrise className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-widest font-semibold">
              {time ? 'Next Alarm' : 'No alarm'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-black tabular-nums tracking-tight text-foreground">
              {display}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">{ampm}</span>
          </div>
          {countdown && (
            <p className="mt-1 text-xs text-muted-foreground">{countdown}</p>
          )}
        </div>
      </div>

      {intention && (
        <p className="mt-4 px-6 text-lg italic font-medium text-foreground/90 leading-snug">
          “{intention}”
        </p>
      )}

      {missionLabel && (
        <Badge variant="secondary" className="mt-3 text-[11px]">
          {missionLabel}
        </Badge>
      )}
    </div>
  );
}

export default NextAlarmRing;
