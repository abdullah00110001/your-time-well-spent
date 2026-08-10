// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Settings > Timer — position, size, opacity, show seconds, pulse.
// Includes a live orb preview so nothing here is a dummy control.

import { useState } from 'react';
import { ArrowLeft, Move, Ruler, Droplets, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { loadOrb, saveOrb, type OrbTimerSettings, type OrbCorner } from '@/lib/shield/settingsStore';

const GOLD = '#FFD166';
const EMBER = '#FF8C42';

const CORNERS: { id: OrbCorner; label: string }[] = [
  { id: 'TL', label: 'Top left' },
  { id: 'TR', label: 'Top right' },
  { id: 'BL', label: 'Bottom left' },
  { id: 'BR', label: 'Bottom right' },
];

interface Props { onBack: () => void }

export function OrbTimerSettingsPage({ onBack }: Props) {
  const [s, setS] = useState<OrbTimerSettings>(loadOrb);

  const patch = (p: Partial<OrbTimerSettings>) => {
    const next = { ...s, ...p };
    setS(next);
    saveOrb(next);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-background/85 px-4 py-3 backdrop-blur pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-bold">Light Orb Timer</h1>
          <p className="text-[11px] text-muted-foreground">Your floating focus companion</p>
        </div>
        <Switch checked={s.enabled} onCheckedChange={(v) => patch({ enabled: v })} aria-label="Enable orb" />
      </div>

      <div className="space-y-6 p-4">
        {/* Live preview */}
        <div className="relative h-36 rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
          <div
            className="absolute rounded-full flex items-center justify-center font-bold text-black"
            style={{
              width: s.size,
              height: s.size,
              fontSize: Math.max(11, s.size * 0.24),
              opacity: s.opacity,
              top: s.corner.startsWith('T') ? 16 : undefined,
              bottom: s.corner.startsWith('B') ? 16 : undefined,
              left: s.corner.endsWith('L') ? 16 : undefined,
              right: s.corner.endsWith('R') ? 16 : undefined,
              background: `radial-gradient(circle at 35% 30%, #FFF0C4, ${GOLD} 55%, ${EMBER} 100%)`,
              boxShadow: `0 0 26px ${GOLD}99, inset 0 0 12px #ffffff66`,
            }}
          >
            {s.showSeconds ? '23:12' : '23m'}
          </div>
          <span className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">Live preview</span>
        </div>

        <Row icon={Move} title="Position" hint="Where the orb rests by default">
          <div className="grid grid-cols-2 gap-2">
            {CORNERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => patch({ corner: c.id })}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-sm transition-all',
                  s.corner === c.id ? 'border-[#FFD166] bg-[#FFD166]/10' : 'border-border/60 bg-muted/20',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">You can still drag the orb anywhere on screen.</p>
        </Row>

        <Row icon={Ruler} title={`Size — ${s.size}px`} hint="48 to 96 pixels">
          <Slider value={[s.size]} min={48} max={96} step={4} onValueChange={([v]) => patch({ size: v })} />
        </Row>

        <Row icon={Droplets} title={`Opacity — ${Math.round(s.opacity * 100)}%`} hint="How present the orb feels">
          <Slider value={[Math.round(s.opacity * 100)]} min={30} max={100} step={5} onValueChange={([v]) => patch({ opacity: v / 100 })} />
        </Row>

        <Row icon={Clock} title="Show Seconds" hint="23:12 instead of 23m">
          <ToggleRow on={s.showSeconds} onChange={(v) => patch({ showSeconds: v })} onLabel="Seconds shown" offLabel="Minutes only" />
        </Row>

        <Row icon={Sparkles} title="Pulse at 5 minutes" hint="Subtle glow when time is nearly up">
          <ToggleRow on={s.pulseAtFiveMin} onChange={(v) => patch({ pulseAtFiveMin: v })} onLabel="Pulse on" offLabel="No pulse" />
        </Row>
      </div>
    </div>
  );
}

function ToggleRow({ on, onChange, onLabel, offLabel }: { on: boolean; onChange: (v: boolean) => void; onLabel: string; offLabel: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
      <span className="text-sm">{on ? onLabel : offLabel}</span>
      <Switch checked={on} onCheckedChange={onChange} />
    </div>
  );
}

function Row({ icon: Icon, title, hint, children }: { icon: any; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: GOLD }} />
        <div>
          <h3 className="text-sm font-bold leading-tight">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default OrbTimerSettingsPage;
