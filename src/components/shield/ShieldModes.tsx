import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Brain, Moon, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import Shield from '@/lib/capacitor/shieldPlugin';
import { isNative } from '@/lib/capacitor/platform';
import { toast } from 'sonner';
import { setPresence } from '@/hooks/useLifeosLive';

type StrictnessMode = 'normal' | 'lock' | 'strict';

interface ShieldModesProps {
  activeMode?: StrictnessMode;
  onModeChange?: (mode: StrictnessMode) => void;
  disciplineScore?: number | null;
}

export function ShieldModes({ activeMode, onModeChange, disciplineScore }: ShieldModesProps = {}) {
  const [currentMode, setCurrentMode] = useState<StrictnessMode>('normal');
  const [isStrict, setIsStrict] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  const isControlled = activeMode !== undefined;
  const resolvedMode = isControlled ? activeMode : currentMode;

  useEffect(() => {
    const loadMode = async () => {
      if (!isNative) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await Shield.getCurrentMode();
        const nativeMode = (data.mode || 'normal') as StrictnessMode;
        setCurrentMode(nativeMode);
        setIsStrict(Boolean(data.strict));
      } catch (error) {
        console.error('Failed to load shield mode', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMode();
  }, []);

  useEffect(() => {
    if (activeMode) {
      setCurrentMode(activeMode);
      setIsStrict(activeMode === 'strict');
    }
  }, [activeMode]);

  const modeDescription = useMemo(() => {
    if (disciplineScore == null) return null;
    return `Discipline score: ${disciplineScore}`;
  }, [disciplineScore]);

  const applyMode = (mode: StrictnessMode) => {
    setCurrentMode(mode);
    setIsStrict(mode === 'strict');
    onModeChange?.(mode);
  };

  const toggleMode = async (modeName: 'focus' | 'sleep') => {
    const targetMode: StrictnessMode = modeName === 'focus' ? 'lock' : 'strict';
    try {
      if (resolvedMode === targetMode) {
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

      applyMode(targetMode);
    } catch (error) {
      toast.error(`Failed to activate ${modeName} mode`);
    }
  };

  const toggleStrictMode = async (checked: boolean) => {
    try {
      if (!checked) {
        applyMode('normal');
        toast.info('Strict Mode Disabled');
        return;
      }

      await Shield.activateStrictMode();
      applyMode('strict');
      toast.success('Strict Mode Activated: Shield cannot be bypassed!');
    } catch (error) {
      toast.error('Failed to toggle Strict Mode');
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
        active={resolvedMode === 'lock'}
        icon={<Brain className="h-4 w-4" />}
        title="Focus Mode"
        subtitle="Customized blocking enabled"
        actionLabel={resolvedMode === 'lock' ? 'Active' : 'Enable'}
        onAction={() => toggleMode('focus')}
        disabled={isStrict}
      />

      <ModeCard
        active={resolvedMode === 'normal'}
        icon={<Moon className="h-4 w-4" />}
        title="Sleep Mode"
        subtitle="Custom block list active"
        actionLabel={resolvedMode === 'normal' ? 'Active' : 'Enable'}
        onAction={() => toggleMode('sleep')}
        disabled={isStrict}
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
          <Switch checked={isStrict} onCheckedChange={toggleStrictMode} />
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
}

function ModeCard({ active, icon, title, subtitle, actionLabel, onAction, disabled }: ModeCardProps) {
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
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
