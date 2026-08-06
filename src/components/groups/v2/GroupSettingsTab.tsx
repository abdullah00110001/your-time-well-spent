import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Copy, LogOut, Pencil, MessageSquare, Crown, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLeaveGroup } from '@/hooks/useLifeosGroups';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  group: { id: string; name: string; description: string | null; goal: string; invite_code: string; chat_enabled: boolean; created_by?: string };
  isLeader: boolean;
  onLeft: () => void;
}

export function GroupSettingsTab({ group, isLeader, onLeft }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const leave = useLeaveGroup();
  const [muted, setMuted] = useState(false);
  const [name, setName] = useState(group.name);
  const [desc, setDesc] = useState(group.description ?? '');
  const [goal, setGoal] = useState(group.goal);
  const [chatEnabled, setChatEnabled] = useState(group.chat_enabled);
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isOwner = !!(user && group.created_by && user.id === group.created_by);

  const saveLeader = async () => {
    setSaving(true);
    const { error } = await supabase.from('lifeos_groups').update({
      name: name.trim(),
      description: desc.trim() || null,
      goal: goal.trim(),
      chat_enabled: chatEnabled,
    }).eq('id', group.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Group updated');
      qc.invalidateQueries({ queryKey: ['lifeos-group', group.id] });
      qc.invalidateQueries({ queryKey: ['lifeos-groups'] });
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(group.invite_code);
    toast.success('Invite code copied');
  };

  const handleDelete = async () => {
    if (confirmName.trim() !== group.name.trim()) {
      toast.error('Group name does not match');
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from('lifeos_groups').delete().eq('id', group.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Group deleted');
    qc.invalidateQueries({ queryKey: ['lifeos-groups'] });
    setDeleteOpen(false);
    onLeft();
  };

  return (
    <div className="space-y-4">
      {/* Invite */}
      <Card className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Invite code</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2.5 rounded-xl bg-muted text-sm font-mono tracking-wider">{group.invite_code}</code>
          <Button size="icon" variant="outline" onClick={copyInvite}><Copy className="h-4 w-4" /></Button>
        </div>
      </Card>

      {/* User-side controls */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Mute notifications</p>
              <p className="text-xs text-muted-foreground">Pause chat and wake calls</p>
            </div>
          </div>
          <Switch checked={muted} onCheckedChange={setMuted} />
        </div>
      </Card>

      {/* Leader-only */}
      {isLeader && (
        <Card className="p-4 space-y-4 border-primary/30">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-bold">Leader controls</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Group name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Group goal</Label>
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Group chat</p>
                <p className="text-xs text-muted-foreground">Allow members to message</p>
              </div>
            </div>
            <Switch checked={chatEnabled} onCheckedChange={setChatEnabled} />
          </div>

          <Button onClick={saveLeader} disabled={saving} className="w-full">
            <Pencil className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="p-4 space-y-3 border-destructive/40 bg-destructive/5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm font-bold text-destructive">Danger zone</p>
        </div>

        <Button
          variant="outline"
          className="w-full justify-start border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setLeaveOpen(true)}
          disabled={isOwner}
        >
          <LogOut className="h-4 w-4 mr-2" /> Leave group
        </Button>
        {isOwner && (
          <p className="text-[11px] text-muted-foreground -mt-1">
            Owners can't leave — transfer ownership or delete the group.
          </p>
        )}

        {isOwner && (
          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={() => { setConfirmName(''); setDeleteOpen(true); }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete group
          </Button>
        )}
      </Card>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this group?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll stop receiving wake calls and chat from {group.name}. You can rejoin later using the invite code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => leave.mutate(group.id, { onSuccess: () => { setLeaveOpen(false); onLeft(); } })}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete this group permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all members, chat history, and wake records. This cannot be undone.
              Type <span className="font-bold text-foreground">{group.name}</span> below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            placeholder={group.name}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting || confirmName.trim() !== group.name.trim()}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              {deleting ? 'Deleting…' : 'Delete forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}