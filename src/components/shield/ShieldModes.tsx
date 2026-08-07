import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Brain, Moon, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import Shield from '@/lib/capacitor/shieldPlugin';
import { isNative } from '@/lib/capacitor/platform';
import { toast } from 'sonner';
import { setPresence } from '@/hooks/useLifeosLive';

// Mirrors the native ShieldModeManager vocabulary exactly ("focus" | "sleep" |
// "strict" | "normal"). The old UI used a "lock" alias for focus and mapped
// Sleep Mode onto "strict", so the Sleep card reported the wrong state and
// activating Sleep looked like Strict Mode.
export type StrictnessMode = 'normal' | 'focus' | 'sleep' | 'strict';

export function normalizeShieldMode(raw: string | null | undefined): StrictnessMode {
  switch (raw) {
    case 'lock':
    case 'focus':
      return 'focus';
    case 'sleep':
      return 'sleep';
    case 'strict':
      return 'strict';
    default:
      return 'normal';
  }
}

interface ShieldModesProps {
  activeMode?: StrictnessMode;
  onModeChange?: (mode: StrictnessMode) => void;
  disciplineScore?: number | null;
}

export function ShieldModes({ activeMode, onModeChange, disciplineScore }: ShieldModesProps = {}) {
  const [currentMode, setCurrentMode] = useState<StrictnessMode>('normal');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'focus' | 'sleep' | 'strict'>(null);

  const isControlled = activeMode !== undefined;
  const resolvedMode = isControlled ? activeMode : currentMode;
  const isStrict = resolvedMode === 'strict';

  // Pull the real mode from native on mount, and re-sync whenever the app comes
  // back to the foreground (the mode can change from the block screen or when
  // strict mode expires at midnight).
  useEffect(() => {
    let cancelled = false;

    const syncMode = async () => {
      if (!isNative) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const data = await Shield.getCurrentMode();
        if (cancelled) return;
        const native = data?.strict ? 'strict' : normalizeShieldMode(data?.mode);
        setCurrentMode(native);
        onModeChange?.(native);
      } catch (error) {
        console.error('Failed to load shield mode', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    syncMode();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncMode();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeMode) setCurrentMode(activeMode);
  }, [activeMode]);

  const modeDescription = useMemo(() => {
    if (disciplineScore == null) return null;
    return `Discipline score: ${disciplineScore}`;
  }, [disciplineScore]);

  const applyMode = (mode: StrictnessMode) => {
    setCurrentMode(mode);
    onModeChange?.(mode);
  };

  const nativeError = (error: unknown, fallback: string) =>
    toast.error(
      typeof error === 'string' ? error : (error as any)?.message || fallback,
    );

  const toggleMode = async (modeName: 'focus' | 'sleep') => {
    if (busy) return;
    if (!isNative) {
      toast.info('Shield modes are only available in the Android app.');
      return;
    }
    setBusy(modeName);
    try {
      if (resolvedMode === modeName) {
        await Shield.deactivateMode();
        applyMode('normal');
        toast.info('Shield returned to Normal Mode');
        await setPresence({ status: 'idle' });
        return;
      }

      if (modeName === 'focus') {
        await Shield.activateFocusMode();
        toast.success('Focus Mode Active');
        await setPresence({ status: 'shield_focus' });
      } else {
        await Shield.activateSleepMode();
        toast.success('Sleep Mode Active');
        await setPresence({ status: 'sleeping' });
      }

      applyMode(modeName);
    } catch (error) {
      nativeError(error, `Failed to activate ${modeName} mode`);
    } finally {
      setBusy(null);
    }
  };

  const toggleStrictMode = async (checked: boolean) => {
    if (busy) return;
    if (!isNative) {
      toast.info('Strict Mode is only available in the Android app.');
      return;
    }
    setBusy('strict');
    try {
      if (!checked) {
        // Native is the source of truth: it rejects while strict mode is still
        // in force, so the switch snaps back instead of lying.
        await Shield.deactivateMode();
        applyMode('normal');
        toast.info('Strict Mode Disabled');
        return;
      }

      await Shield.activateStrictMode();
      applyMode('strict');
      toast.success('Strict Mode Activated: Shield cannot be bypassed!');
    } catch (error) {
      nativeError(error, 'Failed to toggle Strict Mode');
      // Re-read native state so the UI matches reality after a rejection.
      try {
        const data = await Shield.getCurrentMode();
        applyMode(data?.strict ? 'strict' : normalizeShieldMode(data?.mode));
      } catch {}
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-6">
      <div className="px-1">
        <h3 className="text-sm font-bold text-foreground">Quick Modes</h3>
        {modeDescription && <p className="text-xs text-muted-foreground mt-1">{modeDescription}</p>}
      </div>

      <ModeCard
        active={resolvedMode === 'focus'}
        icon={<Brain className="h-4 w-4" />}
        title="Focus Mode"
        subtitle="Blocks the big distraction apps"
        actionLabel={resolvedMode === 'focus' ? 'Active' : 'Enable'}
        onAction={() => toggleMode('focus')}
        disabled={isStrict || busy !== null}
        loading={busy === 'focus'}
      />

      <ModeCard
        active={resolvedMode === 'sleep'}
        icon={<Moon className="h-4 w-4" />}
        title="Sleep Mode"
        subtitle="Focus list plus late-night apps"
        actionLabel={resolvedMode === 'sleep' ? 'Active' : 'Enable'}
        onAction={() => toggleMode('sleep')}
        disabled={isStrict || busy !== null}
        loading={busy === 'sleep'}
      />

      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 mt-4">
        <div className="flex items-center justify-between mb-2 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-destructive/15 text-destructive">
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-foreground">Strict Mode</p>
              <p className="text-[10px] text-muted-foreground">Irreversible until tomorrow</p>
            </div>
          </div>
          <Switch
            checked={isStrict}
            disabled={busy !== null}
            onCheckedChange={toggleStrictMode}
          />
        </div>
        <p className="text-xs text-destructive/90 leading-relaxed flex items-start gap-1.5 mt-2">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          When enabled, you cannot disable Shield or change modes until tomorrow.
        </p>
      </div>
    </div>
  );
}

interface ModeCardProps {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  loading?: boolean;
}

function ModeCard({ active, icon, title, subtitle, actionLabel, onAction, disabled, loading }: ModeCardProps) {
  return (
    <Card className={`bg-card border border-border p-4 rounded-xl transition-all ${active ? 'ring-1 ring-primary/40' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button
          variant={active ? 'default' : 'outline'}
          size="sm"
          onClick={onAction}
          disabled={disabled}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel}
        </Button>
      </div>
    </Card>
  );
}
