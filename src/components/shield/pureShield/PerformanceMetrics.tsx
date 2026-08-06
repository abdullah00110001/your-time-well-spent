import { Cpu, Gauge, Timer, BatteryMedium, Thermometer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PureShieldMetrics } from './types';

interface PerformanceMetricsProps {
  metrics: PureShieldMetrics | null;
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  if (!metrics) {
    return (
      <div className="rounded-2xl border border-border/50 p-4 text-center text-xs text-muted-foreground">
        Performance metrics will appear when PureShield is running.
      </div>
    );
  }

  const batteryColor =
    metrics.batteryLevel > 50 ? 'text-emerald-500' : metrics.batteryLevel > 20 ? 'text-amber-500' : 'text-red-500';
  const thermalColor =
    metrics.thermalStatus === 'Normal'
      ? 'text-emerald-500'
      : metrics.thermalStatus === 'Warning'
        ? 'text-amber-500'
        : 'text-red-500';

  const cards = [
    { icon: Cpu, label: 'Device Tier', value: metrics.deviceTier, color: 'text-primary' },
    { icon: Gauge, label: 'Sample Rate', value: `${metrics.sampleIntervalMs}ms`, color: 'text-violet-500' },
    { icon: Timer, label: 'Last Inference', value: `${metrics.lastInferenceMs}ms`, color: 'text-cyan-500' },
    { icon: BatteryMedium, label: 'Battery', value: `${metrics.batteryLevel}%`, color: batteryColor },
    { icon: Thermometer, label: 'Thermal', value: metrics.thermalStatus, color: thermalColor },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border/50 bg-card p-3">
          <div className="flex items-center gap-2">
            <c.icon className={cn('h-4 w-4', c.color)} />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{c.label}</span>
          </div>
          <div className={cn('mt-1.5 text-base font-semibold', c.color)}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

export default PerformanceMetrics;
