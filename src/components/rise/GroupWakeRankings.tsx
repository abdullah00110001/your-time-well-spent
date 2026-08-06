import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RankingMember {
  user_id: string;
  full_name: string | null;
  rank: number;
  wake_seconds: number;
  is_active: boolean;
  goal_met: boolean;
  is_me?: boolean;
  region_label?: string;
}

interface Props {
  dateLabel: string;
  periodLabel?: string;
  goalLabel: string;
  totalSeconds: number;
  averageSeconds: number;
  myRank: number | null;
  myGoalMet: boolean;
  members: RankingMember[];
  onPrevDay: () => void;
  onNextDay: () => void;
}

function fmtHMS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function fmtHM(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2,'0')}`;
}

const ActiveBellIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-primary">
    <path d="M16 4a8 8 0 0 1 8 8v4l2 3H6l2-3v-4a8 8 0 0 1 8-8Z" />
    <path d="M13 22a3 3 0 0 0 6 0" />
    <line x1="20" y1="4" x2="24" y2="2" />
    <line x1="24" y1="2" x2="24" y2="6" />
  </svg>
);
const SleepingIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-muted-foreground/60">
    <circle cx="16" cy="16" r="10" />
    <line x1="16" y1="10" x2="16" y2="16" />
    <line x1="16" y1="16" x2="21" y2="20" />
  </svg>
);
const GoalMetIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-emerald-500">
    <circle cx="16" cy="16" r="10" />
    <polyline points="11,16 14,20 21,12" />
  </svg>
);

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white font-black text-lg shadow-lg shadow-amber-900/40">1</div>;
  if (rank === 2) return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground font-black text-lg">2</div>;
  if (rank === 3) return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-900/40 text-amber-700 dark:text-amber-300 font-black text-lg">3</div>;
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary text-primary font-bold text-base">{rank}</div>;
}

function RankRow({ m, maxSec }: { m: RankingMember; maxSec: number }) {
  const pct = maxSec > 0 ? Math.max(4, Math.round((m.wake_seconds / maxSec) * 100)) : 4;
  const StatusIcon = m.goal_met ? GoalMetIcon : m.is_active ? ActiveBellIcon : SleepingIcon;

  return (
    <div className={cn(
      'flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 transition-all',
      m.is_me ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
    )}>
      <div className="flex items-center gap-3">
        <RankBadge rank={m.rank} />
        <div className="flex-1 min-w-0">
          {m.region_label && <p className="text-[10px] text-primary leading-none mb-0.5">{m.region_label}</p>}
          <p className={cn('truncate text-sm font-semibold', m.is_me ? 'text-primary' : 'text-foreground')}>
            {m.is_me ? 'You' : m.full_name || 'Member'}
          </p>
        </div>
        <span className="font-mono text-sm font-bold text-primary tabular-nums shrink-0">{fmtHMS(m.wake_seconds)}</span>
        <div className="shrink-0"><StatusIcon /></div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden ml-[52px]">
        <div
          className={cn('h-full rounded-full transition-all duration-700',
            m.goal_met ? 'bg-emerald-500' : m.is_active ? 'bg-primary' : 'bg-muted-foreground/40')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function GroupWakeRankings({
  dateLabel, periodLabel = 'Daily', goalLabel,
  totalSeconds, averageSeconds, myRank, myGoalMet, members,
  onPrevDay, onNextDay,
}: Props) {
  const [tab, setTab] = useState<'wake_time' | 'goal'>('wake_time');
  const maxSec = members.reduce((a, m) => Math.max(a, m.wake_seconds), 0);

  return (
    <div className="flex flex-col gap-4 bg-background min-h-full p-4">
      <div className="flex items-center justify-between rounded-xl bg-card border border-border px-4 py-2.5">
        <button onClick={onPrevDay} className="text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-sm font-semibold text-foreground">{dateLabel}</span>
        <button onClick={onNextDay} className="text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="h-5 w-5" /></button>
        <div className="ml-3 rounded-lg bg-muted px-3 py-1 text-xs text-muted-foreground">{periodLabel} ▾</div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('wake_time')}
          className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition-all',
            tab === 'wake_time' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
          Wake time
        </button>
        <button onClick={() => setTab('goal')}
          className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition-all border',
            tab === 'goal' ? 'bg-primary text-primary-foreground border-transparent' : 'border-border text-muted-foreground hover:text-foreground')}>
          {goalLabel}
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div><span className="text-muted-foreground">Total time </span><span className="font-bold text-primary">{fmtHMS(totalSeconds)}</span></div>
        <div><span className="text-muted-foreground">Average </span><span className="font-bold text-primary">{fmtHM(averageSeconds)}</span></div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{myRank !== null ? `My rank #${myRank}` : 'My rank -'}</span>
          <div className={cn('flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold',
            myGoalMet ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border text-muted-foreground')}>✓</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {members.map((m) => <RankRow key={m.user_id} m={m} maxSec={maxSec} />)}
      </div>
    </div>
  );
}
