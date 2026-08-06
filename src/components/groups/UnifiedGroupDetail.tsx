/**
 * UnifiedGroupDetail — single YPT-style shell shared by both LifeOS Groups
 * and Rise Group Wake. Each surface maps its data into UnifiedMember[].
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GroupWakeScreen } from '@/components/rise/GroupWakeScreen';
import { GroupWakeMemberGrid } from '@/components/rise/GroupWakeMemberGrid';
import {
  GroupWakeAttendance,
  type AttendanceMember,
  type AttendanceDayRecord,
} from '@/components/rise/GroupWakeAttendance';
import {
  GroupWakeRankings,
  type RankingMember,
} from '@/components/rise/GroupWakeRankings';
import { GroupWakeChat, type ChatMessage } from '@/components/rise/GroupWakeChat';
import { useGroupChat, useSendChatMessage } from '@/hooks/useGroupChat';
import { useGroupDetail } from '@/hooks/useLifeosGroups';
import { useWakeBroadcast } from '@/hooks/useWakeBroadcast';
import { MemberDetailSheet } from './MemberDetailSheet';
import { GroupSettingsSheet } from './GroupSettingsSheet';
import type { GroupWakeMemberStatus, WakeMemberStatusKind } from '@/hooks/useGroupWakeAlarm';
import { toast } from 'sonner';

export interface UnifiedMember {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
  role?: string | null;
  seconds_today?: number;
  goal_met?: boolean;
  is_active?: boolean;
  wake_status?: WakeMemberStatusKind;
  region_label?: string;
  week_seconds?: number[];
  week_checked?: boolean[];
  /** ISO strings of first wake_at per day Mon..Sun (null if didn't wake) */
  week_wake_at?: (string | null)[];
  /** ISO wake events used for historical attendance/rank filters. */
  wake_events?: string[];
  /** YYYY-MM-DD keyed seconds, used by Shield/focus groups for history. */
  daily_seconds?: Record<string, number>;
  woke_at_today?: string | null;
  streak_days?: number;
  total_wakes_30d?: number;
}

interface Props {
  groupId: string;
  groupName: string;
  members: UnifiedMember[];
  goalSeconds?: number;
  goalLabel?: string;
  inviteCode?: string;
  onBack?: () => void;
  onSendWakeUp?: (member: UnifiedMember) => void;
}

function isoWeekLabel(d = new Date()): string {
  const day = d.getDay();
  const offsetToMon = (day + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - offsetToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = (x: Date) => `${x.getMonth() + 1}/${x.getDate()}`;
  return `${f(mon)} ~ ${f(sun)}`;
}
function dailyDateLabel(d = new Date()): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function startOfDay(d = new Date()): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + days); return x;
}
function startOfIsoWeekDate(d = new Date()): Date {
  const day = d.getDay();
  const offsetToMon = (day + 6) % 7;
  return addDays(startOfDay(d), -offsetToMon);
}
function dayKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}
function secondsFromWakeForDate(wokeAt: string | null | undefined, date: Date): number {
  if (!wokeAt) return 0;
  const woke = new Date(wokeAt);
  if (dayKey(woke) !== dayKey(date)) return 0;
  const end = dayKey(date) === dayKey(new Date()) ? new Date() : addDays(startOfDay(date), 1);
  return Math.max(0, Math.floor((end.getTime() - woke.getTime()) / 1000));
}
function firstWakeForDate(events: string[] | undefined, date: Date): string | null {
  return (events ?? [])
    .filter((e) => dayKey(new Date(e)) === dayKey(date))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
}

export function UnifiedGroupDetail({
  groupId,
  groupName,
  members,
  goalSeconds = 6 * 3600,
  goalLabel,
  inviteCode,
  onBack,
  onSendWakeUp,
}: Props) {
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const { data: group } = useGroupDetail(groupId);
  const broadcast = useWakeBroadcast();

  const [selectedMember, setSelectedMember] = useState<UnifiedMember | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'rankings' | 'invite' | 'chat'>('home');
  const [weekAnchor, setWeekAnchor] = useState(() => startOfIsoWeekDate(new Date()));
  const [rankDate, setRankDate] = useState(() => startOfDay(new Date()));

  // ── Chat ────────────────────────────────────────────────────────────────
  const { data: chatRows = [] } = useGroupChat(groupId);
  const sendMsg = useSendChatMessage(groupId);

  const chatMessages: ChatMessage[] = useMemo(
    () =>
      chatRows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        full_name: r.author_name ?? 'Anonymous',
        text: r.content,
        sent_at: r.created_at,
        is_system: r.is_system,
        deleted_for_everyone: !!(r as any).deleted_at,
      })),
    [chatRows],
  );

  // Unread chat tracking via localStorage last-seen timestamp per (group, user).
  const seenKey = `chat_last_seen_${groupId}_${myId}`;
  const [lastSeen, setLastSeen] = useState<number>(() => {
    try { return Number(localStorage.getItem(seenKey) || 0); } catch { return 0; }
  });
  useEffect(() => {
    if (activeTab === 'chat' && chatMessages.length > 0) {
      const ts = new Date(chatMessages[chatMessages.length - 1].sent_at).getTime();
      try { localStorage.setItem(seenKey, String(ts)); } catch {}
      setLastSeen(ts);
    }
  }, [activeTab, chatMessages, seenKey]);
  const unreadCount = useMemo(
    () => chatMessages.filter(m => m.user_id !== myId && new Date(m.sent_at).getTime() > lastSeen).length,
    [chatMessages, lastSeen, myId],
  );

  // ── Wake-up handler (shared by grid + detail sheet) ─────────────────────
  function handleWakeUp(member: UnifiedMember) {
    if (onSendWakeUp) { onSendWakeUp(member); return; }
    broadcast.mutate({ group_id: groupId, kind: 'member', target_user_id: member.user_id });
  }

  // ── Home grid ───────────────────────────────────────────────────────────
  const gridStatuses: GroupWakeMemberStatus[] = useMemo(
    () =>
      members.map((m) => ({
        id: m.user_id,
        session_id: groupId,
        user_id: m.user_id,
        group_id: groupId,
        status: (m.wake_status ?? (m.goal_met ? 'mission_done' : m.is_active ? 'active' : 'pending')) as any,
        status_text: null,
        mission_completed_at: m.woke_at_today ?? (m.goal_met ? new Date().toISOString() : null),
        status_updated_at: new Date().toISOString(),
        wake_up_calls_received: 0,
      })),
    [members, groupId],
  );

  const gridMembers = useMemo(
    () => members.map((m) => ({
      user_id: m.user_id,
      full_name: m.full_name,
      avatar_url: m.avatar_url ?? null,
      woke_at_today: m.woke_at_today ?? null,
    })),
    [members],
  );

  // ── Rankings ────────────────────────────────────────────────────────────
  const rankingMembers: RankingMember[] = useMemo(() => {
    const targetKey = dayKey(rankDate);
    const withSeconds = members.map((m) => {
      const directSeconds = m.daily_seconds?.[targetKey];
      const wakeAt = targetKey === dayKey(new Date()) ? m.woke_at_today : firstWakeForDate(m.wake_events, rankDate);
      const seconds = typeof directSeconds === 'number'
        ? directSeconds
        : wakeAt ? secondsFromWakeForDate(wakeAt, rankDate) : targetKey === dayKey(new Date()) ? (m.seconds_today ?? 0) : 0;
      return { ...m, rank_seconds: seconds, rank_wake_at: wakeAt };
    });
    const sorted = [...withSeconds].sort((a, b) => (b.rank_seconds ?? 0) - (a.rank_seconds ?? 0));
    return sorted.map((m, i) => ({
      user_id: m.user_id,
      full_name: m.full_name,
      rank: i + 1,
      wake_seconds: m.rank_seconds ?? 0,
      is_active: (m.rank_seconds ?? 0) > 0 || !!m.rank_wake_at,
      goal_met: !!m.rank_wake_at || (m.rank_seconds ?? 0) >= goalSeconds,
      is_me: m.user_id === myId,
      region_label: m.region_label,
    }));
  }, [members, myId, rankDate, goalSeconds]);

  const totalSeconds = rankingMembers.reduce((s, m) => s + m.wake_seconds, 0);
  const avgSeconds = rankingMembers.length ? Math.round(totalSeconds / rankingMembers.length) : 0;
  const myRank = rankingMembers.find((m) => m.is_me)?.rank ?? null;
  const myGoalMet = rankingMembers.find((m) => m.is_me)?.goal_met ?? false;

  // ── Attendance ──────────────────────────────────────────────────────────
  const attendanceMembers: AttendanceMember[] = useMemo(() => {
    const isCurrentWeek = dayKey(weekAnchor) === dayKey(startOfIsoWeekDate(new Date()));
    const weekTotal = (m: UnifiedMember) => Array.from({ length: 7 }, (_, idx) => {
      const date = addDays(weekAnchor, idx);
      const directSeconds = m.daily_seconds?.[dayKey(date)];
      if (typeof directSeconds === 'number') return directSeconds;
      const fallbackWakeAt = isCurrentWeek ? m.week_wake_at?.[idx] : null;
      const wakeAt = firstWakeForDate(m.wake_events, date) ?? fallbackWakeAt;
      return secondsFromWakeForDate(wakeAt, date);
    }).reduce((s, v) => s + v, 0);
    const sorted = [...members].sort((a, b) => weekTotal(b) - weekTotal(a));
    return sorted.map((m, i) => {
      const records = Array.from({ length: 7 }, (_, idx) => {
        const date = addDays(weekAnchor, idx);
        const directSeconds = m.daily_seconds?.[dayKey(date)];
        if (typeof directSeconds === 'number') return { seconds: directSeconds, checked: directSeconds >= goalSeconds };
        const fallbackWakeAt = isCurrentWeek ? m.week_wake_at?.[idx] : null;
        const wakeAt = firstWakeForDate(m.wake_events, date) ?? fallbackWakeAt;
        const seconds = secondsFromWakeForDate(wakeAt, date);
        return { seconds, checked: seconds > 0 };
      });
      const days: AttendanceDayRecord[] = records.map((record, idx) => ({
        date: dayKey(addDays(weekAnchor, idx)),
        wake_seconds: record.seconds,
        checked: record.checked,
      }));
      return {
        user_id: m.user_id,
        full_name: m.full_name,
        rank: i + 1,
        total_seconds: records.reduce((s, v) => s + v.seconds, 0),
        days,
        is_me: m.user_id === myId,
      };
    });
  }, [members, myId, weekAnchor, goalSeconds]);

  const totalAttendance = attendanceMembers.reduce(
    (s, m) => s + m.days.filter((d) => d.checked).length, 0,
  );
  const maxPossible = attendanceMembers.length * 7;
  const averagePct = maxPossible ? Math.round((totalAttendance / maxPossible) * 100) : 0;
  const myAttRank = attendanceMembers.find((m) => m.is_me)?.rank ?? null;

  // ── Invite ──────────────────────────────────────────────────────────────
  const inviteLink = inviteCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?join=${inviteCode}` : '';
  async function shareInvite() {
    if (!inviteCode) return;
    const text = `Join my "${groupName}" group on Life OS: ${inviteLink}`;
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: groupName, text, url: inviteLink });
        return;
      }
    } catch { /* user cancelled */ }
    try { await navigator.clipboard?.writeText(inviteLink); toast.success('Invite link copied'); }
    catch { toast.error('Could not copy link'); }
  }
  const inviteContent = (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center h-full min-h-[300px]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted border border-border">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 text-primary">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </div>
      <div>
        <p className="text-foreground font-semibold mb-1">Invite members</p>
        <p className="text-sm text-muted-foreground">
          {inviteCode ? 'Tap the code to copy, or share the link' : 'No invite code available'}
        </p>
      </div>
      {inviteCode && (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(inviteCode);
              toast.success('Invite code copied');
            }}
            className="rounded-full bg-primary text-primary-foreground font-semibold px-6 py-2 text-sm hover:bg-primary/90 transition-colors tracking-widest"
          >
            {inviteCode}
          </button>
          <button
            onClick={shareInvite}
            className="rounded-full border border-border bg-card text-foreground font-medium px-6 py-2 text-sm hover:bg-muted transition-colors"
          >
            Share invite link
          </button>
          <p className="text-[10px] text-muted-foreground break-all px-2">{inviteLink}</p>
        </div>
      )}
    </div>
  );

  const selectedIsMe = selectedMember?.user_id === myId;
  const pinnedAnnouncement = ((group as any)?.pinned_announcement as string | null | undefined)?.trim();

  return (
    <>
      <GroupWakeScreen
        groupName={groupName}
        onBack={onBack}
        onOpenSettings={() => setSettingsOpen(true)}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as any)}
        pinnedBanner={{
          text: unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''} in group chat` : pinnedAnnouncement || 'Group discussion',
          count: unreadCount || undefined,
          onClick: () => setActiveTab('chat'),
        }}
        chatUnread={unreadCount}
        homeContent={
          <div className="bg-background min-h-full p-3">
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Active</span>
              <span className="text-primary">
                {members.filter((m) => m.is_active).length} members
              </span>
            </div>
            <GroupWakeMemberGrid
              members={gridMembers}
              statuses={gridStatuses}
              currentUserId={myId}
              onSendWakeUp={(m) => {
                const target = members.find((x) => x.user_id === m.user_id);
                if (target) handleWakeUp(target);
              }}
              onCardClick={(m) => {
                const target = members.find((x) => x.user_id === m.user_id);
                if (target) setSelectedMember(target);
              }}
            />
          </div>
        }
        attendanceContent={
          <GroupWakeAttendance
            weekLabel={isoWeekLabel(weekAnchor)}
            goalLabel={goalLabel ?? 'Goal'}
            totalAttendance={totalAttendance}
            averageAttendancePct={averagePct}
            myRank={myAttRank}
            members={attendanceMembers}
            onPrevWeek={() => setWeekAnchor((d) => addDays(d, -7))}
            onNextWeek={() => setWeekAnchor((d) => {
              const next = addDays(d, 7);
              const current = startOfIsoWeekDate(new Date());
              return next.getTime() > current.getTime() ? current : next;
            })}
          />
        }
        rankingsContent={
          <GroupWakeRankings
            dateLabel={dailyDateLabel(rankDate)}
            periodLabel="Daily"
            goalLabel={goalLabel ?? 'Goal'}
            totalSeconds={totalSeconds}
            averageSeconds={avgSeconds}
            myRank={myRank}
            myGoalMet={myGoalMet}
            members={rankingMembers}
            onPrevDay={() => setRankDate((d) => addDays(d, -1))}
            onNextDay={() => setRankDate((d) => {
              const next = addDays(d, 1);
              const today = startOfDay(new Date());
              return next.getTime() > today.getTime() ? today : next;
            })}
          />
        }
        inviteContent={inviteContent}
        chatContent={
          <GroupWakeChat
            groupName={groupName}
            messages={chatMessages}
            currentUserId={myId}
            onSend={(text) => sendMsg.mutate({ content: text })}
            groupId={groupId}
          />
        }
      />

      <MemberDetailSheet
        open={!!selectedMember}
        onOpenChange={(v) => { if (!v) setSelectedMember(null); }}
        member={selectedMember}
        isMe={selectedIsMe}
        onWakeUp={(m) => { handleWakeUp(m); setSelectedMember(null); }}
        wakeLoading={broadcast.isPending}
      />

      <GroupSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        group={(group as any) ?? { id: groupId, name: groupName, description: null, invite_code: inviteCode ?? '', created_by: '' }}
        members={members}
        currentUserId={myId}
        onLeft={() => { setSettingsOpen(false); onBack?.(); }}
      />

    </>
  );
}
