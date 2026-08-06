import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Users, Plus, Copy, Crown, Link2, ShieldCheck,
  Bell, Flame, Trophy, Timer
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShieldGroup {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
  is_admin: boolean;
  notify_on_offense: boolean;
  connected_rise_group_id?: string | null;
  group_streak: number;
  created_at: string;
}

const STORAGE_KEY = 'shield_groups_v2';

function loadGroups(): ShieldGroup[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveGroups(g: ShieldGroup[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(g));
}
function genCode() {
  return `SH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function ShieldGroupsPanel() {
  const [groups, setGroups] = useState<ShieldGroup[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [notifyOnOffense, setNotifyOnOffense] = useState(true);

  useEffect(() => { setGroups(loadGroups()); }, []);

  const create = () => {
    if (!name.trim()) return;
    const g: ShieldGroup = {
      id: crypto.randomUUID(),
      name: name.trim(),
      invite_code: genCode(),
      member_count: 1,
      is_admin: true,
      notify_on_offense: notifyOnOffense,
      group_streak: 0,
      created_at: new Date().toISOString(),
    };
    const next = [g, ...groups];
    setGroups(next); saveGroups(next);
    setName(''); setCreateOpen(false);
    toast.success(`Group "${g.name}" created`);
  };

  const join = () => {
    if (!code.trim()) return;
    const g: ShieldGroup = {
      id: crypto.randomUUID(),
      name: `Group ${code.toUpperCase()}`,
      invite_code: code.toUpperCase(),
      member_count: 2,
      is_admin: false,
      notify_on_offense: true,
      group_streak: 0,
      created_at: new Date().toISOString(),
    };
    const next = [g, ...groups];
    setGroups(next); saveGroups(next);
    setCode(''); setJoinOpen(false);
    toast.success('Joined group');
  };

  const connectRise = (id: string) => {
    const riseId = window.prompt('Rise group ID দাও:');
    if (!riseId) return;
    const next = groups.map(g =>
      g.id === id ? { ...g, connected_rise_group_id: riseId } : g
    );
    setGroups(next); saveGroups(next);
    toast.success('Rise group linked');
  };

  const toggleNotify = (id: string) => {
    const next = groups.map(g =>
      g.id === id ? { ...g, notify_on_offense: !g.notify_on_offense } : g
    );
    setGroups(next); saveGroups(next);
  };

  const copyInvite = (g: ShieldGroup) => {
    navigator.clipboard.writeText(g.invite_code);
    toast.success('Invite code copied');
  };

  return (
    <div className="space-y-4">

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={() => setCreateOpen(true)} className="flex-1 h-11 rounded-xl">
          <Plus className="h-4 w-4 mr-2" /> Create
        </Button>
        <Button onClick={() => setJoinOpen(true)} variant="outline" className="flex-1 h-11 rounded-xl">
          <Users className="h-4 w-4 mr-2" /> Join
        </Button>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-bold text-sm">No Shield groups yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              বন্ধু বা পরিবারের সাথে একসাথে accountable থাকো।
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map(g => (
          <Card key={g.id} className={cn(
            'border-2',
            g.group_streak >= 7 ? 'border-orange-500/30' :
            g.group_streak >= 3 ? 'border-amber-500/30' : 'border-border/50'
          )}>
            <CardContent className="p-4 space-y-3">

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base truncate">{g.name}</h3>
                    {g.is_admin && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.member_count} member{g.member_count !== 1 && 's'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {g.group_streak > 0 && (
                    <div className="flex items-center gap-1">
                      <Flame className={cn('h-3.5 w-3.5',
                        g.group_streak >= 7 ? 'text-orange-500' : 'text-amber-500')} />
                      <span className="text-xs font-bold">{g.group_streak}d</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {g.notify_on_offense && (
                  <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-600">
                    <Bell className="h-3 w-3 mr-1" /> Offense Alerts ON
                  </Badge>
                )}
                {g.connected_rise_group_id && (
                  <Badge variant="outline" className="text-[11px]">
                    <Link2 className="h-3 w-3 mr-1" /> Rise Linked
                  </Badge>
                )}
                {g.group_streak >= 3 && (
                  <Badge variant="outline" className="text-[11px] border-orange-500/30 text-orange-600">
                    <Trophy className="h-3 w-3 mr-1" /> {g.group_streak} day streak
                  </Badge>
                )}
              </div>

              {/* Invite code */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50">
                <code className="flex-1 text-xs font-mono font-bold">{g.invite_code}</code>
                <Button size="sm" variant="ghost" onClick={() => copyInvite(g)} className="h-7 px-2">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Notify toggle */}
              {g.is_admin && (
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs">Offense এ notify করো</span>
                  </div>
                  <Switch
                    checked={g.notify_on_offense}
                    onCheckedChange={() => toggleNotify(g.id)}
                  />
                </div>
              )}

              {/* Rise connect */}
              {g.is_admin && (
                <Button
                  variant={g.connected_rise_group_id ? 'secondary' : 'outline'}
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={() => connectRise(g.id)}
                >
                  <Link2 className="h-3.5 w-3.5 mr-2" />
                  {g.connected_rise_group_id ? 'Linked with Rise group' : 'Connect to Rise group'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Shield Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Group name (e.g. Brothers in Faith)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-xl"
            />
            <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
              <div>
                <p className="text-sm font-medium">Offense এ notify</p>
                <p className="text-xs text-muted-foreground">কেউ blocked হলে members জানবে</p>
              </div>
              <Switch checked={notifyOnOffense} onCheckedChange={setNotifyOnOffense} />
            </div>
            <Button onClick={create} className="w-full rounded-xl">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Join Shield Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Invite code (SH-XXXXXX)"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="rounded-xl font-mono"
            />
            <Button onClick={join} className="w-full rounded-xl">Join</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}