/**
 * ============================================================================
 * FOCUS SHIELD — "THE LANTERN KEEPER"  (design rationale)
 * ============================================================================
 * METAPHOR — A lantern you keep lit through the night.
 *   Every day you are given one reservoir of oil: your attention. Distracting
 *   apps burn it; guarded hours preserve it. The flame does not punish you when
 *   it dims — it simply shows how much light is left, and it grows steadier the
 *   longer you keep the streak. A keeper tends a light; a warden guards a cell.
 *   Focus Shield is a keeper. That single decision drives every screen here:
 *   no red alarms, no shame meters, no "you failed today" copy.
 *
 * WHY THIS PALETTE — Deep ink (a dark room) + warm ember amber (the flame) +
 *   a calm sage for "kept/on-track". Warm-on-dark is comfortable at 11pm, which
 *   is exactly when this app gets opened. The competitor look (white cards,
 *   blue chips, red blocks) is structurally impossible in this palette.
 *
 * WHY IT FEELS DIFFERENT — Instead of a list of usage cards, the Home screen is
 *   a single object: the Reservoir, a circular oil gauge with a live flame whose
 *   glow scales with what's left. Beneath it, the "Burn Line" shows the day as a
 *   continuous horizontal band of light and shadow, not bars. Reports uses a
 *   ranked "wick list" with oil-drain rails. Time-lapse plays the whole day back
 *   hour by hour. Everything is one visual family: light, oil, burning.
 *
 * TYPOGRAPHY — Numbers are a different species from words. All quantities
 *   (minutes, streak, score, %) use the mono face with tabular figures so they
 *   feel measured and instrument-like; labels are small, uppercase and tracked
 *   like the etched markings on a lantern; body copy stays in the app sans face
 *   so it never becomes clinical.
 *
 * The `.lantern` class scopes the entire palette so the rest of LifeOS is
 * untouched, and every colour is a semantic token (no hardcoded hex here).
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  Moon,
  Lock,
  Sparkles,
  ChevronRight,
  Users,
  Settings as SettingsIcon,
  Home as HomeIcon,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Globe,
  Type,
  Film,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useScreenTime } from '@/hooks/useScreenTime';
import { AegisRings, AegisLegend, LatticePanel, type AegisArc } from './AegisRings';

/* ------------------------------------------------------------------ utils */

const fmt = (m: number) => {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

/* ------------------------------------------------- identity: the reservoir */

interface ReservoirProps {
  /** 0..1 — how much of the day's attention budget is still unspent */
  level: number;
  usedMinutes: number;
  budgetMinutes: number;
}

function Reservoir({ level, usedMinutes, budgetMinutes }: ReservoirProps) {
  const clamped = Math.max(0, Math.min(1, level));
  const R = 78;
  const C = 2 * Math.PI * R;
  const dash = C * clamped;

  return (
    <div className="relative mx-auto grid h-[236px] w-[236px] place-items-center">
      <div
        className="lantern-glow absolute inset-6 rounded-full"
        style={{ opacity: 0.18 + clamped * 0.42 }}
        aria-hidden
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
        {/* etched hour ticks, like a lantern collar */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const r1 = R + 12;
          const r2 = R + (i % 6 === 0 ? 19 : 15);
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * r1}
              y1={100 + Math.sin(a) * r1}
              x2={100 + Math.cos(a) * r2}
              y2={100 + Math.sin(a) * r2}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={i % 6 === 0 ? 0.65 : 0.25}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <div className="relative z-10 flex flex-col items-center">
        <Flame
          className="lantern-breathe mb-1 h-7 w-7 text-primary"
          strokeWidth={1.6}
          style={{ opacity: 0.5 + clamped * 0.5 }}
        />
        <span className="font-mono text-[2.6rem] font-bold leading-none tabular-nums text-foreground">
          {Math.round(clamped * 100)}
          <span className="text-xl text-muted-foreground">%</span>
        </span>
        <span className="lantern-label mt-2 !mb-0">oil remaining</span>
        <span className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
          {fmt(usedMinutes)} burned / {fmt(budgetMinutes)}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------- identity: the burn line bar */

function BurnLine({ segments }: { segments: { label: string; minutes: number }[] }) {
  const total = segments.reduce((s, x) => s + x.minutes, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="shield-fill h-full transition-all duration-700"
            style={{
              width: `${(s.minutes / total) * 100}%`,
              background: `hsl(var(--primary) / ${0.95 - i * 0.16})`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: `hsl(var(--primary) / ${0.95 - i * 0.16})` }}
            />
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-foreground">{fmt(s.minutes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ identity: wick row */

function WickRow({ name, minutes, max, rank }: { name: string; minutes: number; max: number; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-5 font-mono text-xs tabular-nums text-muted-foreground">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmt(minutes)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="shield-fill h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${Math.max(4, (minutes / (max || 1)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('lantern-panel p-4', className)}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="lantern-label !mb-0">{title}</h2>
          {hint && <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------ HOME SCREEN */

const readList = (key: string): any[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

function HomeScreen({
  streak,
  score,
  mode,
  onStrict,
  onOpenModes,
  onOpenReports,
  onNavigate,
  reelsBlocked,
  adultBlocked,
  onReelsToggle,
  onAdultToggle,
}: {
  streak: number;
  score: number;
  mode: LanternMode;
  onStrict: (on: boolean) => void;
  onOpenModes: () => void;
  onOpenReports: () => void;
  onNavigate: (page: string) => void;
  reelsBlocked: boolean;
  adultBlocked: boolean;
  onReelsToggle: (on: boolean) => void;
  onAdultToggle: (on: boolean) => void;
}) {
  const { totalScreenTimeMinutes, appUsage, isLoading } = useScreenTime();
  const budget = 240;
  const level = 1 - Math.min(1, totalScreenTimeMinutes / budget);

  const segments = useMemo(() => {
    const by: Record<string, number> = {};
    appUsage.forEach((a) => {
      const k = a.category || 'other';
      by[k] = (by[k] || 0) + a.usageMinutes;
    });
    return Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, minutes]) => ({ label: label[0].toUpperCase() + label.slice(1), minutes }));
  }, [appUsage]);

  const top = useMemo(
    () => [...appUsage].sort((a, b) => b.usageMinutes - a.usageMinutes).slice(0, 3),
    [appUsage],
  );
  const max = top[0]?.usageMinutes || 1;

  // Which layers of armour are currently up.
  const arcs: AegisArc[] = useMemo(
    () => [
      { id: 'sites', label: 'Sites', active: readList('shield_blocked_sites_v2').some((s: any) => s?.active), ring: 0, onClick: () => onNavigate('block-sites') },
      { id: 'keywords', label: 'Keywords', active: readList('shield_blocked_keywords_v2').length > 0, ring: 0, onClick: () => onNavigate('block-keywords') },
      { id: 'adult', label: 'Adult filter', active: adultBlocked, ring: 0, onClick: () => onAdultToggle(!adultBlocked) },
      { id: 'apps', label: 'App locks', active: readList('shield_blocked_apps_v2').length > 0, ring: 1, onClick: () => onNavigate('block-apps') },
      { id: 'reels', label: 'Infinite feeds', active: reelsBlocked, ring: 1, onClick: () => onReelsToggle(!reelsBlocked) },
      { id: 'watch', label: 'Watch', active: mode !== 'normal', ring: 2, onClick: onOpenModes },
    ],
    [mode, onOpenModes, onNavigate, adultBlocked, reelsBlocked, onAdultToggle, onReelsToggle],
  );

  const raised = arcs.filter((a) => a.active).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <div className="shield-os space-y-3">
      <div className="pt-1">
        <p className="lantern-label">{greeting} · perimeter</p>
        <h1 className="text-xl font-bold text-foreground">
          {raised === 0
            ? 'The field is down.'
            : raised >= 4
            ? 'The field is holding.'
            : 'Partial cover.'}
        </h1>
      </div>

      <LatticePanel index={0} className="shield-sweep relative overflow-hidden pt-6">
        <span className="shield-aura" aria-hidden />
        {isLoading ? (
          <div className="grid h-[248px] place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AegisRings
            arcs={arcs}
            sealed={mode === 'strict'}
            centerLabel={mode === 'strict' ? 'sealed' : 'layers up'}
            centerValue={`${raised}`}
            centerUnit={`/${arcs.length}`}
            onPanic={() => onStrict(true)}
          />
        )}
        <AegisLegend arcs={arcs} />
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Tap a segment to adjust it · drag the core outward to seal everything
        </p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4">
          {[
            { k: 'Streak', v: `${streak}`, u: 'd' },
            { k: 'Keep score', v: `${score}`, u: '' },
            { k: 'Saved', v: `${Math.max(0, Math.round((budget - totalScreenTimeMinutes) / 6) / 10)}`, u: 'h' },
          ].map((s) => (
            <div key={s.k} className="px-2 text-center">
              <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                {s.v}
                <span className="text-xs text-muted-foreground">{s.u}</span>
              </p>
              <p className="lantern-label mt-1 !mb-0">{s.k}</p>
            </div>
          ))}
        </div>
      </LatticePanel>

      {/* ------------------------------------------------ quick blocking controls */}
      <LatticePanel index={1}>
        <h2 className="lantern-label">Guard the doors</h2>
        <div className="-mx-1 divide-y divide-border">
          {[
            {
              id: 'apps',
              icon: Smartphone,
              label: 'Blocked apps',
              count: readList('shield_blocked_apps_v2').length,
              page: 'block-apps',
            },
            {
              id: 'sites',
              icon: Globe,
              label: 'Blocked sites',
              count: readList('shield_blocked_sites_v2').length,
              page: 'block-sites',
            },
            {
              id: 'keywords',
              icon: Type,
              label: 'Blocked keywords',
              count: readList('shield_blocked_keywords_v2').length,
              page: 'block-keywords',
            },
          ].map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onNavigate(row.page)}
              className="shield-tap flex w-full items-center justify-between gap-3 px-1 py-3 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                  <row.icon className="h-5 w-5 text-primary" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{row.label}</span>
                  <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
                    {row.count} active
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}

          <div className="flex items-center justify-between gap-3 px-1 py-3">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                <Film className="h-5 w-5 text-primary" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">Block Reels &amp; Shorts</span>
                <span className="block text-[11px] text-muted-foreground">Stops infinite feeds instantly</span>
              </span>
            </span>
            <Switch checked={reelsBlocked} onCheckedChange={onReelsToggle} />
          </div>

          <div className="flex items-center justify-between gap-3 px-1 py-3">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                <ShieldAlert className="h-5 w-5 text-primary" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">Adult content filter</span>
                <span className="block text-[11px] text-muted-foreground">Sites, keywords and media</span>
              </span>
            </span>
            <Switch checked={adultBlocked} onCheckedChange={onAdultToggle} />
          </div>
        </div>
      </LatticePanel>

      <div className="grid grid-cols-1 gap-3">
        <LatticePanel index={1}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="lantern-label !mb-0">Where the oil went</h2>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {fmt(totalScreenTimeMinutes)}
            </span>
          </div>
          <BurnLine segments={segments} />
        </LatticePanel>

        <LatticePanel index={2}>
          <h2 className="lantern-label">Brightest wicks</h2>
          <div className="divide-y divide-border">
            {top.map((a, i) => (
              <WickRow key={a.packageName} name={a.appName} minutes={a.usageMinutes} max={max} rank={i + 1} />
            ))}
          </div>
          <button
            onClick={onOpenReports}
            className="mt-3 flex w-full items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-sm font-semibold text-foreground"
          >
            See the full ledger
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </LatticePanel>
      </div>

      <button
        onClick={onOpenModes}
        className="shield-tap shield-plate flex w-full items-center gap-3 px-4 py-4 text-left"
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Raise another layer</p>
          <p className="text-xs text-muted-foreground">Focus, Sleep or a sealed watch</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}


/* ----------------------------------------------------------- MODES SCREEN */

export type LanternMode = 'normal' | 'focus' | 'sleep' | 'strict';

function ModesScreen({
  mode,
  busy,
  onToggle,
  onStrict,
}: {
  mode: LanternMode;
  busy: LanternMode | null;
  onToggle: (m: 'focus' | 'sleep') => void;
  onStrict: (on: boolean) => void;
}) {
  const cards = [
    {
      id: 'focus' as const,
      icon: Flame,
      title: 'Focus watch',
      body: 'One clean hour. Distracting apps go dark, everything else stays.',
      meta: 'Reversible anytime',
    },
    {
      id: 'sleep' as const,
      icon: Moon,
      title: 'Sleep watch',
      body: 'The lantern dims for the night so the morning belongs to you.',
      meta: 'Ends at sunrise',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="pt-1">
        <p className="lantern-label">Watches</p>
        <h1 className="text-xl font-bold text-foreground">Choose how closely to tend it</h1>
      </div>

      {cards.map((c) => {
        const active = mode === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onToggle(c.id)}
            disabled={!!busy}
            className={cn(
              'lantern-panel w-full p-4 text-left transition-all active:scale-[0.99]',
              active && 'border-primary/50 bg-primary/10',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-muted/50',
                  active && 'border-primary/40 bg-primary/15',
                )}
              >
                {busy === c.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <c.icon className={cn('h-5 w-5', active ? 'text-primary lantern-breathe' : 'text-muted-foreground')} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-foreground">{c.title}</h3>
                  <span className={cn('lantern-label !mb-0', active && 'text-primary')}>
                    {active ? 'lit' : 'idle'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{c.meta}</p>
              </div>
            </div>
          </button>
        );
      })}

      {/* Strict: heavier, quieter, engraved — serious without being scary */}
      <section
        className={cn(
          'relative overflow-hidden rounded-2xl border p-4',
          mode === 'strict' ? 'border-primary/50 bg-primary/10' : 'border-border bg-card',
        )}
      >
        <div className="lantern-engrave pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-background">
            {busy === 'strict' ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Lock className={cn('h-5 w-5', mode === 'strict' ? 'text-primary' : 'text-muted-foreground')} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground">Sealed watch</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A promise you make in advance. Once sealed, the lantern cannot be opened early — not by you,
              not by a reinstall. It lifts on its own at midnight.
            </p>
            <button
              onClick={() => onStrict(mode !== 'strict')}
              disabled={!!busy}
              className={cn(
                'mt-3 w-full rounded-xl py-3 text-sm font-bold transition-transform active:scale-[0.98]',
                mode === 'strict'
                  ? 'border border-border bg-background text-muted-foreground'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {mode === 'strict' ? 'Sealed until midnight' : 'Seal the lantern'}
            </button>
          </div>
        </div>
      </section>

      <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Watches never delete anything. They only decide which doors stay shut while the flame is up.
      </p>
    </div>
  );
}

/* --------------------------------------------------------- REPORTS SCREEN */

function ReportsScreen() {
  const { totalScreenTimeMinutes, totalAppLaunches, appUsage, isLoading } = useScreenTime();

  const ranked = useMemo(
    () => [...appUsage].sort((a, b) => b.usageMinutes - a.usageMinutes).slice(0, 12),
    [appUsage],
  );
  const max = ranked[0]?.usageMinutes || 1;

  return (
    <div className="space-y-4">
      <div className="pt-1">
        <p className="lantern-label">The ledger</p>
        <h1 className="text-xl font-bold text-foreground">Every hour, accounted for</h1>
        <p className="mt-1 text-[11px] text-muted-foreground">Today, measured from your device usage.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { k: 'Burned', v: fmt(totalScreenTimeMinutes) },
          { k: 'Pickups', v: `${totalAppLaunches}` },
          { k: 'Apps touched', v: `${appUsage.length}` },
          { k: 'Top app', v: ranked[0] ? fmt(ranked[0].usageMinutes) : '—' },
        ].map((s) => (
          <Panel key={s.k} className="py-3">
            <p className="lantern-label">{s.k}</p>
            <p className="font-mono text-xl font-bold tabular-nums text-foreground">{s.v}</p>
          </Panel>
        ))}
      </div>

      <Panel title="Ranked by oil burned">
        {isLoading ? (
          <div className="grid h-32 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ranked.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No usage recorded yet. Grant Usage Access on your phone to see real numbers here.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {ranked.map((a, i) => (
              <WickRow key={a.packageName} name={a.appName} minutes={a.usageMinutes} max={max} rank={i + 1} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}


/* ---------------------------------------------------------------- BOTTOM NAV */

const TABS = [
  { id: 'dashboard', icon: HomeIcon, label: 'Home' },
  { id: 'modes', icon: Flame, label: 'Modes' },
  { id: 'reports', icon: BarChart3, label: 'Reports' },
  { id: 'groups', icon: Users, label: 'Groups' },
  { id: 'settings', icon: SettingsIcon, label: 'Settings' },
];

/** Identical bar to the global MobileNav (height, blur, safe-area, typography). */
function LanternNav({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <nav className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-all select-none active:scale-95',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <t.icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* --------------------------------------------------------------- THE SHELL */

interface FocusShieldUIProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  streak: number;
  score: number;
  mode: LanternMode;
  modeBusy: LanternMode | null;
  onToggleMode: (m: 'focus' | 'sleep') => void;
  onToggleStrict: (on: boolean) => void;
  onBack?: () => void;
  /** Opens a Shield sub page (block-apps, block-sites, block-keywords, ...). */
  onNavigate: (page: string) => void;
  reelsBlocked: boolean;
  adultBlocked: boolean;
  onReelsToggle: (on: boolean) => void;
  onAdultToggle: (on: boolean) => void;
  /** Existing feature surfaces injected unchanged. */
  groupsSlot: React.ReactNode;
  settingsSlot: React.ReactNode;
}

export function FocusShieldUI({
  activeTab,
  onTabChange,
  streak,
  score,
  mode,
  modeBusy,
  onToggleMode,
  onToggleStrict,
  onBack,
  onNavigate,
  reelsBlocked,
  adultBlocked,
  onReelsToggle,
  onAdultToggle,
  groupsSlot,
  settingsSlot,
}: FocusShieldUIProps) {
  return (
    <div className="lantern shield-os min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-xl bg-muted/60" aria-label="Back">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-primary/40 bg-primary/10">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-foreground">Focus Shield</h1>
            <p className="lantern-label !mb-0">containment field</p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
            <ShieldCheck className={cn('h-3.5 w-3.5', mode === 'normal' ? 'text-muted-foreground' : 'text-primary')} />
            <span className="font-mono text-[11px] font-bold uppercase tabular-nums text-foreground">
              {mode === 'normal' ? 'idle' : mode}
            </span>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        {activeTab === 'dashboard' && (
          <HomeScreen
            streak={streak}
            score={score}
            mode={mode}
            onStrict={onToggleStrict}
            onOpenModes={() => onTabChange('modes')}
            onOpenReports={() => onTabChange('reports')}
            onNavigate={onNavigate}
            reelsBlocked={reelsBlocked}
            adultBlocked={adultBlocked}
            onReelsToggle={onReelsToggle}
            onAdultToggle={onAdultToggle}
          />
        )}
        {activeTab === 'modes' && (
          <ModesScreen mode={mode} busy={modeBusy} onToggle={onToggleMode} onStrict={onToggleStrict} />
        )}
        {activeTab === 'reports' && <ReportsScreen />}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="pt-1">
              <p className="lantern-label">The circle</p>
              <h1 className="text-xl font-bold text-foreground">Keepers who watch with you</h1>
            </div>
            {groupsSlot}
          </div>
        )}
        {activeTab === 'settings' && settingsSlot}
      </main>

      <LanternNav active={activeTab} onChange={onTabChange} />
    </div>
  );
}

export default FocusShieldUI;
