import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  PureShieldPlugin,
  type PureShieldConfig,
  type PermissionStatus,
  type AdaptiveStatus,
  type InstalledApp,
  type ModelStatus,
  type LiveStats,
} from '@/lib/capacitor/pureShieldPlugin';

const DEFAULT_CONFIG: PureShieldConfig = {
  blurGender:            'BOTH',
  blurStyle:             'BLUR',
  confidenceThreshold:   0.60,
  blurOpacity:           100,
  blurPaddingPct:        15,
  minFaceSizePct:        2,
  maxFaces:              100,
  debugOverlay:          false,
  enabled:               false,
  pauseOnBatteryBelow20: true,
};

const DEFAULT_STATS: LiveStats = {
  totalFrames:      0,
  totalFaces:       0,
  totalBlurred:     0,
  lastInferenceMs:  0,
  lastDebugMessage: 'Not started yet',
  modelStatus:      'UNKNOWN',
};

const BACKGROUND_POLL_MS = 3000;

export function usePureShield() {
  const [config,        setConfig]        = useState<PureShieldConfig>(DEFAULT_CONFIG);
  const [permissions,   setPermissions]   = useState<PermissionStatus>({ overlay: false, projection: false });
  const [running,       setRunning]        = useState(false);
  const [status,        setStatus]         = useState<AdaptiveStatus | null>(null);
  const [targetApps,    setTargetApps]     = useState<string[]>([]);
  const [installedApps, setInstalledApps]  = useState<InstalledApp[]>([]);
  const [loading,       setLoading]        = useState(false);
  const [modelStatus,   setModelStatus]    = useState<ModelStatus>({ status: 'UNKNOWN' });
  const [liveStats,     setLiveStats]      = useState<LiveStats>(DEFAULT_STATS);

  const statsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─────────────────────────────────────────────────────
  // Refresh
  // ─────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const [p, c, r, t, m] = await Promise.all([
        PureShieldPlugin.checkPermissions(),
        PureShieldPlugin.getConfig().catch(() => DEFAULT_CONFIG),
        PureShieldPlugin.isRunning().catch(() => ({ running: false })),
        PureShieldPlugin.getTargetApps().catch(() => ({ packages: [] })),
        PureShieldPlugin.getModelStatus().catch(() => ({ status: 'UNKNOWN' as const })),
      ]);
      setPermissions(p);
      setConfig({ ...DEFAULT_CONFIG, ...c });
      setRunning(r.running);
      setTargetApps(t.packages);
      setModelStatus(m);
    } catch (e) {
      console.warn('PureShield refresh failed', e);
    }
  }, []);

  // ─────────────────────────────────────────────────────
  // Config
  // ─────────────────────────────────────────────────────
  const updateConfig = useCallback(async (patch: Partial<PureShieldConfig>) => {
    const previous = config;
    setConfig(prev => ({ ...prev, ...patch }));
    try {
      await PureShieldPlugin.setConfig(patch);
      const fresh = await PureShieldPlugin.getConfig();
      setConfig({ ...DEFAULT_CONFIG, ...fresh });
    } catch (e) {
      console.warn('setConfig failed', e);
      setConfig(previous);
      toast.error('Failed to update PureShield settings');
    }
  }, [config]);

  // ─────────────────────────────────────────────────────
  // Start / Stop
  // ─────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setLoading(true);
    try {
      const res = await PureShieldPlugin.startPureShield();
      setRunning(!!res.started);
      return !!res.started;
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      await PureShieldPlugin.stopPureShield();
      setRunning(false);
      setStatus(null);
      setLiveStats({ ...DEFAULT_STATS, lastDebugMessage: 'Stopped' });
    } finally {
      setLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────
  // Permissions
  // ─────────────────────────────────────────────────────
  const requestOverlay = useCallback(async () => {
    const r = await PureShieldPlugin.requestOverlayPermission();
    setPermissions(p => ({ ...p, overlay: r.granted }));
    return r.granted;
  }, []);

  const requestProjection = useCallback(async () => {
    const r = await PureShieldPlugin.requestMediaProjection();
    if (r.granted) {
      // The service takes a moment to spin up — poll briefly for a fast UI
      // update, but the background poll below will keep reconciling `running`
      // regardless, so a late-starting service is still picked up.
      let runningState = await PureShieldPlugin.isRunning().catch(() => ({ running: false }));
      for (let i = 0; i < 10 && !runningState.running; i++) {
        await new Promise(res => setTimeout(res, 300));
        runningState = await PureShieldPlugin.isRunning().catch(() => ({ running: false }));
      }
      setRunning(runningState.running);
      setPermissions(p => ({ ...p, projection: runningState.running }));
      const model = await PureShieldPlugin.getModelStatus().catch(() => null);
      if (model) setModelStatus(model);
    } else {
      setPermissions(p => ({ ...p, projection: false }));
    }
    return r.granted;
  }, []);

  // ─────────────────────────────────────────────────────
  // Apps
  // ─────────────────────────────────────────────────────
  const loadInstalledApps = useCallback(async () => {
    try {
      const { apps } = await PureShieldPlugin.getInstalledApps();
      setInstalledApps(apps);
    } catch (e) {
      console.warn('loadInstalledApps failed', e);
    }
  }, []);

  const toggleTargetApp = useCallback(async (pkg: string) => {
    const previous = targetApps;
    const next = previous.includes(pkg)
      ? previous.filter(p => p !== pkg)
      : [...previous, pkg];
    setTargetApps(next);
    try {
      await PureShieldPlugin.setTargetApps({ packages: next });
      const fresh = await PureShieldPlugin.getTargetApps();
      setTargetApps(fresh.packages);
    } catch (e) {
      console.warn('setTargetApps failed', e);
      setTargetApps(previous);
      toast.error('Failed to update target apps');
    }
  }, [targetApps]);

  // ─────────────────────────────────────────────────────
  // Background poll: keeps `running` in sync with native
  // regardless of what triggered the state change. This ensures
  // a late-starting service (e.g. after requestProjection gives up
  // waiting) is still picked up.
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await PureShieldPlugin.isRunning();
        setRunning(prev => (prev !== r.running ? r.running : prev));
      } catch (e) {
        // ignore — native bridge may not be ready yet
      }
    };
    poll();
    runningPollRef.current = setInterval(poll, BACKGROUND_POLL_MS);
    return () => {
      if (runningPollRef.current) { clearInterval(runningPollRef.current); runningPollRef.current = null; }
    };
  }, []);

  // ─────────────────────────────────────────────────────
  // Live stats polling — starts as soon as `running` flips true,
  // whether that came from start()/requestProjection() or the
  // background reconciliation poll above.
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (statsPollRef.current) {
      clearInterval(statsPollRef.current);
      statsPollRef.current = null;
    }
    if (!running) return;

    const poll = async () => {
      try {
        const [adaptive, model, stats] = await Promise.all([
          PureShieldPlugin.getAdaptiveStatus().catch(() => null),
          PureShieldPlugin.getModelStatus().catch(() => null),
          PureShieldPlugin.getLiveStats().catch(() => null),
        ]);
        if (adaptive) setStatus(adaptive);
        if (model)    setModelStatus(model);
        if (stats)    setLiveStats(prev => ({ ...prev, ...stats }));
      } catch (e) {
        console.warn('Poll error:', e);
      }
    };

    poll();
    statsPollRef.current = setInterval(poll, 1500);
    return () => {
      if (statsPollRef.current) { clearInterval(statsPollRef.current); statsPollRef.current = null; }
    };
  }, [running]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    config, permissions, running, status, modelStatus,
    liveStats, targetApps, installedApps, loading,
    refresh, updateConfig, start, stop,
    requestOverlay, requestProjection,
    loadInstalledApps, toggleTargetApp,
  };
}

export default usePureShield;
