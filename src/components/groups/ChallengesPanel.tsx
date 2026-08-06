import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Flame, Plus, Swords } from 'lucide-react';
import { useCreateChallenge, useGroupChallenges, useJoinChallenge, ChallengeKind } from '@/hooks/useLifeosLive';

const KINDS: { value: ChallengeKind; label: string }[] = [
  { value: 'wake_race', label: 'Wake Race' },
  { value: 'focus_marathon', label: 'Focus Marathon' },
  { value: 'anti_relapse', label: 'Anti-Relapse' },
  { value: 'streak_battle', label: 'Streak Battle' },
  { value: 'custom', label: 'Custom' },
];

export function ChallengesPanel({ groupId }: { groupId: string }) {
  const { data: challenges = [] } = useGroupChallenges(groupId);
  const join = useJoinChallenge();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-1.5"><Swords className="h-4 w-4 text-rose-500" /> Challenges</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Launch
        </Button>
      </div>
      {challenges.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <Trophy className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No challenges yet. Start a wake race or focus marathon.</p>
        </Card>
      ) : challenges.map((c: any) => {
        const ends = new Date(c.ends_at);
        const remaining = Math.max(0, ends.getTime() - Date.now());
        const days = Math.floor(remaining / 86400000);
        const hours = Math.floor((remaining % 86400000) / 3600000);
        return (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-bold text-sm truncate flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-rose-500" /> {c.title}
                </p>
                <p className="text-[11px] text-muted-foreground capitalize">{String(c.kind).replace('_', ' ')} • Target {c.target_value} {c.target_unit}</p>
              </div>
              <span className="text-[10px] font-bold text-amber-500 shrink-0">
                {days > 0 ? `${days}d ${hours}h` : `${hours}h`} left
              </span>
            </div>
            {c.prize && <p className="text-[11px] text-foreground/80 mb-2">🏆 {c.prize}</p>}
            <Button size="sm" className="w-full h-8 text-xs"
              onClick={() => join.mutate({ challenge_id: c.id, group_id: groupId })}
              disabled={join.isPending}>
              Join Challenge
            </Button>
          </Card>
        );
      })}
      <CreateChallengeDialog open={open} onOpenChange={setOpen} groupId={groupId} />
    </div>
  );
}

function CreateChallengeDialog({ open, onOpenChange, groupId }: { open: boolean; onOpenChange: (v: boolean) => void; groupId: string }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ChallengeKind>('focus_marathon');
  const [target, setTarget] = useState(180);
  const [unit, setUnit] = useState('minutes');
  const [days, setDays] = useState(7);
  const [prize, setPrize] = useState('');
  const create = useCreateChallenge();

  const submit = () => {
    if (!title.trim()) return;
    const ends_at = new Date(Date.now() + days * 86400000).toISOString();
    create.mutate(
      { group_id: groupId, title: title.trim(), kind, target_value: target, target_unit: unit, ends_at, prize: prize || undefined },
      { onSuccess: () => { setTitle(''); setPrize(''); onOpenChange(false); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Launch Challenge</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="No social — 7 days" /></div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ChallengeKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Target</Label><Input type="number" value={target} onChange={e => setTarget(Number(e.target.value))} /></div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">minutes</SelectItem>
                  <SelectItem value="days">days</SelectItem>
                  <SelectItem value="sessions">sessions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Duration (days)</Label><Input type="number" value={days} onChange={e => setDays(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Prize (optional)</Label><Input value={prize} onChange={e => setPrize(e.target.value)} placeholder="Bragging rights" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || !title.trim()}>Launch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}