import { useEffect, useState } from 'react';
import { ArrowLeft, Home, CalendarDays, BarChart2, UserPlus, MessageCircle, Settings, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import all sub-screens
// (In your project, import from their respective files)
// import { GroupWakeMemberGrid } from './GroupWakeMemberGrid';
// import { GroupWakeAttendance } from './GroupWakeAttendance';
// import { GroupWakeRankings } from './GroupWakeRankings';
// import { GroupWakeChat } from './GroupWakeChat';

// ── Tab definition ─────────────────────────────────────────────────────────

type Tab = 'home' | 'attendance' | 'rankings' | 'invite' | 'chat';

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'home',       label: 'Home',       Icon: Home },
  { id: 'attendance', label: 'Attendance', Icon: CalendarDays },
  { id: 'rankings',   label: 'Rankings',   Icon: BarChart2 },
  { id: 'invite',     label: 'Invite',     Icon: UserPlus },
  { id: 'chat',       label: 'Chat',       Icon: MessageCircle },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  groupName: string;
  groupSubtitle?: string;
  homeContent: React.ReactNode;
  attendanceContent: React.ReactNode;
  rankingsContent: React.ReactNode;
  inviteContent?: React.ReactNode;
  chatContent: React.ReactNode;
  defaultTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  /** Optional: unread chat count */
  chatUnread?: number;
  onBack?: () => void;
  onOpenSettings?: () => void;
  /** Pinned discussion / announcement shown above the active tab. */
  pinnedBanner?: { text: string; count?: number; onClick?: () => void };
  /** When provided, tab state is controlled by the parent. */
  activeTab?: Tab;
}

// ── Main ───────────────────────────────────────────────────────────────────

export function GroupWakeScreen({
  groupName,
  groupSubtitle,
  homeContent,
  attendanceContent,
  rankingsContent,
  inviteContent,
  chatContent,
  defaultTab = 'home',
  onTabChange,
  chatUnread = 0,
  onBack,
  onOpenSettings,
  pinnedBanner,
  activeTab,
}: Props) {
  const [internalActive, setInternalActive] = useState<Tab>(defaultTab);
  const active = activeTab ?? internalActive;
  const [backFlash, setBackFlash] = useState(false);

  // Android hardware back → flash red, don't navigate.
  useEffect(() => {
    let remove: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const h = await App.addListener('backButton', () => {
          setBackFlash(true);
          setTimeout(() => setBackFlash(false), 600);
        });
        if (cancelled) h.remove(); else remove = () => h.remove();
      } catch { /* web */ }
    })();
    return () => { cancelled = true; remove?.(); };
  }, []);

  function go(tab: Tab) {
    if (activeTab === undefined) setInternalActive(tab);
    onTabChange?.(tab);
  }

  const content: Record<Tab, React.ReactNode> = {
    home:       homeContent,
    attendance: attendanceContent,
    rankings:   rankingsContent,
    invite:     inviteContent ?? <InvitePlaceholder />,
    chat:       chatContent,
  };

  return (
    <div className="flex flex-col bg-background text-foreground h-full w-full overflow-hidden">

      {/* ── Header ── */}
      <div className="relative shrink-0 border-b border-border bg-card">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
        <div className="relative flex items-center gap-2 px-3 py-3">
          <button
            onClick={onBack}
            className={cn(
              'h-10 w-10 grid place-items-center rounded-xl transition-all active:scale-95',
              backFlash ? 'text-destructive bg-destructive/20 scale-110' : 'text-foreground/80 hover:bg-muted',
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-bold text-foreground tracking-wide truncate">{groupName}</h1>
            {groupSubtitle && (
              <p className="text-[10px] text-muted-foreground truncate">{groupSubtitle}</p>
            )}
          </div>
          <button
            onClick={onOpenSettings}
            className="h-10 w-10 grid place-items-center rounded-xl text-foreground/70 hover:bg-muted active:scale-95 transition-all"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
        {pinnedBanner && (
          <button
            onClick={pinnedBanner.onClick}
            className="relative mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
          >
            <Megaphone className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 truncate text-sm text-foreground/85">{pinnedBanner.text}</span>
            {!!pinnedBanner.count && (
              <span className="grid h-6 min-w-6 place-items-center rounded-md bg-muted px-1.5 text-[11px] font-semibold text-foreground/80">
                {pinnedBanner.count}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {content[active]}
      </div>

      {/* ── Bottom nav ── */}
      <div className="border-t border-border bg-card px-2 py-1.5 shrink-0">
        <div className="flex items-center justify-around">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = active === id;
            const showBadge = id === 'chat' && chatUnread > 0;
            return (
              <button
                key={id}
                onClick={() => go(id)}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
                {showBadge && (
                  <span className="absolute -top-0.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {chatUnread > 9 ? '9+' : chatUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Invite placeholder ─────────────────────────────────────────────────────

function InvitePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center h-full min-h-[300px]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted border border-border">
        <UserPlus className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="text-foreground font-semibold mb-1">Invite members</p>
        <p className="text-sm text-muted-foreground">Share a link to grow your wake group</p>
      </div>
      <button className="rounded-full bg-primary text-primary-foreground font-semibold px-6 py-2 text-sm hover:bg-primary/90 transition-colors">
        Copy invite link
      </button>
    </div>
  );
}
