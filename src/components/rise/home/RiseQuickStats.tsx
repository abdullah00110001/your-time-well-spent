/**
 * RiseQuickStats — three compact, glanceable tiles under the hero.
 * Token-only styling, no gradients, no custom fonts.
 */
import { Flame, Trophy, Target } from 'lucide-react';

interface RiseQuickStatsProps {
  currentStreak: number;
  longestStreak: number;
  onTimeWakes: number;
  totalAlarms: number;
}

export function RiseQuickStats({
  currentStreak,
  longestStreak,
  onTimeWakes,
  totalAlarms,
}: RiseQuickStatsProps) {
  const rate = totalAlarms > 0 ? Math.round((onTimeWakes / totalAlarms) * 100) : 0;

  const tiles = [
    { icon: Flame, value: `${currentStreak}d`, label: 'Streak' },
    { icon: Trophy, value: `${longestStreak}d`, label: 'Best' },
    { icon: Target, value: `${rate}%`, label: 'On time' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map(({ icon: Icon, value, label }) => (
        <div
          key={label}
          className="rounded-2xl border border-border bg-card px-3 py-3 text-center"
        >
          <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
          <p className="text-base font-bold tabular-nums text-foreground leading-none">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

export default RiseQuickStats;
