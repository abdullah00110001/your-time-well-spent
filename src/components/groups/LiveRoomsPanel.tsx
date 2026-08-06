import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Radio, Users, Sunrise, BookOpen, Brain, ShieldOff, Sparkles } from 'lucide-react';
import { useCreateRoom, useGroupRooms, useJoinRoom, useLeaveRoom, useRoomParticipants, useRoomTicker, RoomKind } from '@/hooks/useLifeosLive';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const KIND_META: Record<RoomKind, { label: string; icon: any; tint: string }> = {
  study:     { label: 'Study',         icon: BookOpen,  tint: 'text-sky-500 bg-sky-500/10' },
  deep_work: { label: 'Deep Work',     icon: Brain,     tint: 'text-emerald-500 bg-emerald-500/10' },
  wake_up:   { label: 'Wake Up',       icon: Sunrise,   tint: 'text-amber-500 bg-amber-500/10' },
  quran:     { label: 'Quran',         icon: BookOpen,  tint: 'text-violet-500 bg-violet-500/10' },
  detox:     { label: 'Detox',         icon: ShieldOff, tint: 'text-rose-500 bg-rose-500/10' },
  custom:    { label: 'Custom',        icon: Sparkles,  tint: 'text-primary bg-primary/10' },
};

export function LiveRoomsPanel({ groupId, defaultKind }: { groupId: string; defaultKind?: RoomKind }) {
  const { data: rooms = [], isLoading } = useGroupRooms(groupId);
  const [open, setOpen] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const activeRoom = rooms.find((r: any) => r.id === activeRoomId);

  if (activeRoom) {
    return <ActiveRoomView room={activeRoom} groupId={groupId} onLeave={() => setActiveRoomId(null)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Radio className="h-4 w-4 text-emerald-500 animate-pulse" /> Live Rooms
        </h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Room
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">Loading…</Card>
      ) : rooms.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <Radio className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No live rooms yet. Open one to study together.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rooms.map((r: any) => {
            const meta = KIND_META[r.kind as RoomKind] ?? KIND_META.custom;
            const Icon = meta.icon;
            return (
              <button key={r.id} onClick={() => setActiveRoomId(r.id)}
                className="text-left rounded-2xl border bg-card p-4 hover:border-primary/50 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', meta.tint)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{meta.label} • {r.target_minutes}m</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {r.active_count} live
                  </span>
                  {r.active_count > 0 && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CreateRoomDialog open={open} onOpenChange={setOpen} groupId={groupId} defaultKind={defaultKind} />
    </div>
  );
}

function ActiveRoomView({ room, groupId, onLeave }: { room: any; groupId: string; onLeave: () => void }) {
  const { user } = useAuth();
  const { data: participants = [] } = useRoomParticipants(room.id);
  const join = useJoinRoom();
  const leave = useLeaveRoom();

  const me = participants.find((p: any) => p.user_id === user?.id);
  const seconds = useRoomTicker(me?.joined_at ?? null);
  const mins = Math.floor(seconds / 60);
  const ss = seconds % 60;

  const meta = KIND_META[room.kind as RoomKind] ?? KIND_META.custom;
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <button onClick={onLeave} className="text-xs text-muted-foreground hover:text-foreground">← Back to rooms</button>

      <Card className="p-5 text-center bg-gradient-to-br from-primary/5 to-transparent">
        <div className={cn('h-12 w-12 rounded-2xl mx-auto mb-2 flex items-center justify-center', meta.tint)}>
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="font-bold text-lg">{room.name}</h2>
        <p className="text-xs text-muted-foreground">{meta.label} • Target {room.target_minutes}m</p>
        {me ? (
          <>
            <p className="text-5xl font-mono font-bold mt-4 tabular-nums">
              {String(Math.floor(mins / 60)).padStart(2, '0')}:{String(mins % 60).padStart(2, '0')}:{String(ss).padStart(2, '0')}
            </p>
            <Button variant="destructive" className="mt-4" onClick={() =>
              leave.mutate({ room_id: room.id, group_id: groupId, focus_minutes: mins }, { onSuccess: onLeave })
            }>
              Leave room
            </Button>
          </>
        ) : (
          <Button className="mt-4" onClick={() => join.mutate({ room_id: room.id, group_id: groupId })}>
            Join Live Session
          </Button>
        )}
      </Card>

      <div>
        <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">In the room ({participants.length})</h3>
        {participants.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Be the first to join.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {participants.map((p: any) => (
              <Card key={p.id} className="p-2 flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-[10px] font-bold ring-2 ring-emerald-500/40">
                  {(p.display_name || 'M').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{p.display_name}</p>
                  <p className="text-[10px] text-emerald-500">{p.status}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateRoomDialog({ open, onOpenChange, groupId, defaultKind }: { open: boolean; onOpenChange: (v: boolean) => void; groupId: string; defaultKind?: RoomKind }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RoomKind>(defaultKind ?? 'deep_work');
  const [minutes, setMinutes] = useState(60);
  const create = useCreateRoom();

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { group_id: groupId, name: name.trim(), kind, target_minutes: minutes },
      { onSuccess: () => { setName(''); onOpenChange(false); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Live Room</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Room name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fajr Squad" />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as RoomKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_META) as RoomKind[]).map(k => (
                  <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Target minutes</Label>
            <Input type="number" value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 60)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || !name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}