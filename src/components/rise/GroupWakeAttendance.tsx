import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AttendanceDayRecord {
  date: string;
  wake_seconds: number;
  checked: boolean;
}

export interface AttendanceMember {
  user_id: string;
  full_name: string | null;
  rank: number;
  total_seconds: number;
  days: AttendanceDayRecord[];
  is_me?: boolean;
}

interface Props {
  weekLabel: string;
  goalLabel: string;
  totalAttendance: number;
  averageAttendancePct: number;
  myRank: number | null;
  members: AttendanceMember[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  activeTab?: 'wake_time' | 'goal';
}

function fmtHMS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function DayTile({ record, dayLabel }: { record?: AttendanceDayRecord; dayLabel: string }) {
  if (!record) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-xs text-muted-foreground/60 shrink-0">
        {dayLabel}
      </div>
    );
  }
  const h = Math.floor(record.wake_seconds / 3600);
  const m = Math.floor((record.wake_seconds % 3600) / 60);
  const label = record.wake_seconds === 0 ? '' : h > 0 ? `${h}:${String(m).padStart(2,'0')}` : `0:${String(m).padStart(2,'0')}`;

  return (
    <div
      className={cn(
        'flex h-8 min-w-[2rem] items-center justify-center rounded-md px-1.5 text-xs font-mono font-semibold shrink-0 transition-all',
        record.wake_seconds > 0 && record.checked
          ? 'bg-primary/15 text-primary border border-primary/40'
          : record.wake_seconds > 0
          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
          : 'border border-border text-muted-foreground/60',
      )}
    >
      {label || dayLabel}
    </div>
  );
}

function MemberRow({ m }: { m: AttendanceMember }) {
  const initials = (m.full_name || '?').slice(0, 2).toUpperCase();

  return (
    <div className={cn(
      'flex flex-col gap-2 rounded-xl border p-3 transition-all',
      m.is_me ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
    )}>
      <div className="flex items-center gap-2">
        <span className="w-5 text-center text-xs font-bold text-muted-foreground">{m.rank}</span>
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className={cn('flex-1 truncate text-sm font-semibold', m.is_me ? 'text-primary' : 'text-foreground')}>
          {m.is_me ? 'You' : m.full_name || 'Member'}
        </span>
        <span className="font-mono text-sm font-bold text-primary tabular-nums shrink-0">
          {fmtHMS(m.total_seconds)}
        </span>
      </div>

      <div className="flex items-center gap-1 pl-7 overflow-x-auto scrollbar-none">
        {DAY_LABELS.map((label, i) => (
          <DayTile key={i} record={m.days[i]} dayLabel={label} />
        ))}
        <div className="ml-auto flex items-center gap-1 pl-2 shrink-0">
          <span className="text-xs text-muted-foreground">✓</span>
          <span className="text-xs font-semibold text-primary">
            {m.days.filter(d => d.checked).length}
          </span>
        </div>
      </div>
    </div>
  );
}

export function GroupWakeAttendance({
  weekLabel,
  goalLabel,
  totalAttendance,
  averageAttendancePct,
  myRank,
  members,
  onPrevWeek,
  onNextWeek,
  activeTab = 'wake_time',
}: Props) {
  const [tab, setTab] = useState<'wake_time' | 'goal'>(activeTab);

  return (
    <div className="flex flex-col gap-4 bg-background min-h-full p-4">
      <div className="flex items-center justify-between rounded-xl bg-card border border-border px-4 py-2.5">
        <button onClick={onPrevWeek} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-foreground">{weekLabel}</span>
        <button onClick={onNextWeek} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="ml-3 rounded-lg bg-muted px-3 py-1 text-xs text-muted-foreground">
          Weekly ▾
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('wake_time')}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
            tab === 'wake_time'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          Wake time
        </button>
        <button
          onClick={() => setTab('goal')}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-all border',
            tab === 'goal'
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {goalLabel}
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Total attendance </span>
          <span className="font-bold text-primary">{totalAttendance}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Average </span>
          <span className="font-bold text-primary">{averageAttendancePct}%</span>
        </div>
        {myRank !== null && (
          <div className="ml-auto">
            <span className="text-muted-foreground">My rank </span>
            <span className="font-bold text-primary">#{myRank}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {members.map((m) => (
          <MemberRow key={m.user_id} m={m} />
        ))}
      </div>
    </div>
  );
}
