import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Activity, Send, TrendingUp, Sunrise, ShieldCheck } from 'lucide-react';
import { LifeosGroupType, MemberStats, useMemberWeekStats, useSendNudge } from '@/hooks/useLifeosGroups';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: MemberStats | null;
  groupId: string;
  type: LifeosGroupType;
}

export function MemberStatsModal({ open, onOpenChange, member, groupId, type }: Props) {
  const { data, isLoading } = useMemberWeekStats(member?.user_id, type);
  const sendNudge = useSendNudge();

  if (!member) return null;

  const initials = (member.display_name || 'M').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

  // Build 7-day heatmap for rise
  const heatmap = (() => {
    const days: { date: string; status: 'on_time' | 'missed' | 'future' | 'none' }[] = [];
    const today = new Date();
    const logs: any[] = (data as any)?.wake_logs ?? [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const log = logs.find((l: any) => l.log_date === ds);
      let status: 'on_time' | 'missed' | 'future' | 'none' = 'none';
      if (log) status = log.on_time ? 'on_time' : 'missed';
      days.push({ date: ds, status });
    }
    return days;
  })();

  const onTimeCount = heatmap.filter(d => d.status === 'on_time').length;

  const focusToday = type === 'shield'
    ? ((data as any)?.focus_sessions ?? []).find((s: any) => s.session_date === new Date().toISOString().slice(0, 10))
    : null;
  const weekFocusAvg = type === 'shield'
    ? Math.round((((data as any)?.focus_sessions ?? []).reduce((sum: number, s: any) => sum + (s.focus_minutes ?? 0), 0)) / 7) / 60
    : 0;

  const focusMin = focusToday?.focus_minutes ?? member.focus_minutes ?? 0;
  const distractMin = focusToday?.distracting_minutes ?? member.distracting_minutes ?? 0;
  const totalMin = Math.max(focusMin + distractMin, 1);
  const focusPct = (focusMin / totalMin) * 100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base truncate">{member.display_name}</SheetTitle>
              <span className={cn(
                "inline-flex items-center gap-1.5 mt-1 text-xs px-2 py-0.5 rounded-full font-semibold",
                member.status === 'focus' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", member.status === 'focus' ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                {type === 'shield' && focusMin > 0 ? `Deep Work ${Math.floor(focusMin / 60)}h ${focusMin % 60}m` : 'Offline'}
              </span>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {type === 'rise' && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">Wake Consistency · Last 7 Days</h3>
              </div>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="flex gap-1.5">
                  {heatmap.map((d, i) => (
                    <div key={i} className={cn(
                      "flex-1 aspect-square rounded-md",
                      d.status === 'on_time' && "bg-emerald-500",
                      d.status === 'missed' && "bg-destructive",
                      d.status === 'none' && "bg-muted",
                    )} title={d.date} />
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                {onTimeCount}/7 On Time · {member.streak_days ?? 0} Day Streak
              </p>
            </section>
          )}

          {type === 'shield' && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">Today's Focus Breakdown</h3>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${focusPct}%` }} />
                <div className="bg-destructive h-full" style={{ width: `${100 - focusPct}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-emerald-600 font-semibold">Focus {Math.floor(focusMin / 60)}h {focusMin % 60}m</span>
                <span className="text-destructive font-semibold">Distract {Math.floor(distractMin / 60)}h {distractMin % 60}m</span>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-muted/40 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <p className="text-xs"><span className="font-bold">Avg: {weekFocusAvg.toFixed(1)}h/day</span> last 7 days</p>
              </div>
            </section>
          )}

          {member.behind_target && (
            <Button
              className="w-full"
              onClick={() => sendNudge.mutate({ group_id: groupId, recipient_id: member.user_id })}
              disabled={sendNudge.isPending}
            >
              <Send className="h-4 w-4 mr-2" /> Send Motivation Nudge
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}