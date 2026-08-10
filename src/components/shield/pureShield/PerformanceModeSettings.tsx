// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Performance Mode + Detection Model picker. Persists locally and pushes the
// derived thresholds down to the native PureShield config.

import { useEffect, useState } from 'react';
import { Gauge, Cpu, Activity } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  loadPerf, savePerf, perfToNativeConfig,
  type PureShieldPerfSettings, type PerformanceMode, type DetectionModel,
} from '@/lib/shield/settingsStore';

const GOLD = 'hsl(var(--primary))';

const MODES: { id: PerformanceMode; label: string; hint: string }[] = [
  { id: 'LOW', label: 'Low', hint: 'Least lag, basic detection' },
  { id: 'MEDIUM', label: 'Medium', hint: 'Balanced for most phones' },
  { id: 'HIGH', label: 'High', hint: 'Best detection, more CPU' },
];

const MODELS: { id: DetectionModel; label: string; hint: string }[] = [
  { id: 'FAST', label: 'Fast Model', hint: 'Less accurate, 0 lag. Good for old phones' },
  { id: 'BALANCED', label: 'Balanced Model', hint: 'Default. Good accuracy + speed' },
  { id: 'ACCURATE', label: 'Accurate Model', hint: 'Best face/body detection, uses more battery' },
];

interface Props {
  /** Push derived thresholds to the native layer. */
  onNativeConfig?: (patch: Record<string, number>) => void;
  fps?: number;
}

export function PerformanceModeSettings({ onNativeConfig, fps }: Props) {
  const [perf, setPerf] = useState<PureShieldPerfSettings>(loadPerf);

  const patch = (p: Partial<PureShieldPerfSettings>) => {
    const next = { ...perf, ...p };
    setPerf(next);
    savePerf(next);
    if ('performanceMode' in p || 'detectionModel' in p) {
      onNativeConfig?.(perfToNativeConfig(next));
    }
  };

  // Re-apply on mount so native always matches what the UI shows.
  useEffect(() => {
    onNativeConfig?.(perfToNativeConfig(perf));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <Section icon={Gauge} title="Performance Mode" subtitle="Detection quality vs. battery & lag">
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => patch({ performanceMode: m.id })}
              className={cn(
                'rounded-xl border px-2 py-3 text-center transition-all',
                perf.performanceMode === m.id
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40',
              )}
            >
              <span className="block text-sm font-semibold">{m.label}</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5 leading-tight">{m.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Cpu} title="Detection Model" subtitle="Which on-device model PureShield runs">
        <div className="space-y-2">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => patch({ detectionModel: m.id })}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all',
                perf.detectionModel === m.id
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40',
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{
                  background: perf.detectionModel === m.id ? GOLD : 'hsl(var(--muted-foreground) / 0.4)',
                  boxShadow: perf.detectionModel === m.id ? `0 0 10px ${GOLD}` : undefined,
                }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Activity} title="Debug FPS counter" subtitle="Show live frame rate while filtering">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
          <span className="text-sm">
            {perf.showFps ? `Current: ${fps != null ? fps.toFixed(1) : '—'} FPS` : 'Hidden'}
          </span>
          <Switch checked={perf.showFps} onCheckedChange={(v) => patch({ showFps: v })} />
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon, title, subtitle, children,
}: { icon: any; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: GOLD }} />
        <div>
          <h3 className="text-sm font-bold leading-tight">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default PerformanceModeSettings;
