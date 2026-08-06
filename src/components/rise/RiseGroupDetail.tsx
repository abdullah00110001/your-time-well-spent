/**
 * RiseGroupDetail — Rise wake group detail page.
 * Renders the unified YPT-style group shell with REAL data from
 * lifeos_group_members + rise_wake_events.
 */

import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { isNative } from '@/lib/capacitor/platform';
import { UnifiedGroupDetail } from '@/components/groups/UnifiedGroupDetail';
import { useRiseGroupLiveData } from '@/hooks/useRiseGroupLiveData';
import { useGroupDetail } from '@/hooks/useLifeosGroups';
import { Skeleton } from '@/components/ui/skeleton';

interface RiseGroupDetailProps {
  groupId: string;
  groupName?: string;
  onExit?: () => void;
}

export default function RiseGroupDetail({ groupId, groupName, onExit }: RiseGroupDetailProps) {
  const [, setBackFlash] = useState(false);
  const { data: group } = useGroupDetail(groupId);
  const { members, isLoading } = useRiseGroupLiveData(groupId);

  // Android hardware-back flash (no-op nav, just visual feedback).
  useEffect(() => {
    if (!isNative) return;
    let off: (() => void) | undefined;
    let t: ReturnType<typeof setTimeout> | undefined;
    CapacitorApp.addListener('backButton', () => {
      setBackFlash(true);
      if (t) clearTimeout(t);
      t = setTimeout(() => setBackFlash(false), 600);
    }).then((h) => { off = () => h.remove(); });
    return () => { if (t) clearTimeout(t); off?.(); };
  }, []);

  if (isLoading && members.length === 0) {
    return (
      <div className="bg-background min-h-screen p-4 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <UnifiedGroupDetail
      groupId={groupId}
      groupName={groupName ?? group?.name ?? 'Rise Group'}
      members={members}
      goalSeconds={6 * 3600}
      goalLabel="6h wake goal"
      inviteCode={group?.invite_code}
      onBack={onExit}
    />
  );
}
