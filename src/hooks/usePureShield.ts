import { useCallback, useEffect, useRef, useState } from 'react';
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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setConfig(prev => ({ ...prev, ...patch }));
    try {
      await PureShieldPlugin.setConfig(patch);
    } catch (e) {
      console.warn('setConfig failed', e);
    }
  }, []);

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
      // Service শুরু হতে সময় লাগে — 3s পর্যন্ত poll করো
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
    const next = targetApps.includes(pkg)
      ? targetApps.filter(p => p !== pkg)
      : [...targetApps, pkg];
    setTargetApps(next);
    try {
      await PureShieldPlugin.setTargetApps({ packages: next });
    } catch (e) {
      console.warn('setTargetApps failed', e);
    }
  }, [targetApps]);

  // ─────────────────────────────────────────────────────
  // Live stats polling
  // ✅ Fix: (PureShieldPlugin as any).getLiveStats?.() বাদ
  // সরাসরি typed call করো
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!running) return;

    const poll = async () => {
      try {
        const [adaptive, model, stats] = await Promise.all([
          PureShieldPlugin.getAdaptiveStatus().catch(() => null),
          PureShieldPlugin.getModelStatus().catch(() => null),
          PureShieldPlugin.getLiveStats().catch(() => null), // ✅ properly typed
        ]);
        if (adaptive) setStatus(adaptive);
        if (model)    setModelStatus(model);
        if (stats)    setLiveStats(prev => ({ ...prev, ...stats }));
      } catch (e) {
        console.warn('Poll error:', e);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
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
