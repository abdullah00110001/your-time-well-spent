import { Moon, ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNightToRise } from './useNightToRise';
import { useNextRiseAlarm } from './nextRiseAlarm';

interface Props {
  onOpen: () => void;
  /** @deprecated the nearest upcoming alarm is resolved internally now. */
  riseAlarmTime?: string | null;
}

function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

export function NightToRiseCard({ onOpen }: Props) {
  const riseAlarm = useNextRiseAlarm();
  const { config, status } = useNightToRise(riseAlarm);

  const isLocked = status.phase === 'sleep-lock' || status.phase === 'rise-lock';

  return (
    <button
      onClick={onOpen}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl text-left',
        'border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40',
      )}
    >
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <Moon className="h-5 w-5 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">Sleep to Rise</h3>
              <p className="text-xs text-muted-foreground">Sleep &amp; Wake Protection</p>
            </div>
            <StatusPill phase={status.phase} configured={config.configured} enabled={config.enabled} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {!config.configured
                ? 'Tap to set up'
                : isLocked
                  ? <span className="inline-flex items-center gap-1 font-medium text-primary"><Lock className="h-3 w-3" /> Lock active now</span>
                  : `Sleep ${fmt12(config.sleepTime)} · Rise +${config.riseLockMinutesAfter}m`}
            </p>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

function StatusPill({ phase, configured, enabled }: { phase: string; configured: boolean; enabled: boolean }) {
  const base = 'rounded-full px-2 py-0.5 text-[10px] font-semibold';
  if (!configured) {
    return <span className={cn(base, 'bg-primary/10 text-primary')}>Set up</span>;
  }
  if (!enabled) {
    return <span className={cn(base, 'bg-muted text-muted-foreground')}>Off</span>;
  }
  if (phase === 'sleep-lock' || phase === 'rise-lock') {
    return <span className={cn(base, 'bg-primary/10 text-primary ring-1 ring-primary/30')}>Locked</span>;
  }
  if (phase === 'paused') {
    return <span className={cn(base, 'bg-warning/15 text-warning')}>Paused</span>;
  }
  return <span className={cn(base, 'bg-primary/10 text-primary ring-1 ring-primary/30')}>Active</span>;
}
