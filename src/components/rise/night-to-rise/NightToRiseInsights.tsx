/**
 * PHASE 3 — Weekly recap + analytics for Sleep to Rise, plus the group
 * sharing toggle that pushes the nightly result to the user's Rise group.
 */
import { Flame, Trophy, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useNightToRiseStreak } from './useNightToRiseStreak';
import { NightToRiseConfig, getIsoWeekKey } from './types';

interface Props {
  config: NightToRiseConfig;
  update: (patch: Partial<NightToRiseConfig>) => void;
}

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function NightToRiseInsights({ config, update }: Props) {
  const {
    streak, longestStreak, protectedNights, brokenNights,
    last7, last30, weekProtected, weekBroken,
  } = useNightToRiseStreak();

  const weekKey = getIsoWeekKey(new Date());
  const pausesThisWeek = config.pauseHistory.filter((d) => getIsoWeekKey(new Date(d)) === weekKey).length;

  const tracked = protectedNights + brokenNights;
  const successRate = tracked ? Math.round((protectedNights / tracked) * 100) : 0;

  const recapMessage =
    weekProtected >= 6 ? 'Outstanding week — your mornings were almost untouched. 🌅'
    : weekProtected >= 4 ? 'Solid week. A couple more clean nights and the streak locks in.'
    : weekProtected > 0 ? 'A gentle restart is all it takes. Aim for two clean nights next.'
    : 'No data yet this week — enable Sleep to Rise tonight to start tracking.';

  return (
    <div className="space-y-5">
      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${streak}`} suffix="nights" tone="amber" />
        <Stat icon={<Trophy className="h-4 w-4" />} label="Longest streak" value={`${longestStreak}`} suffix="nights" tone="violet" />
        <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Protected" value={`${protectedNights}`} suffix="nights" tone="emerald" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Success rate" value={`${successRate}%`} suffix={`${tracked} tracked`} tone="sky" />
      </div>

      {/* Weekly recap */}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">This week</p>
          <span className="text-[11px] text-muted-foreground">
            {weekProtected} protected · {weekBroken} broken · {pausesThisWeek} paused
          </span>
        </div>
        <div className="flex gap-1.5">
          {last7.map((d) => {
            const dow = new Date(d.date).getDay();
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'h-8 w-full rounded-md',
                    d.state === 'clean' ? 'bg-emerald-500/70'
                      : d.state === 'broken' ? 'bg-destructive/60'
                      : 'bg-muted',
                  )}
                  title={`${d.date}: ${d.state}`}
                />
                <span className="text-[10px] text-muted-foreground">{DAY_INITIALS[dow]}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{recapMessage}</p>
      </div>

      {/* 30-day heat strip */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Last 30 nights</p>
        <div className="flex flex-wrap gap-1">
          {last30.map((d) => (
            <span
              key={d.date}
              title={`${d.date}: ${d.state}`}
              className={cn(
                'h-3.5 w-3.5 rounded-sm',
                d.state === 'clean' ? 'bg-emerald-500/70'
                  : d.state === 'broken' ? 'bg-destructive/60'
                  : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* Group integration */}
      <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Share with my Rise group</p>
            <p className="text-xs text-muted-foreground">Post your protected nights to the group feed</p>
          </div>
        </div>
        <Switch
          checked={config.shareWithGroup}
          onCheckedChange={(v) => update({ shareWithGroup: v })}
        />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, suffix, tone }: {
  icon: React.ReactNode; label: string; value: string; suffix: string;
  tone: 'amber' | 'violet' | 'emerald' | 'sky';
}) {
  const tones: Record<string, string> = {
    amber: 'text-amber-500 bg-amber-500/10',
    violet: 'text-violet-500 bg-violet-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    sky: 'text-sky-500 bg-sky-500/10',
  };
  return (
    <div className="rounded-lg border border-border p-3">
      <div className={cn('mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md', tones[tone])}>
        {icon}
      </div>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label} · {suffix}</p>
    </div>
  );
}