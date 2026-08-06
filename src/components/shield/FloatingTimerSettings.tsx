import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity, Clock, Hourglass } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FloatingTimerSettingsProps {
  onBack: () => void;
}

type TimerFormat = 'mm:ss' | 'hh:mm' | 'minutes';
type TimerTheme = 'dark' | 'light' | 'glass';
type TimerIcon = 'shield' | 'clock' | 'hourglass';

interface FloatingTimerStyle {
  enabled: boolean;
  opacity: number;   // 0.2 - 1.0
  size: number;      // 40 - 120 (px)
  countdown: boolean;
  format: TimerFormat;
  theme: TimerTheme;
  icon: TimerIcon;
}

const DEFAULTS: FloatingTimerStyle = {
  enabled: false,
  opacity: 0.85,
  size: 72,
  countdown: true,
  format: 'mm:ss',
  theme: 'dark',
  icon: 'shield',
};

const STORAGE_KEY = 'shield_floating_timer_style';

export function FloatingTimerSettings({ onBack }: FloatingTimerSettingsProps) {
  const [style, setStyle] = useState<FloatingTimerStyle>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStyle({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {/* */}
  }, []);

  const update = <K extends keyof FloatingTimerStyle>(key: K, value: FloatingTimerStyle[K]) => {
    setStyle((s) => {
      const next = { ...s, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const pushToNative = async () => {
    if (Capacitor.getPlatform() !== 'android') {
      toast.success('Preferences saved (web preview)');
      return;
    }
    setSaving(true);
    try {
      await ShieldPlugin.toggleFloatingTimer({ enable: style.enabled });
      await ShieldPlugin.updateFloatingTimerStyle({
        opacity: style.opacity,
        size: style.size,
        countdown: style.countdown,
        icon: style.icon,
        format: style.format,
        theme: style.theme,
      });
      toast.success('Floating timer updated');
    } catch (e: any) {
      console.error('[FloatingTimer] update failed', e);
      toast.error(e?.message || 'Failed to update floating timer');
    } finally {
      setSaving(false);
    }
  };

  const themeBg =
    style.theme === 'dark'
      ? 'bg-neutral-900 text-white'
      : style.theme === 'light'
      ? 'bg-white text-neutral-900 border border-border'
      : 'bg-white/10 backdrop-blur-md text-white border border-white/20';

  const PreviewIcon = style.icon === 'clock' ? Clock : style.icon === 'hourglass' ? Hourglass : Activity;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 py-4 flex items-center gap-3 border-b border-border/50 bg-card/50">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Floating Timer</h1>
          <p className="text-xs text-muted-foreground">Always-on overlay during focus sessions</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Live preview */}
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Preview</p>
            <div className="h-40 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/10 border border-border/50 relative overflow-hidden flex items-center justify-center">
              <div
                className={cn('rounded-full flex items-center justify-center shadow-lg', themeBg)}
                style={{ width: style.size, height: style.size, opacity: style.opacity }}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <PreviewIcon className="h-4 w-4" />
                  <span className="text-[10px] font-mono font-bold leading-none">
                    {style.format === 'minutes' ? '24m' : style.format === 'hh:mm' ? '00:24' : '24:00'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enable */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sm">Enable Floating Timer</h3>
              <p className="text-xs text-muted-foreground">Show overlay over other apps</p>
            </div>
            <Switch checked={style.enabled} onCheckedChange={(v) => update('enabled', v)} />
          </CardContent>
        </Card>

        {/* Sliders */}
        <Card>
          <CardContent className="p-4 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Opacity</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(style.opacity * 100)}%
                </span>
              </div>
              <Slider
                min={20}
                max={100}
                step={5}
                value={[Math.round(style.opacity * 100)]}
                onValueChange={(v) => update('opacity', v[0] / 100)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Size</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{style.size}px</span>
              </div>
              <Slider
                min={40}
                max={120}
                step={4}
                value={[style.size]}
                onValueChange={(v) => update('size', v[0])}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Show Countdown</h3>
                <p className="text-xs text-muted-foreground">Time left vs elapsed</p>
              </div>
              <Switch checked={style.countdown} onCheckedChange={(v) => update('countdown', v)} />
            </div>
          </CardContent>
        </Card>

        {/* Format */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Time Format</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['mm:ss', 'hh:mm', 'minutes'] as TimerFormat[]).map((f) => (
                <Button
                  key={f}
                  variant={style.format === f ? 'default' : 'outline'}
                  size="sm"
                  className="h-9"
                  onClick={() => update('format', f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Theme</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['dark', 'light', 'glass'] as TimerTheme[]).map((t) => (
                <Button
                  key={t}
                  variant={style.theme === t ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 capitalize"
                  onClick={() => update('theme', t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Icon */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Icon</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['shield', 'clock', 'hourglass'] as TimerIcon[]).map((i) => {
                const Icon = i === 'clock' ? Clock : i === 'hourglass' ? Hourglass : Activity;
                return (
                  <Button
                    key={i}
                    variant={style.icon === i ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 capitalize gap-2"
                    onClick={() => update('icon', i)}
                  >
                    <Icon className="h-4 w-4" />
                    {i}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button onClick={pushToNative} disabled={saving} className="w-full h-12 font-bold">
          {saving ? 'Saving…' : 'Apply to Overlay'}
        </Button>
      </div>
    </div>
  );
}