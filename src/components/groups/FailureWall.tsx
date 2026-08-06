import { Card } from '@/components/ui/card';
import { useGroupFailures } from '@/hooks/useLifeosLive';
import { AlertTriangle } from 'lucide-react';

const KIND_LABEL: Record<string, string> = {
  missed_wake: 'Missed wake',
  focus_abandon: 'Abandoned focus',
  relapse: 'Relapse',
  streak_break: 'Streak broken',
};

export function FailureWall({ groupId }: { groupId: string }) {
  const { data: failures = [] } = useGroupFailures(groupId);
  if (failures.length === 0) {
    return (
      <Card className="p-6 text-center border-dashed">
        <AlertTriangle className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">Clean record. Keep it up.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {failures.map((f: any) => (
        <Card key={f.id} className="p-3 flex items-start gap-3 border-rose-500/20 bg-rose-500/5">
          <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">
              {f.display_name} <span className="text-muted-foreground font-normal">— {KIND_LABEL[f.kind] ?? f.kind}</span>
            </p>
            {f.message && <p className="text-[11px] text-muted-foreground mt-0.5">{f.message}</p>}
            <p className="text-[10px] text-muted-foreground mt-1">
              −{f.penalty_points} pts • {new Date(f.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}