/**
 * MemberDetailSheet — bottom sheet shown when tapping a member card.
 * Profile + 7-day wake history + streak + total + "Wake them up" button.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, Flame, Sunrise, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UnifiedMember } from './UnifiedGroupDetail';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: UnifiedMember | null;
  isMe: boolean;
  onWakeUp: (member: UnifiedMember) => void;
  wakeLoading?: boolean;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function MemberDetailSheet({ open, onOpenChange, member, isMe, onWakeUp, wakeLoading }: Props) {
  if (!member) return null;

  const name = member.full_name?.trim() || 'Anonymous';
  const initials = (name === 'Anonymous' ? '?' : name).split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const week = member.week_wake_at ?? [null, null, null, null, null, null, null];
  const wokeToday = !!member.woke_at_today;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] overflow-y-auto pb-6">
        <SheetHeader className="text-left">
          <SheetTitle className="sr-only">{name}</SheetTitle>
        </SheetHeader>

        {/* Profile */}
        <div className="flex items-center gap-3 pt-2">
          <Avatar className="h-14 w-14 ring-2 ring-primary/20">
            {member.avatar_url && <AvatarImage src={member.avatar_url} alt={name} />}
            <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate">{isMe ? `${name} (You)` : name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Sunrise className="h-3 w-3 text-amber-500" />
              {wokeToday ? `Woke up at ${fmtTime(member.woke_at_today)}` : 'Not risen yet'}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-xl bg-muted/50 border border-border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-rose-500" /> Current streak
            </div>
            <p className="text-xl font-bold mt-1 tabular-nums">{member.streak_days ?? 0}<span className="text-xs font-normal text-muted-foreground ml-1">days</span></p>
          </div>
          <div className="rounded-xl bg-muted/50 border border-border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Wake-ups (30d)
            </div>
            <p className="text-xl font-bold mt-1 tabular-nums">{member.total_wakes_30d ?? 0}</p>
          </div>
        </div>

        {/* 7-day history */}
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">7-day history</p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const wakeAt = week[i];
              const got = !!wakeAt;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'h-12 w-full rounded-lg border flex flex-col items-center justify-center',
                      got
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-muted/40 border-border text-muted-foreground',
                    )}
                  >
                    {got
                      ? <CheckCircle2 className="h-4 w-4" />
                      : <Circle className="h-3.5 w-3.5 opacity-50" />}
                    <span className="text-[9px] font-mono mt-0.5 tabular-nums">
                      {got ? fmtTime(wakeAt).replace(/\s?[AP]M/, '') : '—'}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wake them up */}
        {!isMe && (
          <Button
            className="w-full mt-5 h-11"
            onClick={() => onWakeUp(member)}
            disabled={wakeLoading || wokeToday}
          >
            <Bell className="h-4 w-4 mr-2" />
            {wokeToday ? 'Already woke up today' : 'Wake them up'}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
