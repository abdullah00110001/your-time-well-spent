import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Lock, Zap, Brain, ShieldCheck, AlertTriangle, PackageX,
  MoreVertical, RotateCcw, Bug, Download, Activity, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePureShield } from '@/hooks/usePureShield';
import { GenderSelector } from './GenderSelector';
import { BlurStyleSelector } from './BlurStyleSelector';
import { AppSelectorList } from './AppSelectorList';
import { PerformanceMetrics } from './PerformanceMetrics';
import { PermissionRequestScreen } from './PermissionRequestScreen';
import { DashboardTab } from './DashboardTab';
import { StatsTab } from './StatsTab';
import { TestBlurDemo } from './TestBlurDemo';
import {
  loadExtras, saveExtras, loadStats, DEFAULT_EXTRAS, type LocalShieldExtras,
} from './storage';
import type { PureShieldMetrics } from './types';

interface PureShieldMainSettingsProps {
  onBack: () => void;
}

export function PureShieldMainSettings({ onBack }: PureShieldMainSettingsProps) {
  const {
    config, permissions, running, status, modelStatus,
    liveStats, targetApps, installedApps, loading,
    updateConfig, start, stop,
    requestOverlay, requestProjection,
    loadInstalledApps, toggleTargetApp,
  } = usePureShield();

  const [extras, setExtras] = useState<LocalShieldExtras>(loadExtras);
  const [demoOpen, setDemoOpen] = useState(false);
  const [tab, setTab] = useState('home');

  const stats = useMemo(() => loadStats(), [tab]);
  const appLabels = useMemo(
    () => Object.fromEntries(installedApps.map((a) => [a.packageName, a.appName])),
    [installedApps],
  );

  useEffect(() => {
    if (installedApps.length === 0) loadInstalledApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchExtras = (p: Partial<LocalShieldExtras>) => {
    const next = { ...extras, ...p };
    setExtras(next);
    saveExtras(next);
    const nativePatch: Record<string, number | boolean> = {};
    if ('blurOpacity' in p) nativePatch.blurOpacity = next.blurOpacity;
    if ('minFaceSizePct' in p) nativePatch.minFaceSizePct = next.minFaceSizePct;
    if ('debugOverlay' in p) nativePatch.debugOverlay = next.debugOverlay;
    if ('blurSensitivity' in p) nativePatch.confidenceThreshold = Math.max(0.35, Math.min(0.95, next.blurSensitivity / 100));
    if (Object.keys(nativePatch).length > 0) updateConfig(nativePatch as any);
  };

  const allPermsGranted = permissions.overlay && permissions.projection;

  const handleToggle = async (v: boolean) => {
    if (loading) return; // prevent multi-tap
    try {
      if (v) {
        // Overlay permission is sticky — request once.
        if (!permissions.overlay) {
          const granted = await requestOverlay();
          if (!granted) {
            toast.error('Overlay permission required');
            return;
          }
        }
        // Screen capture token is one-shot — always re-request when starting.
        // This is normal Android behavior, not an error.
        const projOk = await requestProjection();
        if (!projOk) {
          toast.error('Screen capture permission denied');
          return;
        }
        await updateConfig({ enabled: true });
        toast.success('PureShield activated 🛡️');
      } else {
        await stop();
        await updateConfig({ enabled: false });
        toast.success('PureShield stopped');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    }
  };

  const handlePause5m = async () => {
    if (!running) return;
    await stop();
    toast.info('Paused for 5 minutes', { description: 'PureShield will auto-resume.' });
    setTimeout(async () => {
      try {
        await start();
        toast.success('PureShield resumed');
      } catch {/* ignore */}
    }, 5 * 60 * 1000);
  };

  const handleEmergencyStop = async () => {
    await stop();
    await updateConfig({ enabled: false });
    toast.error('Emergency stop — all filtering halted');
  };

  const handleReset = async () => {
    setExtras(DEFAULT_EXTRAS);
    saveExtras(DEFAULT_EXTRAS);
    await updateConfig({
      blurGender: 'BOTH',
      blurStyle: 'BLUR',
      confidenceThreshold: 0.60,
      blurOpacity: DEFAULT_EXTRAS.blurOpacity,
      minFaceSizePct: DEFAULT_EXTRAS.minFaceSizePct,
      debugOverlay: DEFAULT_EXTRAS.debugOverlay,
      maxFaces: 100,
      pauseOnBatteryBelow20: true,
    });
    toast.success('Settings reset to defaults');
  };

  const handleExportLogs = () => {
    const payload = {
      timestamp: new Date().toISOString(),
      config,
      extras,
      status,
      modelStatus,
      targetApps,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pureshield-logs-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const metrics: PureShieldMetrics | null = status
    ? {
        deviceTier: (status.deviceTier as any) || 'MID',
        sampleIntervalMs: status.sampleIntervalMs,
        lastInferenceMs: status.lastInferenceMs,
        batteryLevel: status.batteryLevel,
        thermalStatus:
          status.thermalStatus === 0 ? 'Normal' : status.thermalStatus === 1 ? 'Warning' : 'Critical',
      }
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/50">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-base">PureShield</h1>
            <p className="text-[11px] text-muted-foreground">On-device visual filtering</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDemoOpen(true)}>
                <Eye className="h-4 w-4 mr-2" /> Test blur preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportLogs}>
                <Download className="h-4 w-4 mr-2" /> Export logs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {modelStatus?.status === 'MODEL_EMPTY' && (
          <ModelBanner
            tone="amber"
            icon={PackageX}
            title="মডেল ইম্পটি"
            body="কোনো AI মডেল bundled নেই। PureShield চালাতে অন্তত একটি .tflite মডেল assets-এ যুক্ত করতে হবে।"
          />
        )}
        {modelStatus?.status === 'MODEL_FAILED' && (
          <ModelBanner
            tone="rose"
            icon={AlertTriangle}
            title="মডেল কাজ করে না"
            body={
              modelStatus.reason
                ? `কারণ: ${modelStatus.reason}`
                : 'AI মডেল লোড করতে পারেনি — ডিভাইস সাপোর্ট বা মডেল ফাইলে সমস্যা।'
            }
          />
        )}

        {!allPermsGranted ? (
          <PermissionRequestScreen
            overlayGranted={permissions.overlay}
            projectionGranted={permissions.projection}
            onRequestOverlay={async () => {
              const ok = await requestOverlay();
              if (ok) toast.success('Overlay permission granted');
            }}
            onRequestProjection={async () => {
              const ok = await requestProjection();
              if (ok) toast.success('Screen capture permission granted');
            }}
          />
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="w-full grid grid-cols-5 h-auto">
              <TabsTrigger value="home" className="text-[11px] px-1 py-2">Home</TabsTrigger>
              <TabsTrigger value="apps" className="text-[11px] px-1 py-2">Apps</TabsTrigger>
              <TabsTrigger value="settings" className="text-[11px] px-1 py-2">Settings</TabsTrigger>
              <TabsTrigger value="stats" className="text-[11px] px-1 py-2">Stats</TabsTrigger>
              <TabsTrigger value="advanced" className="text-[11px] px-1 py-2">Advanced</TabsTrigger>
            </TabsList>

            {/* HOME */}
            <TabsContent value="home">
              <DashboardTab
                running={running}
                metrics={metrics}
                onToggle={handleToggle}
                onPause5m={handlePause5m}
                onTestBlur={() => setDemoOpen(true)}
                onEmergencyStop={handleEmergencyStop}
                showFps={extras.showFps}
                liveStats={liveStats}
                loading={loading}
              />
            </TabsContent>

            {/* APPS */}
            <TabsContent value="apps" className="mt-5">
              <AppSelectorList
                apps={installedApps}
                selectedApps={targetApps}
                onToggle={toggleTargetApp}
                onSelectAll={(pkgs) => {
                  pkgs.filter((p) => !targetApps.includes(p)).forEach((p) => toggleTargetApp(p));
                }}
                onClearAll={() => targetApps.forEach((p) => toggleTargetApp(p))}
                loading={loading && installedApps.length === 0}
                emptyHint="No installed apps available."
              />
            </TabsContent>

            {/* SETTINGS */}
            <TabsContent value="settings" className="space-y-6 mt-5">
              <Section title="Gender to Blur">
                <GenderSelector
                  selectedGender={config.blurGender}
                  onGenderChange={(g) => updateConfig({ blurGender: g })}
                />
              </Section>

              <Section title="Blur Style">
                <BlurStyleSelector
                  selectedStyle={config.blurStyle}
                  onStyleChange={(s) => updateConfig({ blurStyle: s })}
                />
              </Section>

              <SliderRow
                title="Detection Confidence"
                hint="Sensitive ↔ Strict"
                value={Math.round(config.confidenceThreshold * 100)}
                min={50}
                max={95}
                step={5}
                suffix="%"
                onChange={(v) => updateConfig({ confidenceThreshold: v / 100 })}
              />

              <SliderRow
                title="Min Face Size"
                hint="Skip tiny faces"
                value={extras.minFaceSizePct}
                min={1}
                max={30}
                step={1}
                suffix="%"
                onChange={(v) => patchExtras({ minFaceSizePct: v })}
              />

              <SliderRow
                title="Blur Sensitivity"
                hint="Lower → more blur"
                value={extras.blurSensitivity}
                min={10}
                max={100}
                step={5}
                suffix="%"
                onChange={(v) => patchExtras({ blurSensitivity: v })}
              />

              <SliderRow
                title="Blur Opacity"
                hint="How opaque the overlay is"
                value={extras.blurOpacity}
                min={20}
                max={100}
                step={5}
                suffix="%"
                onChange={(v) => patchExtras({ blurOpacity: v })}
              />

              <Section title="Options">
                <div className="rounded-2xl border border-border/50 divide-y divide-border/50">
                  <ToggleRow
                    label="Pause when battery < 20%"
                    description="Save power on low battery"
                    checked={config.pauseOnBatteryBelow20}
                    onChange={(v) => updateConfig({ pauseOnBatteryBelow20: v })}
                  />
                  <ToggleRow
                    label="Pause on low memory"
                    description="Skip frames under memory pressure"
                    checked={extras.pauseOnLowMemory}
                    onChange={(v) => patchExtras({ pauseOnLowMemory: v })}
                  />
                </div>
              </Section>

              <Button variant="outline" className="w-full" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to defaults
              </Button>
            </TabsContent>

            {/* STATS */}
            <TabsContent value="stats">
              <StatsTab stats={stats} appLabels={appLabels} />
            </TabsContent>

            {/* ADVANCED */}
            <TabsContent value="advanced" className="space-y-6 mt-5">
              <Section title="Performance Metrics">
                <PerformanceMetrics metrics={metrics} />
              </Section>

              <Section title="How It Works">
                <div className="grid grid-cols-2 gap-2.5">
                  <InfoCard icon={Lock} title="100% On-Device" desc="Nothing leaves your phone" />
                  <InfoCard icon={Zap} title="Adaptive Quality" desc="Tunes to device & battery" />
                  <InfoCard icon={Brain} title="AI Detection" desc="BlazeFace + MobileNetV3" />
                  <InfoCard icon={ShieldCheck} title="Zero Sharing" desc="No analytics, no upload" />
                </div>
              </Section>

              <Section title="Debugging">
                <div className="rounded-2xl border border-border/50 divide-y divide-border/50">
                  <ToggleRow
                    label="Debug overlay"
                    description="Show face bounding boxes"
                    checked={extras.debugOverlay}
                    onChange={(v) => patchExtras({ debugOverlay: v })}
                  />
                  <ToggleRow
                    label="Show FPS counter"
                    description="Live frame rate on the dashboard"
                    checked={extras.showFps}
                    onChange={(v) => patchExtras({ showFps: v })}
                  />
                </div>
                <Button variant="outline" className="w-full mt-3" onClick={handleExportLogs}>
                  <Download className="h-4 w-4 mr-2" />
                  Export diagnostic logs
                </Button>
              </Section>

              <div className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
                <Activity className="h-5 w-5 text-primary" />
                <div className="text-xs text-muted-foreground">
                  PureShield v1 · Powered by{' '}
                  <span className="font-medium text-foreground">BlazeFace + MobileNetV3</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <TestBlurDemo open={demoOpen} onClose={() => setDemoOpen(false)} style={config.blurStyle} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function Section({
  title, children, rightSlot,
}: { title: string; children: React.ReactNode; rightSlot?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">{title}</h2>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

function SliderRow({
  title, hint, value, min, max, step, suffix, onChange,
}: {
  title: string; hint: string; value: number;
  min: number; max: number; step: number; suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <Section
      title={title}
      rightSlot={<span className="text-xs font-medium text-primary">{value}{suffix}</span>}
    >
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={title} />
      <div className="text-[11px] text-muted-foreground mt-2 px-1">{hint}</div>
    </Section>
  );
}

function ToggleRow({
  label, description, checked, onChange,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function InfoCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <div className="text-xs font-semibold">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
    </div>
  );
}

function ModelBanner({
  tone, icon: Icon, title, body,
}: { tone: 'amber' | 'rose'; icon: any; title: string; body: string }) {
  const t = tone === 'amber'
    ? 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400'
    : 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400';
  return (
    <div className={`rounded-2xl border p-4 flex gap-3 ${t}`}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{body}</div>
      </div>
    </div>
  );
}

export default PureShieldMainSettings;
