/**
 * RiseHomeHero — the single "what happens next" surface of the Rise home tab.
 *
 * Usability first: the three things a user actually opens Rise for are
 *   1. when does my next alarm ring
 *   2. how much sleep do I get if I sleep now
 *   3. add / start something in one tap
 * so all three live in one calm card instead of being scattered down the page.
 *
 * Uses only semantic design tokens + the app's default type scale.
 */
import { Sunrise, Moon, Plus, ShieldCheck, BedDouble } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NextAlarmRing } from '@/components/rise/NextAlarmRing';

interface RiseHomeHeroProps {
  time: string | null;
  countdown: string | null;
  progress: number;
  intention?: string | null;
  missionLabel?: string | null;
  enabledCount: number;
  onCreate: () => void;
  onCommit: () => void;
  onOpenSleepGuard?: () => void;
}

function greeting(d: Date): { label: string; icon: typeof Sunrise } {
  const h = d.getHours();
  if (h < 5) return { label: 'Still awake', icon: Moon };
  if (h < 12) return { label: 'Good morning', icon: Sunrise };
  if (h < 17) return { label: 'Good afternoon', icon: Sunrise };
  if (h < 22) return { label: 'Good evening', icon: Moon };
  return { label: 'Time to wind down', icon: Moon };
}

/** Minutes of sleep left if the user falls asleep now (15 min to drift off). */
function sleepIfNow(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const mins = Math.floor((target.getTime() - now.getTime()) / 60000) - 15;
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function RiseHomeHero({
  time,
  countdown,
  progress,
  intention,
  missionLabel,
  enabledCount,
  onCreate,
  onCommit,
  onOpenSleepGuard,
}: RiseHomeHeroProps) {
  const { label, icon: GreetIcon } = greeting(new Date());
  const sleep = sleepIfNow(time);

  return (
    <section className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="flex items-center gap-2 min-w-0">
          <GreetIcon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">{label}</span>
        </div>
        <Badge variant="secondary" className="text-[11px] shrink-0">
          {enabledCount} active
        </Badge>
      </div>

      <NextAlarmRing
        time={time}
        countdown={countdown}
        progress={progress}
        intention={intention}
        missionLabel={missionLabel}
      />

      {sleep && (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2.5">
          <BedDouble className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            Sleep now and you get{' '}
            <span className="font-semibold text-foreground tabular-nums">{sleep}</span> of rest
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <Button onClick={onCommit} className="h-11 rounded-2xl text-sm font-semibold">
          Commit to tomorrow
        </Button>
        <Button
          variant="secondary"
          onClick={onCreate}
          className="h-11 rounded-2xl text-sm font-semibold"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New alarm
        </Button>
        {onOpenSleepGuard && (
          <Button
            variant="outline"
            onClick={onOpenSleepGuard}
            className="col-span-2 h-11 rounded-2xl text-sm font-medium"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5 text-primary" />
            Sleep to Rise guards
          </Button>
        )}
      </div>
    </section>
  );
}

export default RiseHomeHero;
