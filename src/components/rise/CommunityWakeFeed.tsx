import { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings, BarChart3, List, Map as MapIcon, Sparkles, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useNearbyWakers } from '@/hooks/useNearbyWakers';
import { useCommunitySettings } from '@/hooks/useCommunitySettings';
import { useWeeklyRecap } from '@/hooks/useWeeklyRecap';
import { useStreak } from '@/hooks/useStreak';

import { HeroStatsBar } from './HeroStatsBar';
import { MilestoneBanner } from './MilestoneBanner';
import { OwnStatusCard } from './OwnStatusCard';
import { NearbyWakerCard } from './NearbyWakerCard';
import { WakeMapView } from './WakeMapView';
import { CommunitySettingsSheet } from './CommunitySettingsSheet';
import { WeeklyRecapSheet } from './WeeklyRecapSheet';
import { LocationPrivacySheet } from './LocationPrivacySheet';

type ViewMode = 'feed' | 'map';

const EMOJI_OPTIONS = ['🌅', '☀️', '💪', '🤲', '📚', '🏃', '☕', '✨', '🔥', '😊'];

/** Pull next upcoming alarm from local_alarms (matches Rise.tsx logic). */
function useNextAlarmTime(): string | null {
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const compute = () => {
      try {
        const raw = localStorage.getItem('local_alarms');
        if (!raw) return setNext(null);
        const alarms = (JSON.parse(raw) as any[]).filter((a) => a?.is_enabled !== false);
        if (!alarms.length) return setNext(null);

        const now = new Date();
        let bestMinutes = Infinity;
        let bestLabel: string | null = null;

        for (const a of alarms) {
          const [hh, mm] = String(a.alarm_time || '').split(':').map(Number);
          if (isNaN(hh) || isNaN(mm)) continue;
          const target = new Date();
          target.setHours(hh, mm, 0, 0);
          let diff = (target.getTime() - now.getTime()) / 60000;
          if (diff < 0) diff += 24 * 60;
          if (diff < bestMinutes) {
            bestMinutes = diff;
            const h12 = ((hh + 11) % 12) + 1;
            const ampm = hh >= 12 ? 'PM' : 'AM';
            bestLabel = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
          }
        }
        setNext(bestLabel);
      } catch {
        setNext(null);
      }
    };
    compute();
    const id = setInterval(compute, 30_000);
    return () => clearInterval(id);
  }, []);

  return next;
}

function StatusUpdateBar({
  initial,
  onSave,
}: {
  initial?: { text: string | null; emoji: string | null };
  onSave: (text: string, emoji?: string) => void | Promise<void>;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🌅');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed, emoji);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex items-center gap-2 p-2 bg-card/60 border-border/60 backdrop-blur">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-lg">
            <span aria-hidden>{emoji}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div className="grid grid-cols-5 gap-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  'h-8 w-8 rounded-md text-lg hover:bg-accent transition-colors',
                  emoji === e && 'bg-accent ring-1 ring-primary',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="তোমার সকালের status লিখো…"
        className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-sm"
        maxLength={120}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />

      <Button
        type="button"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={!text.trim() || saving}
        onClick={submit}
      >
        <Send className="h-4 w-4" />
      </Button>
    </Card>
  );
}

function EmptyFeed({ filter }: { filter: 'global' | 'city' | 'nearby' }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center border-dashed">
      <Sparkles className="h-7 w-7 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">
        {filter === 'nearby'
          ? 'তোমার আশেপাশে এখনো কেউ ওঠেনি'
          : filter === 'city'
            ? 'তোমার শহরে আজ এখনো কেউ ওঠেনি'
            : 'আজ এখনো কেউ ওঠেনি'}
      </p>
      <p className="text-xs text-muted-foreground">
        প্রথম হতে চাও? অ্যালার্ম set করো এবং সকালে উঠে check-in করো।
      </p>
    </Card>
  );
}

export default function CommunityWakeFeed() {
  const {
    wakers,
    myEvent,
    filterMode,
    isLoading,
    totalToday,
    cityCount,
    nearbyCount,
    userLocation,
    setFilterMode,
    refreshFeed,
    updateMyStatus,
  } = useNearbyWakers();

  const { settings } = useCommunitySettings();
  const { recap, recapOpen, setRecapOpen, buildRecap } = useWeeklyRecap();
  const { currentStreak } = useStreak();
  const nextAlarmTime = useNextAlarmTime();

  const [view, setView] = useState<ViewMode>('feed');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);

  // If user picks Nearby but we have no location yet, prompt for permission.
  const handleFilterClick = useCallback(
    (mode: 'global' | 'city' | 'nearby') => {
      if (mode === 'nearby' && !userLocation?.lat) {
        const asked = sessionStorage.getItem('rise_nearby_asked') === '1';
        if (!asked) {
          setLocationPromptOpen(true);
          return;
        }
      }
      setFilterMode(mode);
    },
    [setFilterMode, userLocation],
  );

  const openRecap = useCallback(async () => {
    await buildRecap();
    setRecapOpen(true);
  }, [buildRecap, setRecapOpen]);

  const visibleWakers = useMemo(
    () => wakers.filter((w) => w.user_id !== myEvent?.user_id),
    [wakers, myEvent?.user_id],
  );

  return (
    <div className="space-y-3">
      {/* Milestone (every 1000 wakers) */}
      <MilestoneBanner globalCount={totalToday} />

      {/* Header card */}
      <Card className="p-3 bg-card/60 border-border/60 backdrop-blur space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden>🌅</span>
            <h2 className="text-sm font-semibold text-foreground">আজকের Wakers</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={openRecap}
              aria-label="Weekly recap"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSettingsOpen(true)}
              aria-label="Community settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <HeroStatsBar
          globalCount={totalToday}
          cityCount={cityCount}
          nearbyCount={nearbyCount}
          activeFilter={filterMode}
          onTabClick={handleFilterClick}
        />
      </Card>

      {/* Own status */}
      <OwnStatusCard
        myEvent={myEvent}
        streak={currentStreak}
        nextAlarmTime={nextAlarmTime}
        isFirstInArea={!!myEvent?.first_in_thana}
        areaName={myEvent?.city ?? null}
      />

      {/* Status update — only after the user has actually woken up today */}
      {myEvent && (
        <StatusUpdateBar
          initial={{ text: myEvent.status_text, emoji: myEvent.status_emoji }}
          onSave={(t, e) => updateMyStatus(t, e)}
        />
      )}

      {/* Feed / Map toggle */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 border border-border/60">
        {(['feed', 'map'] as ViewMode[]).map((v) => {
          const active = view === v;
          const Icon = v === 'feed' ? List : MapIcon;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {v === 'feed' ? 'Feed' : 'Map'}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {view === 'map' ? (
        <WakeMapView
          wakers={wakers}
          myLat={userLocation?.lat ?? null}
          myLng={userLocation?.lng ?? null}
        />
      ) : isLoading && wakers.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : visibleWakers.length === 0 ? (
        <EmptyFeed filter={filterMode} />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleWakers.map((w) => (
            <NearbyWakerCard
              key={w.id}
              waker={w}
              showDistance={filterMode === 'nearby'}
              showAlarmLabel={settings.show_alarm_label}
            />
          ))}
        </div>
      )}

      {/* Sheets */}
      <CommunitySettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <WeeklyRecapSheet
        open={recapOpen}
        onOpenChange={setRecapOpen}
        data={recap ? { ...recap, currentStreak } : null}
      />
      <LocationPrivacySheet
        open={locationPromptOpen}
        onOpenChange={setLocationPromptOpen}
        onSaved={() => {
          sessionStorage.setItem('rise_nearby_asked', '1');
          setLocationPromptOpen(false);
          setFilterMode('nearby');
          void refreshFeed();
        }}
      />
    </div>
  );
}
