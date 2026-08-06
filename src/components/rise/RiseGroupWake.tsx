import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGroupSettings } from '@/hooks/useGroupSettings';
import { useWakeSignal } from '@/hooks/useWakeSignal';
import { useGroupWakeAlarm } from '@/hooks/useGroupWakeAlarm';
import { GroupWakeMemberGrid } from '@/components/rise/GroupWakeMemberGrid';
import { GroupWakeAdminPanel } from '@/components/rise/GroupWakeAdminPanel';
import { WakeUpCallModal } from '@/components/rise/WakeUpCallModal';
import { scheduleRecurringAlarm } from '@/lib/capacitor/nativeAlarm';
import { isNative } from '@/lib/capacitor/platform';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BellRing, CheckCircle2, Clock, Moon, Sunrise, Plus, Copy, Crown, UserMinus, Settings, LogOut, ShieldBan, ShieldCheck, MessageCircle, Bell, AlertTriangle, Timer, Ban, ShieldAlert } from 'lucide-react';
type SignalType = 'gentle' | 'urgent' | 'sos';

interface Group {
  id: string;
  name: string;
  description: string | null;
  invite_code: string | null;
  created_by: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  role: string | null;
  joined_at: string;
  profile?: {
    full_name: string | null;
  } | null;
}

interface WakeStatus {
  id: string;
  user_id: string;
  group_id: string;
  wake_date: string;
  status: string | null;
  confirmed_at: string | null;
  needs_help: boolean | null;
}

const makeInviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export function RiseGroupWake() {
  const { user } = useAuth();
  const { settings, memberSettings, refreshMemberSettings, updateSettings, isUserBlocked, blockUser, unblockUser } = useGroupSettings();
  const { sendWakeSignal, sendingTo, isOnCooldown, getRemainingCooldown } = useWakeSignal();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [wakeStatuses, setWakeStatuses] = useState<WakeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [blockConfirmUser, setBlockConfirmUser] = useState<GroupMember | null>(null);
  const [bioDialogOpen, setBioDialogOpen] = useState(false);
  const [signalPickerFor, setSignalPickerFor] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [bioText, setBioText] = useState(settings.bio);
  const [dndEnabled, setDndEnabled] = useState(settings.dndEnabled);
  const [dndReason, setDndReason] = useState(settings.dndReason);
  const [wakeCallTarget, setWakeCallTarget] = useState<{ user_id: string; full_name: string } | null>(null);
  const [activeTab, setActiveTab] = useState('members');

  const selectedGroup = useMemo(() => groups.find((group) => group.id === selectedGroupId) || null, [groups, selectedGroupId]);
  const myMembership = useMemo(() => members.find((member) => member.user_id === user?.id) || null, [members, user?.id]);
  const isAdmin = myMembership?.role === 'admin';
  const isCreator = selectedGroup?.created_by === user?.id;
  const gw = useGroupWakeAlarm(selectedGroupId || null);

  useEffect(() => {
    if (user) {
      void loadGroups();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedGroup) return;
    void Promise.all([loadGroupMembers(selectedGroup.id), loadWakeStatuses(selectedGroup.id)]);

    const channel = supabase
      .channel(`group-wake-${selectedGroup.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_wake_status', filter: `group_id=eq.${selectedGroup.id}` }, () => {
        void loadWakeStatuses(selectedGroup.id);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [selectedGroup?.id]);

  useEffect(() => {
    setBioText(settings.bio);
    setDndEnabled(settings.dndEnabled);
    setDndReason(settings.dndReason);
  }, [settings.bio, settings.dndEnabled, settings.dndReason]);

  async function loadGroups() {
    if (!user) return;
    setLoading(true);
    try {
      const { data: memberships, error } = await supabase
        .from('accountability_group_members')
        .select('group_id')
        .eq('user_id', user.id);
      if (error) throw error;

      const groupIds = memberships?.map((row) => row.group_id) || [];
      if (groupIds.length === 0) {
        setGroups([]);
        setSelectedGroupId('');
        return;
      }

      const { data: groupRows, error: groupsError } = await supabase
        .from('accountability_groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false });
      if (groupsError) throw groupsError;

      setGroups(groupRows || []);
      setSelectedGroupId((current) => current || groupRows?.[0]?.id || '');
    } catch (error) {
      console.error('Failed to load groups', error);
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }

  async function loadGroupMembers(groupId: string) {
    const { data, error } = await supabase
      .from('accountability_group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (error) {
      toast.error('Failed to load group members');
      return;
    }

    const membersWithProfiles = await Promise.all((data || []).map(async (member) => {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', member.user_id).maybeSingle();
      return { ...member, profile: profile || null };
    }));

    setMembers(membersWithProfiles);
    await refreshMemberSettings(membersWithProfiles.map((member) => member.user_id));
  }

  async function loadWakeStatuses(groupId: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('group_wake_status')
      .select('id, user_id, group_id, wake_date, status, confirmed_at, needs_help')
      .eq('group_id', groupId)
      .eq('wake_date', today);

    if (error) {
      toast.error('Failed to load wake status');
      return;
    }

    setWakeStatuses(data || []);
  }

  async function createGroup() {
    if (!user || !newGroupName.trim()) return;
    try {
      const inviteCode = makeInviteCode();
      const { data: groupData, error } = await supabase
        .from('accountability_groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
          created_by: user.id,
          invite_code: inviteCode,
        })
        .select('*')
        .single();
      if (error) throw error;

      const { error: memberError } = await supabase.from('accountability_group_members').insert({ group_id: groupData.id, user_id: user.id, role: 'admin' });
      if (memberError) throw memberError;

      toast.success('Group created');
      setCreateDialogOpen(false);
      setNewGroupName('');
      setNewGroupDescription('');
      await loadGroups();
      setSelectedGroupId(groupData.id);
      await loadGroupMembers(groupData.id);
    } catch (error) {
      console.error('Create group failed', error);
      toast.error('Unable to create group');
    }
  }

  async function joinGroup() {
    if (!user || !joinCode.trim()) return;
    try {
      const { data: groupData, error } = await supabase
        .from('accountability_groups')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .maybeSingle();

      if (error || !groupData) {
        toast.error('Invalid invite code');
        return;
      }

      const { data: existingMember } = await supabase
        .from('accountability_group_members')
        .select('id')
        .eq('group_id', groupData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember?.id) {
        toast.error('You are already in this group');
        return;
      }

      const { error: joinError } = await supabase.from('accountability_group_members').insert({ group_id: groupData.id, user_id: user.id, role: 'member' });
      if (joinError) throw joinError;

      toast.success(`Joined ${groupData.name}`);
      setJoinDialogOpen(false);
      setJoinCode('');
      await loadGroups();
      setSelectedGroupId(groupData.id);
    } catch (error) {
      console.error('Join group failed', error);
      toast.error('Unable to join the group');
    }
  }

  async function leaveGroup() {
    if (!user || !selectedGroup) return;
    try {
      const { error } = await supabase.from('accountability_group_members').delete().eq('group_id', selectedGroup.id).eq('user_id', user.id);
      if (error) throw error;
      toast.success('You left the group');
      await loadGroups();
    } catch (error) {
      console.error('Leave group failed', error);
      toast.error('Unable to leave the group');
    }
  }

  async function deleteGroup() {
    if (!selectedGroup) return;
    try {
      await supabase.from('accountability_group_members').delete().eq('group_id', selectedGroup.id);
      await supabase.from('group_wake_status').delete().eq('group_id', selectedGroup.id);
      const { error } = await supabase.from('accountability_groups').delete().eq('id', selectedGroup.id);
      if (error) throw error;
      toast.success('Group deleted');
      setDeleteConfirmOpen(false);
      setSettingsDialogOpen(false);
      await loadGroups();
    } catch (error) {
      console.error('Delete group failed', error);
      toast.error('Unable to delete group');
    }
  }

  async function toggleAdmin(member: GroupMember) {
    if (!selectedGroup) return;
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    try {
      const { error } = await supabase.from('accountability_group_members').update({ role: nextRole }).eq('id', member.id);
      if (error) throw error;
      toast.success(nextRole === 'admin' ? 'Member promoted to admin' : 'Admin removed');
      await loadGroupMembers(selectedGroup.id);
    } catch (error) {
      console.error('Toggle admin failed', error);
      toast.error('Unable to update admin role');
    }
  }

  async function removeMember() {
    if (!memberToRemove || !selectedGroup) return;
    try {
      const { error } = await supabase.from('accountability_group_members').delete().eq('id', memberToRemove.id);
      if (error) throw error;
      toast.success('Member removed');
      setMemberToRemove(null);
      await loadGroupMembers(selectedGroup.id);
    } catch (error) {
      console.error('Remove member failed', error);
      toast.error('Unable to remove member');
    }
  }

  async function confirmAwake() {
    if (!user || !selectedGroup) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from('group_wake_status')
        .select('id')
        .eq('group_id', selectedGroup.id)
        .eq('user_id', user.id)
        .eq('wake_date', today)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from('group_wake_status').update({ status: 'confirmed', confirmed_at: now, needs_help: false }).eq('id', existing.id);
      } else {
        await supabase.from('group_wake_status').insert({ group_id: selectedGroup.id, user_id: user.id, wake_date: today, status: 'confirmed', confirmed_at: now, needs_help: false });
      }

      toast.success('Marked as awake');
      await loadWakeStatuses(selectedGroup.id);
    } catch (error) {
      console.error('Confirm awake failed', error);
      toast.error('Unable to update wake status');
    }
  }

  async function handleSendSignal(targetUserId: string, type: SignalType) {
    if (!selectedGroup || !user) return;

    const targetSettings = memberSettings[targetUserId];
    if (targetSettings?.dndEnabled) {
      toast.error('This member has Do Not Disturb enabled');
      return;
    }

    if (targetSettings?.blockedUsers?.includes(user.id)) {
      toast.error('This member has blocked you');
      return;
    }

    await sendWakeSignal(targetUserId, selectedGroup.id, type);
    setSignalPickerFor(null);
  }

  function saveBio() {
    updateSettings({ bio: bioText, dndEnabled, dndReason });
    setBioDialogOpen(false);
    toast.success('Profile updated');
  }

  function copyInviteCode() {
    if (!selectedGroup?.invite_code) return;
    void navigator.clipboard.writeText(selectedGroup.invite_code);
    toast.success('Invite code copied');
  }

  function getMemberStatus(userId: string) {
    return wakeStatuses.find((status) => status.user_id === userId);
  }

  function getStatusMeta(status: string | null) {
    switch (status) {
      case 'confirmed': return { label: 'Awake', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: <CheckCircle2 className="h-3 w-3" /> };
      case 'awake': return { label: 'Getting up', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: <Sunrise className="h-3 w-3" /> };
      case 'waking': return { label: 'Waking', className: 'bg-primary/10 text-primary border-primary/20', icon: <Clock className="h-3 w-3" /> };
      default: return { label: 'Sleeping', className: 'bg-muted text-muted-foreground', icon: <Moon className="h-3 w-3" /> };
    }
  }

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-semibold mb-2">No groups yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a group or join one with an invite code.</p>
            <div className="flex gap-2 justify-center">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Create group</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create wake group</DialogTitle><DialogDescription>Build an accountability circle for waking up on time.</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Group name</Label><Input placeholder="Fajr Warriors" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Wake up together and keep each other accountable" value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} /></div>
                  </div>
                  <DialogFooter><Button onClick={createGroup} disabled={!newGroupName.trim()}>Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogTrigger asChild><Button variant="outline">Join group</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Join a group</DialogTitle><DialogDescription>Enter the invite code shared by the group admin.</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-4"><div className="space-y-2"><Label>Invite code</Label><Input placeholder="ABC123" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="text-center tracking-widest" /></div></div>
                  <DialogFooter><Button onClick={joinGroup} disabled={!joinCode.trim()}>Join</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm">
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>

            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild><Button size="icon" variant="outline"><Users className="h-4 w-4" /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Join a group</DialogTitle><DialogDescription>Enter the invite code shared by the group admin.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4"><div className="space-y-2"><Label>Invite code</Label><Input placeholder="ABC123" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="text-center tracking-widest" /></div></div>
                <DialogFooter><Button onClick={joinGroup} disabled={!joinCode.trim()}>Join</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild><Button size="icon" variant="outline"><Plus className="h-4 w-4" /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create wake group</DialogTitle><DialogDescription>Anyone can create a group and become its first admin.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label>Group name</Label><Input placeholder="Morning Circle" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Support each other in waking up on time" value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} /></div>
                </div>
                <DialogFooter><Button onClick={createGroup} disabled={!newGroupName.trim()}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            {selectedGroup && (isAdmin || isCreator) && (
              <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
                <DialogTrigger asChild><Button size="icon" variant="outline"><Settings className="h-4 w-4" /></Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Group settings</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div><p className="text-sm font-medium">Invite code</p><p className="text-lg font-mono tracking-widest">{selectedGroup.invite_code}</p></div>
                      <Button size="sm" variant="outline" onClick={copyInviteCode}><Copy className="h-4 w-4" /></Button>
                    </div>
                    {isCreator ? (
                      <Button variant="destructive" className="w-full" onClick={() => setDeleteConfirmOpen(true)}>Delete group</Button>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={leaveGroup}><LogOut className="h-4 w-4 mr-2" />Leave group</Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">My status</p>
                    <p className="text-xs text-muted-foreground">{settings.bio || 'No status added yet'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {settings.dndEnabled && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><Moon className="h-3 w-3 mr-1" />DND</Badge>}
                  <Button size="sm" variant="outline" onClick={() => setBioDialogOpen(true)}>Edit</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedGroup && (
            <>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="wake">Wake Alarm</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                </TabsList>

                <TabsContent value="wake" className="space-y-4 mt-4">
                  {/* Admin Panel */}
                  {(isAdmin || isCreator) && (
                    <GroupWakeAdminPanel
                      alarm={gw.alarm}
                      onSave={async (input) => {
                        await gw.upsertAlarm(input);
                        // Also schedule local alarm so it rings on this device
                        if (isNative && selectedGroupId) {
                          const alarmId = gw.alarm?.id || crypto.randomUUID();
                          await scheduleRecurringAlarm(
                            alarmId,
                            input.wake_time,
                            input.days_of_week,
                            {
                              title: `${selectedGroup.name} Wake Alarm`,
                              body: 'Group wake alarm — mission required to dismiss',
                              missionType: input.mission_type as any,
                              isGroupAlarm: true,
                              groupId: selectedGroupId,
                            }
                          );
                          // Store in localStorage so RiseRingScreen can find it
                          const localAlarms = JSON.parse(localStorage.getItem('local_alarms') || '[]');
                          const existingIndex = localAlarms.findIndex((a: any) => a.groupId === selectedGroupId);
                          const newAlarm = {
                            id: alarmId,
                            alarm_time: input.wake_time.slice(0, 5),
                            days_of_week: input.days_of_week,
                            is_enabled: true,
                            label: `${selectedGroup.name} Wake`,
                            intention: 'Group wake alarm — mission required',
                            verification_type: input.mission_type,
                            snooze_limit: 3,
                            snooze_interval_minutes: 5,
                            groupId: selectedGroupId,
                            isGroupAlarm: true,
                          };
                          if (existingIndex >= 0) localAlarms[existingIndex] = newAlarm;
                          else localAlarms.push(newAlarm);
                          localStorage.setItem('local_alarms', JSON.stringify(localAlarms));
                          window.dispatchEvent(new Event('localAlarmsUpdated'));
                        }
                      }}
                      onDisable={gw.disableAlarm}
                    />
                  )}

                  {/* Member Grid */}
                  {gw.alarm ? (
                    <>
                      <Card className="overflow-hidden border-border/70">
                        <CardHeader className="pb-3 bg-gradient-to-b from-primary/5 to-transparent">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-base flex items-center gap-2 truncate">
                                <Sunrise className="h-4 w-4 text-primary shrink-0" />
                                <span className="truncate">{selectedGroup.name}</span>
                              </CardTitle>
                              <CardDescription className="mt-0.5 text-xs">
                                Alarm {gw.alarm.wake_time.slice(0, 5)} · {gw.alarm.mission_type}
                              </CardDescription>
                            </div>
                            <Badge variant="secondary" className="shrink-0 font-medium">
                              {members.length} {members.length === 1 ? 'member' : 'members'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <GroupWakeMemberGrid
                            members={members.map((m) => ({ user_id: m.user_id, full_name: m.profile?.full_name || null }))}
                            statuses={gw.statuses}
                            currentUserId={user?.id || ''}
                            onSendWakeUp={(m) => setWakeCallTarget(m)}
                          />
                          <Button
                            className="w-full mt-5 h-11"
                            onClick={async () => {
                              await gw.upsertMyStatus({ status: 'mission_done', mission_completed_at: new Date().toISOString() });
                              toast.success('Marked as awake');
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> I'm awake
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card className="text-center py-8">
                      <CardContent>
                        <Sunrise className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="font-semibold mb-2">No wake alarm set</h3>
                        <p className="text-sm text-muted-foreground">
                          {isAdmin || isCreator
                            ? 'Set a group wake alarm so everyone rises together.'
                            : 'Ask your group admin to set a wake alarm.'}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="members" className="space-y-4 mt-4">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />{selectedGroup.name}</CardTitle>
                        <Badge variant="outline">{members.length} members</Badge>
                      </div>
                      {selectedGroup.description && <CardDescription>{selectedGroup.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-around py-2">
                        <div className="text-center"><p className="text-2xl font-bold text-emerald-600">{wakeStatuses.filter((item) => item.status === 'confirmed').length}</p><p className="text-xs text-muted-foreground">Awake</p></div>
                        <div className="text-center"><p className="text-2xl font-bold text-blue-600">{wakeStatuses.filter((item) => item.status === 'awake').length}</p><p className="text-xs text-muted-foreground">Getting up</p></div>
                        <div className="text-center"><p className="text-2xl font-bold text-muted-foreground">{Math.max(members.length - wakeStatuses.length, 0)}</p><p className="text-xs text-muted-foreground">Sleeping</p></div>
                      </div>
                      <Button className="w-full mt-3" onClick={confirmAwake}><CheckCircle2 className="h-4 w-4 mr-2" />Mark me awake</Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium px-1">Members</h3>
                    {members.map((member) => {
                      const status = getMemberStatus(member.user_id);
                      const statusMeta = getStatusMeta(status?.status || null);
                      const isSelf = member.user_id === user?.id;
                      const memberIsAdmin = member.role === 'admin';
                      const blocked = isUserBlocked(member.user_id);
                      const onCooldown = !isSelf && isOnCooldown(member.user_id);
                      const cooldownRemaining = !isSelf ? Math.ceil(getRemainingCooldown(member.user_id) / 60000) : 0;
                      const remoteSettings = memberSettings[member.user_id];
                      const blockedByMember = !!(user?.id && remoteSettings?.blockedUsers?.includes(user.id));

                      return (
                        <Card key={member.id} className={cn((blocked || blockedByMember) && 'opacity-60')}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10"><AvatarFallback>{(member.profile?.full_name || 'U').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm">{member.profile?.full_name || 'User'}{isSelf ? ' (You)' : ''}</p>
                                    {memberIsAdmin && <Crown className="h-3 w-3 text-primary" />}
                                    {remoteSettings?.dndEnabled && <Badge variant="outline" className="text-xs"><Moon className="h-3 w-3 mr-1" />DND</Badge>}
                                    {blocked && <Ban className="h-3 w-3 text-destructive" />}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                    {remoteSettings?.bio && <span>{remoteSettings.bio}</span>}
                                    {status?.confirmed_at && <span className="text-emerald-600">• {format(new Date(status.confirmed_at), 'h:mm a')}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className={cn('text-xs', statusMeta.className)}>{statusMeta.icon}<span className="ml-1">{statusMeta.label}</span></Badge>

                                {!isSelf && !blocked && !blockedByMember && !remoteSettings?.dndEnabled && !status?.status && (
                                  onCooldown ? (
                                    <Badge variant="outline" className="text-xs text-muted-foreground"><Timer className="h-3 w-3 mr-1" />{cooldownRemaining}m</Badge>
                                  ) : (
                                    <DropdownMenu open={signalPickerFor === member.user_id} onOpenChange={(open) => setSignalPickerFor(open ? member.user_id : null)}>
                                      <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={sendingTo === member.user_id}><BellRing className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-52">
                                        <DropdownMenuItem onClick={() => handleSendSignal(member.user_id, 'gentle')}><Bell className="h-4 w-4 mr-2 text-blue-600" />Gentle nudge</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleSendSignal(member.user_id, 'urgent')}><ShieldAlert className="h-4 w-4 mr-2 text-primary" />Urgent alarm</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleSendSignal(member.user_id, 'sos')}><AlertTriangle className="h-4 w-4 mr-2 text-destructive" />SOS signal</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )
                                )}

                                {!isSelf && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><Settings className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {(isAdmin || isCreator) && (
                                        <>
                                          <DropdownMenuItem onClick={() => toggleAdmin(member)}><Crown className="h-4 w-4 mr-2" />{memberIsAdmin ? 'Remove admin access' : 'Make admin'}</DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                        </>
                                      )}
                                      <DropdownMenuItem onClick={() => blocked ? unblockUser(member.user_id) : setBlockConfirmUser(member)}>
                                        {blocked ? <><ShieldCheck className="h-4 w-4 mr-2" />Unblock</> : <><ShieldBan className="h-4 w-4 mr-2 text-destructive" />Block</>}
                                      </DropdownMenuItem>
                                      {(isAdmin || isCreator) && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-destructive" onClick={() => setMemberToRemove(member)}><UserMinus className="h-4 w-4 mr-2" />Remove from group</DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <Card className="bg-muted/30">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Invite code</p>
                        <p className="text-lg font-mono tracking-widest">{selectedGroup.invite_code}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={copyInviteCode}><Copy className="h-4 w-4 mr-2" />Copy</Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}

      <Dialog open={bioDialogOpen} onOpenChange={setBioDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Profile and status</DialogTitle><DialogDescription>Set your note and your Do Not Disturb preference.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Bio / status</Label><Textarea placeholder="Example: Studying late tonight" value={bioText} onChange={(e) => setBioText(e.target.value)} maxLength={150} /><p className="text-xs text-muted-foreground text-right">{bioText.length}/150</p></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Do Not Disturb</p><p className="text-xs text-muted-foreground">Other members cannot send wake signals</p></div><Switch checked={dndEnabled} onCheckedChange={setDndEnabled} /></div>
              {dndEnabled && <div className="space-y-2"><Label>Reason</Label><Input placeholder="Example: Sick today" value={dndReason} onChange={(e) => setDndReason(e.target.value)} /></div>}
            </div>
          </div>
          <DialogFooter><Button onClick={saveBio}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!blockConfirmUser} onOpenChange={() => setBlockConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Block this member?</AlertDialogTitle><AlertDialogDescription>{blockConfirmUser?.profile?.full_name || 'This member'} will no longer be able to wake you with signals.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (blockConfirmUser) { blockUser(blockConfirmUser.user_id); toast.success('Member blocked'); setBlockConfirmUser(null); } }} className="bg-destructive text-destructive-foreground">Block</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this group?</AlertDialogTitle><AlertDialogDescription>This permanently removes the group and all its membership records.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteGroup} className="bg-destructive text-destructive-foreground">Delete group</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove member?</AlertDialogTitle><AlertDialogDescription>Remove {memberToRemove?.profile?.full_name || 'this member'} from the group?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={removeMember} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WakeUpCallModal
        open={!!wakeCallTarget}
        onClose={() => setWakeCallTarget(null)}
        targetName={wakeCallTarget?.full_name || 'Member'}
        remaining={gw.session ? 2 - (gw.statuses.find((s) => s.user_id === wakeCallTarget?.user_id)?.wake_up_calls_received || 0) : 2}
        onSend={async (msg) => {
          if (wakeCallTarget) {
            await gw.sendWakeUpCall(wakeCallTarget.user_id, msg);
            setWakeCallTarget(null);
          }
        }}
      />
    </div>
  );
}
