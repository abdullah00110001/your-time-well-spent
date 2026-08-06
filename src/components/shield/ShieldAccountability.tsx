import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Users, Plus, Copy, Check, Shield, Eye, Lock,
  UserPlus, Crown, Flame, Bell, Timer, Trophy
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AccountabilityGroup {
  id: string;
  name: string;
  description: string | null;
  invite_code: string | null;
  created_by: string;
  can_view_shield_status: boolean | null;
  can_approve_unlock: boolean | null;
  notification_level?: string | null;
  members?: GroupMember[];
}

interface GroupMember {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  display_name?: string;
}

interface StreakData {
  current: number;
  longest: number;
  lastCleanDate: string;
}

// ── Streak logic ──────────────────────────────────────────────────────────────

function loadStreak(): StreakData {
  try {
    return JSON.parse(localStorage.getItem('shield_streak') || 'null') || {
      current: 0, longest: 0, lastCleanDate: ''
    };
  } catch { return { current: 0, longest: 0, lastCleanDate: '' }; }
}

function saveStreak(s: StreakData) {
  localStorage.setItem('shield_streak', JSON.stringify(s));
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function updateStreakForCleanDay(): StreakData {
  const s = loadStreak();
  const today = getTodayStr();
  if (s.lastCleanDate === today) return s; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newCurrent = s.lastCleanDate === yesterdayStr ? s.current + 1 : 1;
  const updated: StreakData = {
    current: newCurrent,
    longest: Math.max(newCurrent, s.longest),
    lastCleanDate: today,
  };
  saveStreak(updated);
  return updated;
}

function breakStreak(): StreakData {
  const s = loadStreak();
  const updated: StreakData = { ...s, current: 0 };
  saveStreak(updated);
  return updated;
}

// ── Urge Surfing Timer ────────────────────────────────────────────────────────

function UrgeSurfingTimer({ onComplete }: { onComplete: () => void }) {
  const URGE_SECONDS = 5 * 60; // 5 minutes
  const [remaining, setRemaining] = useState(URGE_SECONDS);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            onComplete();
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = ((URGE_SECONDS - remaining) / URGE_SECONDS) * 100;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        গবেষণা বলে — ৫ মিনিট অপেক্ষা করলে urge ৭০% কমে যায়।
      </p>

      {/* Circular progress */}
      <div className="flex justify-center">
        <div className="relative h-32 w-32">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor"
              className="text-muted/30" strokeWidth="8" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor"
              className="text-primary transition-all duration-1000"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] text-muted-foreground">remaining</span>
          </div>
        </div>
      </div>

      {!running ? (
        <Button
          onClick={() => { setRunning(true); setRemaining(URGE_SECONDS); }}
          className="w-full rounded-2xl h-11"
        >
          <Timer className="h-4 w-4 mr-2" />
          আমি অপেক্ষা করবো
        </Button>
      ) : (
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-primary animate-pulse">Timer চলছে… 💪</p>
          <Button variant="ghost" size="sm" onClick={() => {
            setRunning(false);
            setRemaining(URGE_SECONDS);
          }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Streak Card ───────────────────────────────────────────────────────────────

function StreakCard() {
  const [streak, setStreak] = useState<StreakData>(loadStreak);

  // Check and update streak on mount
  useEffect(() => {
    const offenses = parseInt(localStorage.getItem('shield_offenses_today') || '0');
    if (offenses === 0) {
      const updated = updateStreakForCleanDay();
      setStreak(updated);
    }
  }, []);

  const flameColor = streak.current >= 7
    ? 'text-orange-500'
    : streak.current >= 3
    ? 'text-amber-500'
    : 'text-muted-foreground';

  return (
    <Card className={cn(
      'border-2',
      streak.current >= 7 ? 'border-orange-500/30 bg-orange-500/5' :
      streak.current >= 3 ? 'border-amber-500/30 bg-amber-500/5' :
      'border-border/50'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
              Clean Streak
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black">{streak.current}</span>
              <span className="text-muted-foreground text-sm">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Best: {streak.longest} days
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Flame className={cn('h-12 w-12', flameColor,
              streak.current > 0 && 'animate-pulse')} />
            {streak.current >= 7 && (
              <Badge className="text-[10px] bg-orange-500/20 text-orange-500 border-0">
                🔥 On Fire!
              </Badge>
            )}
          </div>
        </div>

        {/* Week grid */}
        <div className="flex gap-1.5 mt-4">
          {Array.from({ length: 7 }).map((_, i) => {
            const daysAgo = 6 - i;
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            const dateStr = date.toISOString().split('T')[0];
            const isClean = streak.current > daysAgo || dateStr === streak.lastCleanDate;
            const isToday = daysAgo === 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn(
                  'h-7 w-full rounded-lg',
                  isClean ? 'bg-green-500' : 'bg-muted/50',
                  isToday && 'ring-2 ring-primary ring-offset-1'
                )} />
                <span className="text-[9px] text-muted-foreground">
                  {['S','M','T','W','T','F','S'][date.getDay()]}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ShieldAccountability() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<AccountabilityGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showUrgeTimer, setShowUrgeTimer] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [notifyOnOffense, setNotifyOnOffense] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadGroups();
  }, [user]);

  const loadGroups = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: memberships } = await supabase
        .from('accountability_group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        const { data: groupsData } = await supabase
          .from('accountability_groups')
          .select('*')
          .in('id', groupIds);
        setGroups(groupsData || []);
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createGroup = async () => {
    if (!user || !newGroupName) return;
    const inviteCode = `SH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const { data: group, error } = await supabase
      .from('accountability_groups')
      .insert({
        name: newGroupName,
        created_by: user.id,
        invite_code: inviteCode,
        notification_level: notifyOnOffense ? 'all' : 'none',
      })
      .select()
      .single();

    if (error) { toast.error('Failed to create group'); return; }

    await supabase.from('accountability_group_members').insert({
      group_id: group.id, user_id: user.id, role: 'admin'
    });

    toast.success('Group created!');
    setShowCreateDialog(false);
    setNewGroupName('');
    loadGroups();
  };

  const joinGroup = async () => {
    if (!user || !joinCode) return;
    const { data: group, error: findError } = await supabase
      .from('accountability_groups')
      .select('*')
      .eq('invite_code', joinCode.toUpperCase())
      .single();

    if (findError || !group) { toast.error('Invalid invite code'); return; }

    const { data: existing } = await supabase
      .from('accountability_group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .single();

    if (existing) { toast.error('Already a member'); return; }

    const { error: joinError } = await supabase
      .from('accountability_group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'member' });

    if (joinError) { toast.error('Failed to join'); return; }

    toast.success(`Joined ${group.name}!`);
    setShowJoinDialog(false);
    setJoinCode('');
    loadGroups();
  };

  const copyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    toast.success('Copied!');
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Streak Card ── */}
      <StreakCard />

      {/* ── Urge Surfing Timer ── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Urge Surfing Timer</CardTitle>
          </div>
          <CardDescription>
            মন চাইলে এই timer চালু করো — ৫ মিনিট পর urge কমে যাবে।
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showUrgeTimer ? (
            <UrgeSurfingTimer onComplete={() => {
              toast.success('💪 তুমি করে ফেললে! Urge পার করেছো।');
              setShowUrgeTimer(false);
            }} />
          ) : (
            <Button
              onClick={() => setShowUrgeTimer(true)}
              variant="outline"
              className="w-full rounded-2xl h-11 border-primary/30"
            >
              <Timer className="h-4 w-4 mr-2" />
              Start Urge Timer
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-2 gap-3">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="h-auto py-4 flex-col gap-2 rounded-2xl">
              <Plus className="h-5 w-5" />
              <span className="text-xs">Create Group</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Accountability Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  placeholder="e.g., Brothers in Faith"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div>
                  <p className="text-sm font-medium">Notify on offense</p>
                  <p className="text-xs text-muted-foreground">
                    Members get notified when someone is blocked
                  </p>
                </div>
                <Switch
                  checked={notifyOnOffense}
                  onCheckedChange={setNotifyOnOffense}
                />
              </div>
              <Button className="w-full rounded-xl" onClick={createGroup}>
                Create Group
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 rounded-2xl">
              <UserPlus className="h-5 w-5" />
              <span className="text-xs">Join Group</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join Accountability Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Invite Code</Label>
                <Input
                  placeholder="SH-ABC123"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  className="rounded-xl font-mono"
                />
              </div>
              <Button className="w-full rounded-xl" onClick={joinGroup}>
                Join Group
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Groups List ── */}
      {groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold mb-1">No Accountability Groups</h3>
            <p className="text-sm text-muted-foreground">
              বন্ধু বা পরিবারের সাথে group বানাও — একসাথে accountable থাকো
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map(group => (
          <Card key={group.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    {group.created_by === user?.id && (
                      <Badge variant="secondary" className="text-xs mt-0.5">
                        <Crown className="h-3 w-3 mr-1" />
                        Creator
                      </Badge>
                    )}
                  </div>
                </div>
                {group.notification_level !== 'none' && (
                  <Bell className="h-4 w-4 text-amber-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {group.can_view_shield_status && (
                  <Badge variant="outline" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View Status
                  </Badge>
                )}
                {group.can_approve_unlock && (
                  <Badge variant="outline" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" /> Approve Unlock
                  </Badge>
                )}
                {group.notification_level !== 'none' && (
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
                    <Bell className="h-3 w-3 mr-1" /> Offense Alerts
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                <span className="text-xs text-muted-foreground">Code:</span>
                  <code className="flex-1 font-mono font-bold text-sm">{group.invite_code || 'N/A'}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => group.invite_code && copyInviteCode(group.invite_code)}>
                  {copied === group.invite_code
                    ? <Check className="h-3.5 w-3.5" />
                    : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <Avatar key={i} className="h-7 w-7 border-2 border-background">
                      <AvatarFallback className="text-[10px]">U{i}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Group streak active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* How it works */}
      <Card className="bg-muted/30 border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">কীভাবে কাজ করে</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {[
            { icon: Flame, text: 'প্রতিদিন offense না করলে streak বাড়ে — ভাঙলে শূন্য থেকে শুরু' },
            { icon: Bell, text: 'Group এ কেউ offense করলে members notification পায় (opt-in)' },
            { icon: Timer, text: 'Urge Surfing Timer: ৫ মিনিট অপেক্ষা করলে urge কমে যায়' },
            { icon: Lock, text: 'Hard mode এ unlock করতে group approval লাগবে' },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-3 w-3 text-primary" />
              </div>
              <p>{text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}