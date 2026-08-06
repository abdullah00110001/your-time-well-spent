import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { deriveAgedStatus, type GroupWakeMemberStatus, type WakeMemberStatusKind } from '@/hooks/useGroupWakeAlarm';

interface MemberLite {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
  woke_at_today?: string | null;
}

interface Props {
  members: MemberLite[];
  statuses: GroupWakeMemberStatus[];
  currentUserId: string;
  onSendWakeUp: (member: MemberLite) => void;
  onCardClick?: (member: MemberLite) => void;
}

const STATUS_META: Record<WakeMemberStatusKind, { label: string; cardBorder: string; accent: string }> = {
  pending:      { label: 'Sleeping',  cardBorder: 'border-border',           accent: 'text-muted-foreground' },
  active:       { label: 'Awake',     cardBorder: 'border-primary/40',       accent: 'text-primary' },
  mission_done: { label: 'Risen ✓',   cardBorder: 'border-emerald-500/40',   accent: 'text-emerald-500' },
  sleeping:     { label: 'Slept in!', cardBorder: 'border-destructive/40',   accent: 'text-destructive' },
  silent:       { label: 'No update', cardBorder: 'border-amber-500/40',     accent: 'text-amber-600 dark:text-amber-400' },
};

function fmtWakeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function GroupWakeMemberGrid({ members, statuses, currentUserId, onSendWakeUp, onCardClick }: Props) {
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-2 p-1">
      {members.map((m) => {
        const s = statuses.find((x) => x.user_id === m.user_id);
        const kind: WakeMemberStatusKind = s ? deriveAgedStatus(s, Date.now()) : 'pending';
        const meta = STATUS_META[kind];
        const isMe = m.user_id === currentUserId;
        const canWake = !isMe && (kind === 'pending' || kind === 'sleeping' || kind === 'silent');
        const displayName = isMe ? 'You' : (m.full_name?.trim() || 'Member');
        const initials = (m.full_name?.trim() || '?').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
        const wokeTime = m.woke_at_today ? fmtWakeTime(m.woke_at_today) : null;

        return (
          <button
            key={m.user_id}
            type="button"
            onClick={() => onCardClick?.(m)}
            className={cn(
              'relative flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-2 pt-3 text-center transition-all min-h-[140px] active:scale-[0.97] hover:border-primary/50 hover:shadow-sm text-left',
              meta.cardBorder,
            )}
          >
            <Avatar className="h-10 w-10 ring-2 ring-background">
              {m.avatar_url && <AvatarImage src={m.avatar_url} alt={displayName} />}
              <AvatarFallback className={cn('text-[11px] font-bold bg-muted', meta.accent)}>
                {initials}
              </AvatarFallback>
            </Avatar>

            <p className="text-[11px] font-semibold text-foreground leading-tight truncate w-full">
              {displayName}
            </p>

            <div className={cn('text-[10px] font-mono leading-tight tabular-nums', meta.accent)}>
              {wokeTime ? wokeTime : <span className="text-muted-foreground">Not risen yet</span>}
            </div>

            <div className="mt-auto w-full pt-1" onClick={(e) => e.stopPropagation()}>
              {canWake ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-full px-1 text-[10px] border border-border text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); onSendWakeUp(m); }}
                >
                  Wake up
                </Button>
              ) : (
                <div className="h-6 grid place-items-center text-[9px] uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
