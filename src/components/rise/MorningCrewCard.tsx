import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sunrise, Bell, CheckCircle2, Moon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { useWakeBroadcast } from '@/hooks/useWakeBroadcast';
import { cn } from '@/lib/utils';

interface Props {
  groupId: string;
  wakeTime?: string; // HH:mm
}

interface AttendanceRow {
  user_id: string;
  status: 'sleeping' | 'woke' | 'late';
  woke_at: string | null;
  full_name?: string | null;
}

export function MorningCrewCard({ groupId, wakeTime }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const wake = useWakeBroadcast();

  const load = useCallback(async () => {
    const { data: att } = await supabase
      .from('group_wake_attendance')
      .select('user_id, status, woke_at')
      .eq('group_id', groupId)
      .eq('alarm_date', today);
    const ids = (att ?? []).map((a: any) => a.user_id);
    if (ids.length === 0) { setRows([]); return; }
    const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
    const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
    setRows((att as any[]).map((a) => ({ ...a, full_name: nameMap.get(a.user_id) ?? 'Member' })));
  }, [groupId, today]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`gwa-${groupId}-${today}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'group_wake_attendance', filter: `group_id=eq.${groupId}` },
        () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, today, load]);

  const woke = rows.filter((r) => r.status === 'woke');
  const sleeping = rows.filter((r) => r.status !== 'woke');

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sunrise className="h-5 w-5 text-amber-500" />
          Morning Crew {wakeTime && <span className="text-muted-foreground font-normal">· {wakeTime}</span>}
          <span className="ml-auto text-xs font-normal text-muted-foreground">{rows.length} members</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {woke.map((r) => (
          <Row key={r.user_id} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
               name={r.full_name!} time={r.woke_at ? format(new Date(r.woke_at), 'h:mm a') : ''} />
        ))}
        {sleeping.map((r) => (
          <div key={r.user_id} className="flex items-center gap-3 py-1.5">
            <Moon className="h-4 w-4 text-slate-400" />
            <span className="flex-1 text-sm">{r.full_name}</span>
            <span className="text-xs text-muted-foreground">No response</span>
            {r.user_id !== user?.id && (
              <Button size="sm" variant="outline" className="h-8 px-3"
                disabled={wake.isPending}
                onClick={() => wake.mutate({ group_id: groupId, kind: 'member', target_user_id: r.user_id })}>
                <Bell className="h-3.5 w-3.5 mr-1" /> Wake
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Row({ icon, name, time }: { icon: React.ReactNode; name: string; time: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-1.5')}>
      {icon}
      <span className="flex-1 text-sm font-medium">{name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{time}</span>
    </div>
  );
}
