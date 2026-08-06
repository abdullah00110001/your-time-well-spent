package com.mylifeos.app.shield.vision;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.*;
import android.util.Log;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * PureShieldAdaptiveEngine — v2
 *
 * Tier detection: RAM + CPU cores + CPU max freq (more accurate than RAM alone)
 * Battery: cached every 30s, not per-frame
 * Thermal: Android 10+ listener + legacy CPU temp polling fallback
 * Auto fall-back from fast mode after 5 seconds
 */
public class PureShieldAdaptiveEngine {

    private static final String TAG = "PureShield.Adaptive";

    // ── Tiers ─────────────────────────────────────────────────────────────────
    public enum DeviceTier { LOW, MID, HIGH }
    private final DeviceTier deviceTier;

    // ── Intervals (ms) ────────────────────────────────────────────────────────
    // LOW device:  ~1 FPS max  — no lag on weak SoCs
    // MID device:  ~2 FPS      — comfortable mid range
    // HIGH device: ~3-4 FPS    — fast enough for scrolling feeds
    private static final long INTERVAL_FAST   = 350;   // HIGH tier, app just opened
    private static final long INTERVAL_NORMAL = 550;   // HIGH tier baseline
    private static final long INTERVAL_MID    = 800;   // MID tier baseline
    private static final long INTERVAL_SLOW   = 1400;  // LOW tier baseline
    private static final long INTERVAL_IDLE   = 2500;  // thermal/battery throttle

    private volatile long currentIntervalMs;

    // ── Context ───────────────────────────────────────────────────────────────
    private final Context context;
    private PureShieldConfig config;

    // ── Thermal ───────────────────────────────────────────────────────────────
    private PowerManager.OnThermalStatusChangedListener thermalListener;
    private volatile int currentThermalStatus = 0; // THERMAL_STATUS_NONE

    // ── Battery cache — refresh every 30s, NOT per frame ─────────────────────
    private volatile int  cachedBatteryLevel = 100;
    private volatile boolean cachedCharging  = false;
    private volatile long lastBatteryCheckMs = 0L;
    private static final long BATTERY_CACHE_MS = 30_000;

    // ── Processing stats ──────────────────────────────────────────────────────
    private final AtomicInteger consecutiveSlowFrames = new AtomicInteger(0);
    private final AtomicLong    lastInferenceMs        = new AtomicLong(0);

    // ── Fast-mode auto fallback ───────────────────────────────────────────────
    private final ScheduledExecutorService scheduler =
        Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "PureShield-AdaptiveFallback");
            t.setPriority(Thread.MIN_PRIORITY);
            return t;
        });
    private ScheduledFuture<?> fastModeFallback;

    // ── Legacy thermal polling (pre-Android 10) ───────────────────────────────
    private ScheduledFuture<?> legacyThermalPoll;
    private static final float CPU_TEMP_THROTTLE  = 42.0f; // °C — slow down
    private static final float CPU_TEMP_EMERGENCY = 50.0f; // °C — idle

    // ─────────────────────────────────────────────────────────────────────────

    public PureShieldAdaptiveEngine(Context context) {
        this.context = context;
        this.config  = new PureShieldConfig();
        this.deviceTier = detectDeviceTier();
        this.currentIntervalMs = getBaseInterval();

        registerThermalListener();
        refreshBatteryCache(); // warm up cache immediately
        Log.i(TAG, "Tier: " + deviceTier
            + " | interval: " + currentIntervalMs + "ms"
            + " | battery: " + cachedBatteryLevel + "%");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tier detection — RAM + cores + CPU max frequency
    // ─────────────────────────────────────────────────────────────────────────

    private DeviceTier detectDeviceTier() {
        // 1. RAM
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        long ramMb = mi.totalMem / (1024 * 1024);

        // 2. CPU cores
        int cores = Runtime.getRuntime().availableProcessors();

        // 3. CPU max frequency (MHz) — more reliable indicator of SoC class
        long maxFreqMhz = readCpuMaxFreqMhz();

        Log.d(TAG, "RAM=" + ramMb + "MB cores=" + cores + " cpuMaxFreq=" + maxFreqMhz + "MHz");

        // HIGH: 6GB+ RAM, 8 cores, 2.4GHz+ (Snapdragon 7xx/8xx, Dimensity 8xx/9xx)
        if (ramMb >= 5500 && cores >= 8 && maxFreqMhz >= 2400) return DeviceTier.HIGH;

        // MID: 3GB+ RAM, 4+ cores, 1.8GHz+ (Snapdragon 6xx, Helio G8x, Dimensity 7xx)
        if (ramMb >= 2800 && cores >= 4 && maxFreqMhz >= 1800) return DeviceTier.MID;

        // LOW: everything else (Helio G35/G37/G85, Snapdragon 4xx, 2-3GB RAM)
        return DeviceTier.LOW;
    }

    /**
     * Read CPU max frequency from sysfs.
     * Returns 0 if unavailable.
     */
    private long readCpuMaxFreqMhz() {
        // Try the highest-numbered policy (big cluster = fastest cores)
        String[] paths = {
            "/sys/devices/system/cpu/cpu7/cpufreq/cpuinfo_max_freq",
            "/sys/devices/system/cpu/cpu6/cpufreq/cpuinfo_max_freq",
            "/sys/devices/system/cpu/cpu4/cpufreq/cpuinfo_max_freq",
            "/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq",
        };
        for (String path : paths) {
            try (BufferedReader br = new BufferedReader(new FileReader(path))) {
                String line = br.readLine();
                if (line != null) {
                    long khz = Long.parseLong(line.trim());
                    return khz / 1000; // convert kHz → MHz
                }
            } catch (Throwable ignored) {}
        }
        return 0;
    }

    private long getBaseInterval() {
        switch (deviceTier) {
            case HIGH: return INTERVAL_NORMAL;
            case MID:  return INTERVAL_MID;
            case LOW:  return INTERVAL_SLOW;
            default:   return INTERVAL_MID;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Thermal — Android 10+ listener + legacy CPU temp polling
    // ─────────────────────────────────────────────────────────────────────────

    private void registerThermalListener() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Modern: OS thermal API
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            thermalListener = status -> {
                currentThermalStatus = status;
                applyThermalThrottle(status);
            };
            pm.addThermalStatusListener(thermalListener);
            Log.d(TAG, "Thermal API listener registered (Android 10+)");
        } else {
            // Legacy: poll CPU temperature every 10s
            legacyThermalPoll = scheduler.scheduleAtFixedRate(
                this::checkLegacyCpuTemp, 10, 10, TimeUnit.SECONDS);
            Log.d(TAG, "Legacy CPU temp polling active (pre-Android 10)");
        }
    }

    private void applyThermalThrottle(int status) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        switch (status) {
            case PowerManager.THERMAL_STATUS_NONE:
            case PowerManager.THERMAL_STATUS_LIGHT:
                currentIntervalMs = getBaseInterval();
                Log.d(TAG, "Thermal OK — restored base interval");
                break;
            case PowerManager.THERMAL_STATUS_MODERATE:
                // Slow down but don't stop
                currentIntervalMs = deviceTier == DeviceTier.LOW
                    ? INTERVAL_IDLE : INTERVAL_SLOW;
                Log.w(TAG, "Thermal MODERATE — throttled to " + currentIntervalMs + "ms");
                break;
            case PowerManager.THERMAL_STATUS_SEVERE:
            case PowerManager.THERMAL_STATUS_CRITICAL:
            case PowerManager.THERMAL_STATUS_EMERGENCY:
            case PowerManager.THERMAL_STATUS_SHUTDOWN:
                currentIntervalMs = INTERVAL_IDLE;
                Log.w(TAG, "Thermal SEVERE — idle mode");
                break;
        }
    }

    /**
     * Legacy thermal check for Android 9 and below.
     * Reads CPU temperature from sysfs thermal zones.
     */
    private void checkLegacyCpuTemp() {
        float temp = readCpuTempCelsius();
        if (temp <= 0) return; // unreadable

        if (temp >= CPU_TEMP_EMERGENCY) {
            currentIntervalMs = INTERVAL_IDLE;
            Log.w(TAG, "CPU temp " + temp + "°C — emergency idle");
        } else if (temp >= CPU_TEMP_THROTTLE) {
            currentIntervalMs = Math.max(getBaseInterval(), INTERVAL_SLOW);
            Log.w(TAG, "CPU temp " + temp + "°C — throttled");
        } else {
            // Cool enough — restore base interval if we had throttled
            if (currentIntervalMs > getBaseInterval()) {
                currentIntervalMs = getBaseInterval();
                Log.d(TAG, "CPU temp " + temp + "°C — restored");
            }
        }
    }

    private float readCpuTempCelsius() {
        // Try common thermal zone paths
        String[] paths = {
            "/sys/class/thermal/thermal_zone0/temp",
            "/sys/class/thermal/thermal_zone1/temp",
            "/sys/devices/virtual/thermal/thermal_zone0/temp",
        };
        for (String path : paths) {
            try (BufferedReader br = new BufferedReader(new FileReader(path))) {
                String line = br.readLine();
                if (line != null) {
                    float raw = Float.parseFloat(line.trim());
                    // Some devices report in millidegrees
                    return raw > 1000 ? raw / 1000f : raw;
                }
            } catch (Throwable ignored) {}
        }
        return 0f;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Frame skip decision
    // ─────────────────────────────────────────────────────────────────────────

    public boolean shouldSkipFrame() {
        // 1. Critical battery (< 5%) and not charging → stop entirely
        if (cachedBatteryLevel < 5 && !cachedCharging) return true;

        // 2. Low battery on LOW device → idle mode
        if (cachedBatteryLevel < 15 && !cachedCharging && deviceTier == DeviceTier.LOW) {
            currentIntervalMs = INTERVAL_IDLE;
        }

        // 3. Thermal critical (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE) {
            return true;
        }

        // 4. Inference backpressure — if last frame took >2x interval, skip
        long lastMs = lastInferenceMs.get();
        if (lastMs > 0 && lastMs > currentIntervalMs * 2) {
            int slow = consecutiveSlowFrames.incrementAndGet();
            if (slow >= 3) {
                // Back off exponentially, capped at INTERVAL_IDLE
                currentIntervalMs = Math.min(currentIntervalMs * 2, INTERVAL_IDLE);
                consecutiveSlowFrames.set(0);
                Log.w(TAG, "Slow inference (" + lastMs + "ms) — backed off to " + currentIntervalMs + "ms");
            }
            return true; // skip this frame
        }

        // 5. Inference fast → gradually recover interval
        if (lastMs > 0 && lastMs < currentIntervalMs * 0.4f) {
            consecutiveSlowFrames.set(0);
            if (currentIntervalMs > getBaseInterval()) {
                currentIntervalMs = Math.max(getBaseInterval(), currentIntervalMs - 100);
            }
        }

        return false;
    }

    public void recordInferenceTime(long durationMs) {
        lastInferenceMs.set(durationMs);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Battery cache — called from background, NOT per-frame
    // ─────────────────────────────────────────────────────────────────────────

    private void refreshBatteryCache() {
        long now = SystemClock.elapsedRealtime();
        if (now - lastBatteryCheckMs < BATTERY_CACHE_MS) return;
        lastBatteryCheckMs = now;
        try {
            IntentFilter iFilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent bs = context.registerReceiver(null, iFilter);
            if (bs == null) return;
            int level = bs.getIntExtra(BatteryManager.EXTRA_LEVEL, 100);
            int scale = bs.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            cachedBatteryLevel = (int)((level / (float) scale) * 100);
            int status = bs.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            cachedCharging = status == BatteryManager.BATTERY_STATUS_CHARGING
                          || status == BatteryManager.BATTERY_STATUS_FULL;
        } catch (Exception e) {
            Log.w(TAG, "Battery read failed: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Capture resolution
    // ─────────────────────────────────────────────────────────────────────────

    public int getCaptureWidth(int screenWidth) {
        switch (deviceTier) {
            case HIGH: return Math.min(screenWidth, 720);
            case MID:  return Math.min(screenWidth, 480);  // was 540 — reduced for MID
            case LOW:  return Math.min(screenWidth, 320);  // was 360 — reduced for LOW
            default:   return 480;
        }
    }

    public int getCaptureHeight(int screenHeight) {
        switch (deviceTier) {
            case HIGH: return Math.min(screenHeight, 1280);
            case MID:  return Math.min(screenHeight, 854);
            case LOW:  return Math.min(screenHeight, 568);
            default:   return 854;
        }
    }

    public int getInferenceThreadCount() {
        switch (deviceTier) {
            case HIGH: return 4;
            case MID:  return 2;
            case LOW:  return 1;
            default:   return 2;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Interval
    // ─────────────────────────────────────────────────────────────────────────

    public long getSampleIntervalMs() {
        // Refresh battery cache lazily here (cheap — only actually reads every 30s)
        refreshBatteryCache();
        return currentIntervalMs;
    }

    /**
     * Called when user opens a target app.
     * Temporarily boosts to FAST interval, then auto-falls back after 5s.
     */
    public void onTargetAppResumed() {
        if (deviceTier == DeviceTier.LOW) return; // LOW devices: no boost
        currentIntervalMs = INTERVAL_FAST;
        consecutiveSlowFrames.set(0);

        // Cancel previous fallback if any
        if (fastModeFallback != null && !fastModeFallback.isDone()) {
            fastModeFallback.cancel(false);
        }
        // Auto-restore base interval after 5 seconds
        fastModeFallback = scheduler.schedule(
            () -> {
                if (currentIntervalMs == INTERVAL_FAST) {
                    currentIntervalMs = getBaseInterval();
                    Log.d(TAG, "Fast-mode expired — restored to " + currentIntervalMs + "ms");
                }
            },
            5, TimeUnit.SECONDS
        );
    }

    public void onConfigChanged(PureShieldConfig newConfig) {
        this.config = newConfig;
        currentIntervalMs = getBaseInterval();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────────────────

    public void destroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && thermalListener != null) {
            try {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                pm.removeThermalStatusListener(thermalListener);
            } catch (Throwable ignored) {}
        }
        if (legacyThermalPoll != null) legacyThermalPoll.cancel(true);
        if (fastModeFallback  != null) fastModeFallback.cancel(true);
        scheduler.shutdownNow();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Status for UI/debug
    // ─────────────────────────────────────────────────────────────────────────

    public AdaptiveStatus getStatus() {
        return new AdaptiveStatus(
            deviceTier.name(),
            currentIntervalMs,
            cachedBatteryLevel,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? currentThermalStatus : -1,
            lastInferenceMs.get()
        );
    }

    public static class AdaptiveStatus {
        public final String deviceTier;
        public final long   sampleIntervalMs;
        public final int    batteryLevel;
        public final int    thermalStatus;
        public final long   lastInferenceMs;

        AdaptiveStatus(String tier, long interval, int battery, int thermal, long lastMs) {
            this.deviceTier      = tier;
            this.sampleIntervalMs = interval;
            this.batteryLevel    = battery;
            this.thermalStatus   = thermal;
            this.lastInferenceMs = lastMs;
        }
    }
}
