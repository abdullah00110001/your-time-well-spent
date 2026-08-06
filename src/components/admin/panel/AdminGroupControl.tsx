import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, MessageSquare, Trash2, BellRing, AlertTriangle, Save, Timer } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminGroupSettings } from '@/hooks/useAdminGroupSettings';

interface GroupRow {
  id: string;
  name: string;
  type: string;
  member_count: number;
  last_activity_at: string;
  chat_enabled: boolean;
  is_deleted: boolean;
  created_at: string;
}

export default function AdminGroupControl() {
  const { data: settings, save, isLoading } = useAdminGroupSettings();
  const [draft, setDraft] = useState<any | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => { if (settings) setDraft({ ...settings }); }, [settings]);
  useEffect(() => { fetchGroups(); }, []);

  const fetchGroups = async () => {
    setLoadingGroups(true);
    const { data } = await supabase
      .from('lifeos_groups')
      .select('id, name, type, chat_enabled, is_deleted, last_activity_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    const enriched = await Promise.all((data ?? []).map(async (g: any) => {
      const { count } = await supabase.from('lifeos_group_members')
        .select('*', { count: 'exact', head: true }).eq('group_id', g.id);
      return { ...g, member_count: count ?? 0 } as GroupRow;
    }));
    setGroups(enriched);
    setLoadingGroups(false);
  };

  const toggleGroupChat = async (id: string, value: boolean) => {
    await supabase.from('lifeos_groups').update({ chat_enabled: value }).eq('id', id);
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, chat_enabled: value } : g));
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Soft-delete this group? Members will lose access.')) return;
    await supabase.from('lifeos_groups').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
    toast.success('Group deleted');
    fetchGroups();
  };

  if (!draft || isLoading) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  return (
    <div className="space-y-6">
      {/* Global rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Global rules</CardTitle>
          <CardDescription>These settings apply to every Life OS group.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Group chat enabled globally</p>
              <p className="text-xs text-muted-foreground">Master switch — turns chat off for every group at once.</p>
            </div>
            <Switch checked={draft.chat_enabled_global} onCheckedChange={(v) => setDraft({ ...draft, chat_enabled_global: v })} />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Group capacity</Label>
              <Badge variant="outline" className="tabular-nums">{draft.max_capacity} members</Badge>
            </div>
            <Slider min={5} max={500} step={5} value={[draft.max_capacity]}
              onValueChange={([v]) => setDraft({ ...draft, max_capacity: v })} />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2"><BellRing className="h-4 w-4" /> Leader wake-all / day</Label>
              <Input type="number" min={0} max={20} value={draft.leader_broadcast_per_day}
                onChange={(e) => setDraft({ ...draft, leader_broadcast_per_day: Number(e.target.value) })} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2"><BellRing className="h-4 w-4" /> Member wake-up / day per target</Label>
              <Input type="number" min={0} max={20} value={draft.member_wake_per_day}
                onChange={(e) => setDraft({ ...draft, member_wake_per_day: Number(e.target.value) })} className="mt-1.5" />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm flex items-center gap-2"><Timer className="h-4 w-4" /> Auto-delete inactive groups</p>
                <p className="text-xs text-muted-foreground">Soft-delete when too many members go quiet.</p>
              </div>
              <Switch checked={draft.auto_delete_enabled} onCheckedChange={(v) => setDraft({ ...draft, auto_delete_enabled: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Inactive threshold (%)</Label>
                <Input type="number" min={10} max={100} value={draft.inactive_threshold_pct}
                  onChange={(e) => setDraft({ ...draft, inactive_threshold_pct: Number(e.target.value) })} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Inactivity window (days)</Label>
                <Input type="number" min={1} max={90} value={draft.inactive_window_days}
                  onChange={(e) => setDraft({ ...draft, inactive_window_days: Number(e.target.value) })} className="mt-1.5" />
              </div>
            </div>
          </div>

          <Button onClick={() => save.mutate(draft)} disabled={save.isPending} className="w-full">
            <Save className="h-4 w-4 mr-2" /> {save.isPending ? 'Saving…' : 'Save global rules'}
          </Button>
        </CardContent>
      </Card>

      {/* All groups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> All groups ({groups.length})</CardTitle>
          <CardDescription>Per-group chat toggle and manual delete.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead>Chat</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingGroups ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading…</TableCell></TableRow>
              ) : groups.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No groups yet</TableCell></TableRow>
              ) : groups.map((g) => (
                <TableRow key={g.id} className={g.is_deleted ? 'opacity-50' : ''}>
                  <TableCell>
                    <p className="font-semibold">{g.name}</p>
                    {g.is_deleted && <Badge variant="destructive" className="text-[10px] mt-0.5">Deleted</Badge>}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{g.type}</Badge></TableCell>
                  <TableCell><Badge>{g.member_count}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {g.last_activity_at ? format(new Date(g.last_activity_at), 'MMM d, HH:mm') : '—'}
                  </TableCell>
                  <TableCell>
                    <Switch checked={g.chat_enabled} onCheckedChange={(v) => toggleGroupChat(g.id, v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteGroup(g.id)} disabled={g.is_deleted}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Inactive-group cleanup runs daily via the <code className="font-mono">group-lifecycle-cron</code> edge function.
            Wake-up broadcasts go through <code className="font-mono">wake-broadcast</code> with rate limits enforced server-side.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
