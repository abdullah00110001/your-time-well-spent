import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BellRing, Sunrise, ShieldCheck, Flame, Trophy, Megaphone, Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { LifeosGroupType, MemberStats, useGroupLeaderboard } from '@/hooks/useLifeosGroups';
import { useWakeBroadcast, useCanLeaderWake, useTrustedWakers } from '@/hooks/useWakeBroadcast';

interface Props {
  groupId: string;
  type: LifeosGroupType;
  isLeader: boolean;
}

const rankAccent = (rank: number) =>
  rank === 0 ? 'border-amber-400/60 bg-amber-50/40 dark:bg-amber-500/5'
  : rank === 1 ? 'border-slate-300/60 bg-slate-50/30 dark:bg-slate-500/5'
  : rank === 2 ? 'border-orange-400/40 bg-orange-50/30 dark:bg-orange-500/5'
  : 'border-border bg-card';

export function GroupMembersTab({ groupId, type, isLeader }: Props) {
  const { user } = useAuth();
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const { data: leaderboard, isLoading } = useGroupLeaderboard(groupId, type);
  const broadcast = useWakeBroadcast();
  const { data: canLeader } = useCanLeaderWake(groupId);
  const trusted = useTrustedWakers(groupId, user?.id);

  const sendLeaderWake = () => {
    broadcast.mutate({ group_id: groupId, kind: 'leader', message: 'Time to rise — your group is waiting.' });
  };

  const sendMemberWake = (target: MemberStats) => {
    broadcast.mutate({ group_id: groupId, kind: 'member', target_user_id: target.user_id });
  };

  return (
    <div className="space-y-4">
      {/* Leader broadcast */}
      {isLeader && type === 'rise' && (
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-amber-500/20 grid place-items-center shrink-0">
              <Megaphone className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Wake the whole group</p>
              <p className="text-xs text-muted-foreground">
                {canLeader ? 'Triggers an alarm on every member\'s phone' : 'Daily limit reached — try again tomorrow'}
              </p>
            </div>
            <Button size="sm" onClick={sendLeaderWake} disabled={!canLeader || broadcast.isPending}>
              <BellRing className="h-4 w-4 mr-1.5" /> Wake all
            </Button>
          </div>
        </Card>
      )}

      {/* Range tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> Leaderboard
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="today" className="text-xs h-7 px-3">Today</TabsTrigger>
            <TabsTrigger value="week" className="text-xs h-7 px-3">Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs h-7 px-3">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Member grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (leaderboard?.length ?? 0) === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No members yet.</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {leaderboard!.map((m, idx) => {
            const initials = (m.display_name || 'M').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
            const isMe = m.user_id === user?.id;
            const isTrusted = trusted.data?.has(m.user_id);
            return (
              <div key={m.user_id}
                className={cn('relative rounded-2xl border p-3.5 transition-all hover:shadow-md', rankAccent(idx))}>
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12 ring-2 ring-background">
                      <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {idx === 0 && <Crown className="absolute -top-1.5 -right-1.5 h-4 w-4 text-amber-500 fill-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{isMe ? 'You' : m.display_name}</p>
                      <span className="text-[10px] font-bold text-muted-foreground tabular-nums">#{idx + 1}</span>
                    </div>
                    {type === 'rise' ? (
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium tabular-nums">
                          <Sunrise className="h-3 w-3 text-amber-500" />
                          {m.wake_time ? m.wake_time.slice(0, 5) : '—'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Flame className="h-3 w-3 text-rose-500" /> {m.streak_days ?? 0}d
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-col text-xs">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <ShieldCheck className="h-3 w-3 text-emerald-500" />
                          {Math.floor((m.focus_minutes ?? 0) / 60)}h {(m.focus_minutes ?? 0) % 60}m total
                        </span>
                        <span className="text-muted-foreground truncate">{m.top_app ?? '—'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {!isMe && (
                  <div className="mt-3 flex items-center gap-2">
                    {type === 'rise' && (
                      <Button
                        size="sm" variant="outline"
                        className="h-8 flex-1 text-xs"
                        onClick={() => sendMemberWake(m)}
                        disabled={broadcast.isPending}>
                        <BellRing className="h-3.5 w-3.5 mr-1" /> Wake up
                      </Button>
                    )}
                    <Button
                      size="sm" variant={isTrusted ? 'default' : 'ghost'}
                      className="h-8 px-2"
                      title={isTrusted ? 'Revoke unlimited wake' : 'Grant unlimited wake'}
                      onClick={() => trusted.toggle.mutate(m.user_id)}>
                      <Star className={cn('h-3.5 w-3.5', isTrusted && 'fill-current')} />
                    </Button>
                  </div>
                )}
                {isMe && (
                  <Badge variant="outline" className="absolute top-3 right-3 text-[10px]">You</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center px-4">
        ⭐ Mark a member as <span className="font-semibold">Trusted</span> to let them wake you up unlimited times.
        Otherwise members can send you up to 2 wake calls per day.
      </p>
    </div>
  );
}