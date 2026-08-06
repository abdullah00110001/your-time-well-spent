import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Users, MessageSquare, Settings, Sunrise, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGroupDetail } from '@/hooks/useLifeosGroups';
import { useAdminGroupSettings } from '@/hooks/useAdminGroupSettings';
import { GroupMembersTab } from './GroupMembersTab';
import { GroupChatTab } from './GroupChatTab';
import { GroupSettingsTab } from './GroupSettingsTab';

interface Props { groupId: string; onBack: () => void; }

export function GroupDetailV2({ groupId, onBack }: Props) {
  const { user } = useAuth();
  const { data: group, isLoading } = useGroupDetail(groupId);
  const { data: adminSettings } = useAdminGroupSettings();
  const [memberCount, setMemberCount] = useState(0);
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;
    (async () => {
      const { count } = await supabase
        .from('lifeos_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);
      setMemberCount(count ?? 0);
      const { data: me } = await supabase
        .from('lifeos_group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsLeader(['admin', 'owner', 'leader'].includes(me?.role ?? ''));
    })();
  }, [groupId, user?.id]);

  if (isLoading || !group) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const chatGloballyEnabled = adminSettings?.chat_enabled_global ?? true;
  const chatEnabled = chatGloballyEnabled && (group as any).chat_enabled !== false;
  const TypeIcon = group.type === 'rise' ? Sunrise : ShieldCheck;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero */}
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-amber-500/5 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 p-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.type === 'rise' ? 'Rise circle' : 'Shield circle'}
            </p>
          </div>
          <div className="px-5 pb-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 grid place-items-center shrink-0">
                <TypeIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight truncate">{group.name}</h1>
                <p className="text-xs text-muted-foreground line-clamp-2">{group.goal}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {memberCount} / {adminSettings?.max_capacity ?? 100}
              </span>
              {isLeader && <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">Leader</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 pb-24">
        <Tabs defaultValue="members">
          <TabsList className="w-full grid grid-cols-3 h-11">
            <TabsTrigger value="members" className="text-xs">
              <Users className="h-4 w-4 mr-1.5" /> Members
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">
              <MessageSquare className="h-4 w-4 mr-1.5" /> Chat
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              <Settings className="h-4 w-4 mr-1.5" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4">
            <GroupMembersTab groupId={groupId} type={group.type} isLeader={isLeader} />
          </TabsContent>
          <TabsContent value="chat" className="mt-4">
            <GroupChatTab groupId={groupId} chatEnabled={chatEnabled} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <GroupSettingsTab group={group as any} isLeader={isLeader} onLeft={onBack} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}