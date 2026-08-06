import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Settings, Share2, BellRing, Crown, Flame, Star, Send, Home as HomeIcon, CalendarDays, Trophy, MessageSquare, Users, Sunrise, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGroupDetail, useGroupLeaderboard, MemberStats } from '@/hooks/useLifeosGroups';
import { useAdminGroupSettings } from '@/hooks/useAdminGroupSettings';
import { useWakeBroadcast, useCanLeaderWake, useTrustedWakers } from '@/hooks/useWakeBroadcast';
import { GroupChatTab } from './GroupChatTab';
import { GroupSettingsTab } from './GroupSettingsTab';

/* ============================================================
   Rise Group — Ultra Detail Screen
   Single-file, production-ready, dense, dark, sunrise-glow.
   ============================================================ */

interface Props { groupId: string; onBack: () => void; }

type BottomTab = 'home' | 'attendance' | 'rankings' | 'chat';
type Range = 'day' | 'week' | 'month';

/* ---------- Desk SVG (sleeping state) ---------- */
function DeskIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('w-full h-full', active ? 'text-[#FFD740]' : 'text-white/25')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16h12v14H22z" />
      <path d="M28 30v6" />
      <path d="M16 38h32" />
      <path d="M20 38v12M44 38v12" />
    </svg>
  );
}

/* ---------- Sunrise glow halo for woken members ---------- */
function SunriseGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
      <div className="absolute -inset-3 rounded-3xl bg-[radial-gradient(circle_at_50%_30%,rgba(255,215,64,0.35),rgba(255,140,40,0.12)_45%,transparent_70%)] blur-md animate-pulse" />
    </div>
  );
}

/* ---------- Format wake time ---------- */
function fmtWake(t: string | null | undefined) {
  if (!t) return '--:--';
  return t.slice(0, 5);
}

/* ---------- Member tile ---------- */
function MemberTile({ m, woken, isFirst, isMe, onWake }: {
  m: MemberStats; woken: boolean; isFirst: boolean; isMe: boolean; onWake: () => void;
}) {
  const initials = (m.display_name || 'M').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <button
      onClick={onWake}
      className={cn(
        'relative flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all active:scale-95',
        woken ? 'bg-[#1A1308]/60 ring-1 ring-[#FFD740]/30' : 'opacity-70',
      )}
    >
      {woken && <SunriseGlow />}
      {isFirst && woken && (
        <div className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-[#FFD740] text-black grid place-items-center shadow-lg shadow-amber-500/40">
          <Star className="h-3 w-3 fill-current" />
        </div>
      )}
      <div className={cn(
        'relative h-14 w-14 grid place-items-center',
        !woken && 'grayscale',
      )}>
        {woken ? (
          <Avatar className={cn('h-14 w-14 ring-2', woken ? 'ring-[#FFD740]/60 animate-pulse' : 'ring-white/10')}>
            {m.avatar_url && <AvatarImage src={m.avatar_url} />}
            <AvatarFallback className="bg-gradient-to-br from-[#FFD740] to-[#FF8C40] text-black font-extrabold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <DeskIcon active={false} />
        )}
      </div>
      <span className={cn('text-[11px] font-medium truncate max-w-[64px]', woken ? 'text-white' : 'text-white/40')}>
        {isMe ? 'You' : m.display_name}
      </span>
      <span className={cn(
        'text-[11px] font-bold tabular-nums',
        woken ? 'text-[#FFD740] drop-shadow-[0_0_6px_rgba(255,215,64,0.6)]' : 'text-white/30',
      )}>
        {woken ? fmtWake(m.wake_time) : '--:--'}
      </span>
    </button>
  );
}

/* ---------- Hardware back button hook ---------- */
function useAndroidBackFlash(active: boolean) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!active) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('backButton', () => {
          setFlash(true);
          setTimeout(() => setFlash(false), 600);
        });
        if (cancelled) handle.remove();
        else remove = () => handle.remove();
      } catch {/* web */}
    })();
    return () => { cancelled = true; remove?.(); };
  }, [active]);
  return flash;
}

/* ===================== MAIN ===================== */
export function GroupDetailUltra({ groupId, onBack }: Props) {
  const { user } = useAuth();
  const { data: group, isLoading } = useGroupDetail(groupId);
  const { data: adminSettings } = useAdminGroupSettings();
  const { data: leaderboard, isLoading: lbLoading } = useGroupLeaderboard(groupId, group?.type);
  const broadcast = useWakeBroadcast();
  const { data: canLeader } = useCanLeaderWake(groupId);
  const trusted = useTrustedWakers(groupId, user?.id);

  const [tab, setTab] = useState<'members' | 'chat' | 'settings'>('members');
  const [bottom, setBottom] = useState<BottomTab>('home');
  const [range, setRange] = useState<Range>('day');
  const [isLeader, setIsLeader] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  const backFlash = useAndroidBackFlash(true);

  /* hide main Rise mobile nav while inside group */
  useEffect(() => {
    document.body.classList.add('inside-group-fullscreen');
    const style = document.createElement('style');
    style.id = 'group-fullscreen-style';
    style.textContent = `body.inside-group-fullscreen [data-mobile-nav], body.inside-group-fullscreen nav[data-rise-nav]{display:none !important;}`;
    document.head.appendChild(style);
    return () => {
      document.body.classList.remove('inside-group-fullscreen');
      document.getElementById('group-fullscreen-style')?.remove();
    };
  }, []);

  /* role + count */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count }, { data: me }] = await Promise.all([
        supabase.from('lifeos_group_members').select('*', { count: 'exact', head: true }).eq('group_id', groupId),
        supabase.from('lifeos_group_members').select('role').eq('group_id', groupId).eq('user_id', user.id).maybeSingle(),
      ]);
      setMemberCount(count ?? 0);
      setIsLeader(['admin', 'owner', 'leader'].includes(me?.role ?? ''));
    })();
  }, [groupId, user?.id]);

  /* woken metrics */
  const woken = useMemo(() => (leaderboard ?? []).filter(m => !!m.wake_time), [leaderboard]);
  const firstWakerId = useMemo(() => {
    if (!woken.length) return null;
    return [...woken].sort((a, b) => (a.wake_time || '').localeCompare(b.wake_time || ''))[0]?.user_id ?? null;
  }, [woken]);

  const wakeAll = () => {
    if (!canLeader) { toast.error('Daily wake-all limit reached'); return; }
    broadcast.mutate({ group_id: groupId, kind: 'leader', message: 'উঠো — তোমার গ্রুপ অপেক্ষা করছে।' });
  };

  const wakeMember = (m: MemberStats) => {
    if (m.user_id === user?.id) return;
    broadcast.mutate({ group_id: groupId, kind: 'member', target_user_id: m.user_id });
  };

  const share = async () => {
    const url = `${window.location.origin}/groups?join=${(group as any)?.invite_code || ''}`;
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: group?.name, url });
      else { await navigator.clipboard.writeText(url); toast.success('Invite link copied'); }
    } catch {/* user cancelled */}
  };

  if (isLoading || !group) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] p-4 space-y-3">
        <Skeleton className="h-14 w-full bg-white/5" />
        <Skeleton className="h-72 w-full bg-white/5" />
      </div>
    );
  }

  const TypeIcon = group.type === 'rise' ? Sunrise : ShieldCheck;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0F] text-white flex flex-col overflow-hidden">
      {/* ===== HEADER ===== */}
      <header className="relative shrink-0 border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF8C40]/10 via-[#6C63FF]/5 to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-2 px-3 pt-3 pb-2">
          <button
            onClick={onBack}
            className={cn(
              'h-10 w-10 grid place-items-center rounded-xl transition-all',
              backFlash ? 'text-red-500 bg-red-500/20 scale-110' : 'text-white/80 hover:bg-white/5',
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-bold truncate flex items-center justify-center gap-1.5">
              <TypeIcon className="h-4 w-4 text-[#FFD740]" />
              {group.name}
            </h1>
            <p className="text-[10px] text-white/40 truncate">{group.goal}</p>
          </div>
          <button onClick={share} className="h-10 w-10 grid place-items-center rounded-xl text-white/70 hover:bg-white/5">
            <Share2 className="h-4.5 w-4.5" />
          </button>
          <button onClick={() => setTab('settings')} className="h-10 w-10 grid place-items-center rounded-xl text-white/70 hover:bg-white/5">
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* stat strip */}
        <div className="relative px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-white/60">
              <Users className="h-3.5 w-3.5" /> {memberCount} / {adminSettings?.max_capacity ?? 100}
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="text-[12px] font-semibold">
              <span className="text-[#FFD740] tabular-nums">{woken.length}</span>
              <span className="text-white/60"> জন উঠেছে today</span>
            </div>
          </div>
          {isLeader && group.type === 'rise' && (
            <Button
              size="sm"
              onClick={wakeAll}
              disabled={!canLeader || broadcast.isPending}
              className="h-8 px-3 bg-gradient-to-r from-[#FFD740] to-[#FF8C40] text-black font-bold hover:opacity-90 border-0"
            >
              <BellRing className="h-3.5 w-3.5 mr-1" /> Wake All
            </Button>
          )}
        </div>
      </header>

      {/* ===== BODY ===== */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {bottom === 'home' && (
          <div className="px-3 pt-3 pb-6">
            {/* inner tab nav */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-3">
              <TabsList className="w-full grid grid-cols-3 h-10 bg-white/5 border border-white/5">
                <TabsTrigger value="members" className="text-xs data-[state=active]:bg-[#6C63FF] data-[state=active]:text-white">Members</TabsTrigger>
                <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-[#6C63FF] data-[state=active]:text-white">Chat</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs data-[state=active]:bg-[#6C63FF] data-[state=active]:text-white">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="mt-3">
                {/* ===== 4-col MEMBER GRID ===== */}
                {lbLoading ? (
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24 bg-white/5" />)}
                  </div>
                ) : (leaderboard?.length ?? 0) === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40 text-sm">No members yet</div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {leaderboard!.map(m => (
                      <MemberTile
                        key={m.user_id}
                        m={m}
                        woken={!!m.wake_time}
                        isFirst={m.user_id === firstWakerId}
                        isMe={m.user_id === user?.id}
                        onWake={() => wakeMember(m)}
                      />
                    ))}
                  </div>
                )}

                <p className="mt-4 text-center text-[10px] text-white/30 px-6">
                  Tap a sleeping member to send a wake-up call (max 2/day per member)
                </p>
              </TabsContent>

              <TabsContent value="chat" className="mt-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-2 min-h-[60vh]">
                  <GroupChatTab groupId={groupId} chatEnabled={(group as any).chat_enabled !== false && (adminSettings?.chat_enabled_global ?? true)} />
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-3">
                <GroupSettingsTab group={group as any} isLeader={isLeader} onLeft={onBack} />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {bottom === 'attendance' && (
          <RangeView title="Attendance" range={range} onRange={setRange} loading={lbLoading} leaderboard={leaderboard ?? []} mode="attendance" />
        )}
        {bottom === 'rankings' && (
          <RangeView title="Rankings" range={range} onRange={setRange} loading={lbLoading} leaderboard={leaderboard ?? []} mode="rankings" firstWakerId={firstWakerId} />
        )}
        {bottom === 'chat' && (
          <div className="p-3 min-h-[calc(100vh-180px)]">
            <GroupChatTab groupId={groupId} chatEnabled={(group as any).chat_enabled !== false && (adminSettings?.chat_enabled_global ?? true)} />
          </div>
        )}
      </main>

      {/* ===== BOTTOM NAV ===== */}
      <nav className="shrink-0 border-t border-white/5 bg-[#0A0A0F]/95 backdrop-blur grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {([
          { k: 'home', l: 'Home', I: HomeIcon },
          { k: 'attendance', l: 'Attendance', I: CalendarDays },
          { k: 'rankings', l: 'Rankings', I: Trophy },
          { k: 'chat', l: 'Chat', I: MessageSquare },
        ] as const).map(({ k, l, I }) => {
          const active = bottom === k;
          return (
            <button
              key={k}
              onClick={() => setBottom(k)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors',
                active ? 'text-[#6C63FF]' : 'text-white/50 hover:text-white/80',
              )}
            >
              <I className={cn('h-5 w-5', active && 'drop-shadow-[0_0_8px_rgba(108,99,255,0.6)]')} />
              <span className="text-[10px] font-semibold">{l}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ===================== RANGE VIEW (Attendance / Rankings) ===================== */
function RangeView({
  title, range, onRange, loading, leaderboard, mode, firstWakerId,
}: {
  title: string; range: Range; onRange: (r: Range) => void;
  loading: boolean; leaderboard: MemberStats[];
  mode: 'attendance' | 'rankings'; firstWakerId?: string | null;
}) {
  const sorted = useMemo(() => {
    if (mode === 'rankings') {
      return [...leaderboard].sort((a, b) => {
        if (a.wake_time && b.wake_time) return a.wake_time.localeCompare(b.wake_time);
        if (a.wake_time) return -1;
        if (b.wake_time) return 1;
        return (b.streak_days ?? 0) - (a.streak_days ?? 0);
      });
    }
    return leaderboard;
  }, [leaderboard, mode]);

  return (
    <div className="px-3 pt-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">{title}</h2>
        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5">
          {(['day', 'week', 'month'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => onRange(r)}
              className={cn(
                'px-3 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors',
                range === r ? 'bg-[#6C63FF] text-white' : 'text-white/50',
              )}
            >{r}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 bg-white/5" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40 text-sm">No data yet</div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((m, i) => {
            const initials = (m.display_name || 'M').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
            const rankColor = i === 0 ? 'text-[#FFD740]' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-white/40';
            return (
              <li key={m.user_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className={cn('w-6 text-center text-sm font-extrabold tabular-nums', rankColor)}>{i + 1}</span>
                <Avatar className="h-9 w-9 ring-1 ring-white/10">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                  <AvatarFallback className="bg-gradient-to-br from-[#6C63FF] to-[#9F7AEA] text-white text-xs font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                    {m.display_name}
                    {m.user_id === firstWakerId && <Star className="h-3.5 w-3.5 text-[#FFD740] fill-current" />}
                    {i === 0 && <Crown className="h-3.5 w-3.5 text-[#FFD740] fill-current" />}
                  </p>
                  <p className="text-[11px] text-white/40 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-rose-400" />{m.streak_days ?? 0}d streak</span>
                  </p>
                </div>
                <div className={cn('text-sm font-bold tabular-nums', m.wake_time ? 'text-[#FFD740]' : 'text-white/30')}>
                  {m.wake_time ? m.wake_time.slice(0, 5) : '--:--'}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}