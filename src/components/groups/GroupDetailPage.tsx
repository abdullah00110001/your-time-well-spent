import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LifeosGroupType, useGroupDetail, useGroupLeaderboard } from '@/hooks/useLifeosGroups';
import { UnifiedGroupDetail, type UnifiedMember } from './UnifiedGroupDetail';
import { useWakeSignal } from '@/hooks/useWakeSignal';
import { useRiseGroupLiveData } from '@/hooks/useRiseGroupLiveData';

interface Props { groupId: string; onBack: () => void; }

/**
 * GroupDetailPage — LifeOS Groups detail screen.
 * Renders the unified YPT-style group shell (Home / Attendance / Rankings / Invite / Chat)
 * with real leaderboard data.
 */
export function GroupDetailPage({ groupId, onBack }: Props) {
  const { sendWakeSignal } = useWakeSignal();
  // Hide Rise/global mobile nav while inside a group (matches old Ultra behaviour).
  useEffect(() => {
    document.body.classList.add('inside-group-fullscreen');
    const style = document.createElement('style');
    style.id = 'group-fullscreen-style';
    style.textContent =
      'body.inside-group-fullscreen [data-mobile-nav],' +
      'body.inside-group-fullscreen nav[data-rise-nav]{display:none !important;}';
    document.head.appendChild(style);
    return () => {
      document.body.classList.remove('inside-group-fullscreen');
      document.getElementById('group-fullscreen-style')?.remove();
    };
  }, []);

  const { data: group, isLoading: gLoading } = useGroupDetail(groupId);
  const { data: leaderboard, isLoading: lLoading } = useGroupLeaderboard(
    groupId,
    group?.type as LifeosGroupType | undefined,
  );
  // Rise-specific live data (real woke_at times, week grid) — only used when type==='rise'.
  const isRiseGroup = group?.type === 'rise';
  const { members: riseMembers } = useRiseGroupLiveData(isRiseGroup ? groupId : undefined);

  if (gLoading || !group || lLoading) {
    return (
      <div className="fixed inset-0 z-[60] bg-background p-4 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isRise = group.type === 'rise';
  const goalSeconds = isRise ? 6 * 3600 : 2 * 3600;

  // For Rise groups, prefer the real live data hook (uses rise_wake_events for
  // accurate seconds_today + per-day week grid). For Shield groups, map from
  // the leaderboard query.
  const members: UnifiedMember[] = isRise
    ? riseMembers
    : (leaderboard ?? []).map((m) => ({
        user_id: m.user_id,
        full_name: m.display_name,
        avatar_url: m.avatar_url ?? null,
        daily_seconds: m.daily_seconds ?? {},
        seconds_today: (m.focus_minutes ?? 0) * 60,
        goal_met: (m.focus_minutes ?? 0) * 60 >= goalSeconds,
        is_active: m.status === 'focusing',
        wake_status: ((m.focus_minutes ?? 0) > 0 ? 'active' : 'pending') as any,
      }));

  return (
    <div className="fixed inset-0 z-[60] bg-background">
      <UnifiedGroupDetail
        groupId={groupId}
        groupName={group.name}
        members={members}
        goalSeconds={goalSeconds}
        goalLabel={isRise ? '6h wake goal' : '2h focus goal'}
        inviteCode={group.invite_code}
        onBack={onBack}
        onSendWakeUp={(m) => {
          sendWakeSignal(m.user_id, groupId, 'gentle');
        }}
      />
    </div>
  );
}
