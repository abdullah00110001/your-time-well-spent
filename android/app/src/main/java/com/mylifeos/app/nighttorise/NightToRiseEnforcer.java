package com.mylifeos.app.nighttorise;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

/**
 * NightToRiseEnforcer — the ONLY place allowed to launch the Sleep to Rise
 * block screen. Called from the Shield accessibility service's single event
 * pipeline, so Shield and Sleep to Rise can never both launch for one event.
 *
 * Safety valve (prevents the launch storm that could restart the device):
 *   1. System-critical packages (SystemSafeList) are never blocked.
 *   2. Same package can be blocked at most once per 1.5 s.
 *   3. >5 launches in 10 s  → enforcement paused for 60 s.
 *   4. >20 launches in 60 s → safe mode tripped & persisted: Sleep to Rise
 *      stays off (even after a crash/restart) until the user turns it on again.
 * Every entry point is wrapped in try/catch so it can never kill the service.
 */
public final class NightToRiseEnforcer {

    private static final String TAG = "NightToRise";
    private static final long PER_PKG_MIN_GAP_MS = 1_500L;
    private static final long BURST_WINDOW_MS = 10_000L;
    private static final int  BURST_MAX = 5;
    private static final long BURST_COOLDOWN_MS = 60_000L;
    private static final long TRIP_WINDOW_MS = 60_000L;
    private static final int  TRIP_MAX = 20;

    private static volatile NightToRiseEnforcer sInstance;

    public static NightToRiseEnforcer get(Context ctx) {
        if (sInstance == null) {
            synchronized (NightToRiseEnforcer.class) {
                if (sInstance == null) sInstance = new NightToRiseEnforcer(ctx.getApplicationContext());
            }
        }
        return sInstance;
    }

    private final Context app;
    private final NightToRiseManager manager;
    private final Map<String, Long> lastPerPkg = new HashMap<>();
    private final ArrayDeque<Long> launches = new ArrayDeque<>();
    private long cooldownUntil = 0L;

    private NightToRiseEnforcer(Context app) {
        this.app = app;
        this.manager = new NightToRiseManager(app);
    }

    public NightToRiseManager manager() { return manager; }

    /** True when a Sleep/Rise lock window is currently active (for any package). */
    public boolean isLockActive(long now) {
        try {
            if (manager.prefs().isSafeModeTripped()) return false;
            NightToRiseManager.Phase p = manager.decide(now, null).phase;
            return p == NightToRiseManager.Phase.SLEEP_LOCK || p == NightToRiseManager.Phase.RISE_LOCK;
        } catch (Throwable t) { return false; }
    }

    /** Handle a foreground-app change. Returns true if the event was consumed (block shown). */
    public synchronized boolean onForegroundApp(String pkg) {
        try {
            if (pkg == null || SystemSafeList.isSafe(app, pkg)) return false;
            NightToRisePreferences prefs = manager.prefs();
            if (prefs.isSafeModeTripped()) return false;
            long now = System.currentTimeMillis();
            NightToRiseManager.Decision d = manager.decide(now, pkg);
            if (!d.shouldBlock) {
                if (d.phase != NightToRiseManager.Phase.SLEEP_LOCK
                    && d.phase != NightToRiseManager.Phase.RISE_LOCK
                    && prefs.strictUnlockRequestedAt() > 0) {
                    prefs.clearStrictUnlockRequest();
                }
                return false;
            }
            return launch(pkg, d, now);
        } catch (Throwable t) {
            Log.w(TAG, "onForegroundApp failed", t);
            return false;
        }
    }

    /** Handle a browser URL. Returns true if a block screen was shown. */
    public synchronized boolean onUrl(String url, String host, boolean domainHit, boolean keywordHit) {
        try {
            if (!domainHit && !keywordHit) return false;
            if (manager.prefs().isSafeModeTripped()) return false;
            long now = System.currentTimeMillis();
            NightToRiseManager.Decision d = manager.decide(now, null);
            if (d.phase != NightToRiseManager.Phase.SLEEP_LOCK && d.phase != NightToRiseManager.Phase.RISE_LOCK) return false;
            return launch("url:" + host, d, now);
        } catch (Throwable t) {
            Log.w(TAG, "onUrl failed", t);
            return false;
        }
    }

    private boolean launch(String key, NightToRiseManager.Decision d, long now) {
        if (now < cooldownUntil) {
            Log.w(TAG, "Loop guard cooldown active — skipping block for " + key);
            return false;
        }
        Long last = lastPerPkg.get(key);
        if (last != null && now - last < PER_PKG_MIN_GAP_MS) return true; // consume, no relaunch

        while (!launches.isEmpty() && now - launches.peekFirst() > TRIP_WINDOW_MS) launches.pollFirst();
        int inBurst = 0;
        for (Long ts : launches) if (now - ts <= BURST_WINDOW_MS) inBurst++;

        if (launches.size() >= TRIP_MAX) {
            Log.e(TAG, "Loop guard TRIPPED (" + launches.size() + " launches/min) — Sleep to Rise disabled into safe mode");
            manager.prefs().tripSafeMode();
            launches.clear();
            return false;
        }
        if (inBurst >= BURST_MAX) {
            Log.w(TAG, "Loop guard burst (" + inBurst + " in 10s) — pausing Sleep to Rise blocking for 60s");
            cooldownUntil = now + BURST_COOLDOWN_MS;
            return false;
        }

        lastPerPkg.put(key, now);
        launches.addLast(now);

        Intent i = new Intent(app, NightToRiseBlockActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        i.putExtra(NightToRiseBlockActivity.EXTRA_MESSAGE, d.message);
        i.putExtra(NightToRiseBlockActivity.EXTRA_END_MS, d.endTimeMs);
        i.putExtra(NightToRiseBlockActivity.EXTRA_STRICT, manager.prefs().strictMode());
        app.startActivity(i);
        return true;
    }
}
