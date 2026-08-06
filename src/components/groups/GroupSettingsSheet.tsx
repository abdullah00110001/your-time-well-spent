/**
 * GroupSettingsSheet — full-featured bottom sheet:
 * Group info (name/desc/avatar), members (promote/remove/transfer),
 * invite, notifications, danger zone (leave / delete).
 */
import { useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Camera, Copy, Crown, LogOut, Trash2, UserMinus, Shield, ShieldCheck,
  Bell, Users, Megaphone,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLeaveGroup } from '@/hooks/useLifeosGroups';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UnifiedMember } from './UnifiedGroupDetail';

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  goal?: string | null;
  invite_code: string;
  created_by: string;
  avatar_url?: string | null;
  is_public?: boolean;
  require_approval?: boolean;
  chat_enabled?: boolean;
  pinned_announcement?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: GroupRow;
  members: UnifiedMember[];
  currentUserId: string;
  onLeft: () => void;
}

const NOTIF_KEY = (gid: string, uid: string) => `group_notifs_${gid}_${uid}`;
function loadNotifs(gid: string, uid: string) {
  try {
    const raw = localStorage.getItem(NOTIF_KEY(gid, uid));
    return raw ? JSON.parse(raw) : { wakeups: true, challenges: true };
  } catch { return { wakeups: true, challenges: true }; }
}
function saveNotifs(gid: string, uid: string, v: any) {
  try { localStorage.setItem(NOTIF_KEY(gid, uid), JSON.stringify(v)); } catch {}
}

export function GroupSettingsSheet({ open, onOpenChange, group, members, currentUserId, onLeft }: Props) {
  const qc = useQueryClient();
  const leave = useLeaveGroup();
  const fileRef = useRef<HTMLInputElement>(null);

  const isOwner = group.created_by === currentUserId;
  const myMember = members.find((m) => m.user_id === currentUserId);
  const isAdmin = isOwner || myMember?.role === 'admin' || myMember?.role === 'owner' || myMember?.role === 'leader';

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [avatarUrl, setAvatarUrl] = useState(group.avatar_url ?? '');
  const [requireApproval, setRequireApproval] = useState(!!group.require_approval);
  const [isPublic, setIsPublic] = useState(group.is_public !== false);
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState(group.pinned_announcement ?? '');
  const [notifs, setNotifs] = useState(() => loadNotifs(group.id, currentUserId));
  const [saving, setSaving] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  async function uploadAvatar(file: File) {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${group.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('group-avatars').upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); return; }
    const { data } = supabase.storage.from('group-avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    toast.success('Avatar uploaded — tap Save');
  }

  async function saveInfo() {
    if (!isAdmin) return;
    setSaving(true);
    const { error } = await (supabase.from('lifeos_groups') as any).update({
      name: name.trim(),
      description: description.trim() || null,
      avatar_url: avatarUrl || null,
      is_public: isPublic,
      require_approval: requireApproval,
      pinned_announcement: pinnedAnnouncement.trim() || null,
    }).eq('id', group.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Group updated');
    qc.invalidateQueries({ queryKey: ['lifeos-group', group.id] });
    qc.invalidateQueries({ queryKey: ['lifeos-groups'] });
  }

  function copyInvite() {
    navigator.clipboard?.writeText(group.invite_code);
    toast.success('Invite code copied');
  }
  function shareLink() {
    const link = `${window.location.origin}/?join=${group.invite_code}`;
    navigator.clipboard?.writeText(link);
    toast.success('Invite link copied');
  }

  async function setMemberRole(userId: string, role: 'admin' | 'member') {
    const { error } = await (supabase as any).rpc('set_lifeos_group_member_role', {
      _group_id: group.id,
      _target_user_id: userId,
      _role: role,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(role === 'admin' ? 'Promoted to admin' : 'Demoted to member');
    qc.invalidateQueries({ queryKey: ['rise-group-live', group.id] });
  }
  async function removeMember(userId: string) {
    const { error } = await (supabase as any).rpc('remove_lifeos_group_member', {
      _group_id: group.id,
      _target_user_id: userId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Member removed');
    qc.invalidateQueries({ queryKey: ['rise-group-live', group.id] });
  }
  async function transferOwnership(userId: string) {
    if (!isOwner) return;
    const { error } = await (supabase as any).rpc('transfer_lifeos_group_ownership', {
      _group_id: group.id,
      _target_user_id: userId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Ownership transferred');
    qc.invalidateQueries({ queryKey: ['lifeos-group', group.id] });
    qc.invalidateQueries({ queryKey: ['rise-group-live', group.id] });
  }

  async function deleteGroup() {
    const { error } = await (supabase.from('lifeos_groups') as any).update({
      is_deleted: true, deleted_at: new Date().toISOString(),
    }).eq('id', group.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Group deleted');
    qc.invalidateQueries({ queryKey: ['lifeos-groups'] });
    onLeft();
  }

  const groupInitials = group.name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto pb-8">
        <SheetHeader className="text-left pb-2">
          <SheetTitle>Group settings</SheetTitle>
        </SheetHeader>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={() => isAdmin && fileRef.current?.click()}
            className="relative group"
            disabled={!isAdmin}
          >
            <Avatar className="h-16 w-16 ring-2 ring-primary/20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={group.name} />}
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-bold text-lg">
                {groupInitials}
              </AvatarFallback>
            </Avatar>
            {isAdmin && (
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 grid place-items-center transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
            />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate">{group.name}</p>
            <p className="text-xs text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Group info */}
        {isAdmin && (
          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-primary" /> Pinned announcement
              </label>
              <Textarea
                value={pinnedAnnouncement}
                onChange={(e) => setPinnedAnnouncement(e.target.value)}
                className="mt-1"
                rows={2}
                maxLength={120}
                placeholder="Wake together at Fajr — no excuses."
              />
            </div>
            <Button onClick={saveInfo} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}

        <Separator className="my-5" />

        {/* Invite */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Invite</h3>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-muted border border-border">
            <code className="flex-1 text-sm font-mono px-2">{group.invite_code}</code>
            <Button size="sm" variant="ghost" onClick={copyInvite}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={shareLink}>
            Copy invite link
          </Button>
          {isAdmin && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Open to anyone (public)</span>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Require admin approval</span>
                <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
              </div>
            </div>
          )}
        </div>

        <Separator className="my-5" />

        {/* Members */}
        <div>
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Members
          </h3>
          <div className="space-y-1.5">
            {members.map((m) => {
              const isMemberOwner = m.user_id === group.created_by;
              const isMemberAdmin = m.role === 'admin' || m.role === 'owner' || m.role === 'leader';
              const isSelf = m.user_id === currentUserId;
              const initials = (m.full_name || '?').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50">
                  <Avatar className="h-9 w-9">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      {m.full_name?.trim() || 'Member'}
                      {isSelf && <span className="text-[10px] text-muted-foreground">(You)</span>}
                      {isMemberOwner && <Crown className="h-3 w-3 text-amber-500" />}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isMemberOwner ? 'Owner' : isMemberAdmin ? 'Admin' : 'Member'}
                    </p>
                  </div>
                  {isAdmin && !isSelf && !isMemberOwner && (
                    <div className="flex items-center gap-1">
                      {!isMemberAdmin ? (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Promote to admin"
                          onClick={() => setMemberRole(m.user_id, 'admin')}>
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Demote to member"
                          onClick={() => setMemberRole(m.user_id, 'member')}>
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isOwner && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Transfer ownership"
                          onClick={() => transferOwnership(m.user_id)}>
                          <Crown className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => removeMember(m.user_id)} title="Remove">
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="my-5" />

        {/* Notifications */}
        <div>
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Wake-up calls</span>
              <Switch
                checked={notifs.wakeups}
                onCheckedChange={(v) => { const n = { ...notifs, wakeups: v }; setNotifs(n); saveNotifs(group.id, currentUserId, n); }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Challenge notifications</span>
              <Switch
                checked={notifs.challenges}
                onCheckedChange={(v) => { const n = { ...notifs, challenges: v }; setNotifs(n); saveNotifs(group.id, currentUserId, n); }}
              />
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        {/* Danger zone */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-destructive">Danger zone</h3>
          <Button variant="outline" className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => setLeaveOpen(true)}>
            <LogOut className="h-4 w-4 mr-2" /> Leave group
          </Button>
          {isOwner && (
            <Button variant="outline" className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete group
            </Button>
          )}
        </div>

        {/* Confirm Leave */}
        <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave {group.name}?</AlertDialogTitle>
              <AlertDialogDescription>You'll stop getting wake calls and challenge notifications from this group.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => leave.mutate(group.id, { onSuccess: onLeft })}
              >Leave</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm Delete */}
        <AlertDialog open={deleteOpen} onOpenChange={(v) => { setDeleteOpen(v); if (!v) setDeleteConfirm(''); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {group.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Type <span className="font-bold text-foreground">{group.name}</span> to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={group.name} />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteConfirm !== group.name}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={deleteGroup}
              >Delete forever</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
