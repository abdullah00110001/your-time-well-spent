package com.mylifeos.app.shield.core;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Log;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/**
 * Centralizes ALL cooldown / rate-limit logic for the Shield interception pipeline so
 * that no other class needs to hand-roll timestamps. Prevents:
 *  - Rapid-fire re-triggering on the same package (per-package cooldown).
 *  - A global "just blocked, don't immediately block again" cooldown.
 *  - Infinite block <-> re-open loops by hard-capping the number of block actions allowed
 *    inside a rolling window; once exceeded it backs off entirely (soft-fails + logs)
 *    rather than acting.
 *
 * The current launcher package and this app's own package are always exempt.
 */
public final class BlockLoopGuard {

    private static final String TAG = "BlockLoopGuard";

    /** Minimum time between any two actions against the SAME package. */
    private static final long PER_PACKAGE_COOLDOWN_MS = 1500;

    /** Minimum time between any two block actions globally (any package). */
    private static final long GLOBAL_POST_BLOCK_COOLDOWN_MS = 1200;

    /** Rolling window used to count consecutive triggers for escalation + the hard cap. */
    private static final long TRIGGER_WINDOW_MS = 15_000;

    /** Inside TRIGGER_WINDOW_MS, this many triggers for the SAME package escalates to hard block. */
    private static final int HARD_BLOCK_TRIGGER_THRESHOLD = 2;

    /** Absolute hard cap: never allow more than this many block actions (any package) inside the window. */
    private static final int MAX_ACTIONS_PER_WINDOW = 6;

    private final Context appContext;
    private final String ownPackage;
    private String launcherPackage;

    private long lastGlobalActionTime = 0L;
    private final Map<String, Long> lastActionTimeByPackage = new HashMap<>();
    private final Map<String, Deque<Long>> triggerTimestampsByPackage = new HashMap<>();
    private final Deque<Long> globalActionTimestamps = new ArrayDeque<>();

    private boolean backingOff = false;
    private long backoffUntil = 0L;
    private static final long BACKOFF_COOLDOWN_MS = 20_000;

    public BlockLoopGuard(Context context) {
        this.appContext = context.getApplicationContext();
        this.ownPackage = appContext.getPackageName();
        this.launcherPackage = resolveLauncherPackage(appContext);
    }

    private static String resolveLauncherPackage(Context context) {
        try {
            PackageManager pm = context.getPackageManager();
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            ResolveInfo resolveInfo = pm.resolveActivity(homeIntent, PackageManager.MATCH_DEFAULT_ONLY);
            if (resolveInfo != null && resolveInfo.activityInfo != null) {
                return resolveInfo.activityInfo.packageName;
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to resolve launcher package", t);
        }
        return null;
    }

    /** Re-resolves the launcher package (call if the default launcher may have changed). */
    public void refreshLauncherPackage() {
        this.launcherPackage = resolveLauncherPackage(appContext);
    }

    private boolean isExempt(String packageName) {
        if (packageName == null) return true;
        if (packageName.equals(ownPackage)) return true;
        if (launcherPackage != null && packageName.equals(launcherPackage)) return true;
        return false;
    }

    /**
     * Whether a SOFT action (back navigation + toast, no full-screen takeover) is allowed
     * right now for this package: first offense within the window, package not exempt,
     * and cooldowns respected.
     */
    public synchronized boolean shouldSoftBlock(String packageName) {
        if (isExempt(packageName)) return false;
        if (isBackingOff()) return false;
        if (!respectsCooldowns(packageName)) return false;
        return getRecentTriggerCount(packageName) < HARD_BLOCK_TRIGGER_THRESHOLD;
    }

    /**
     * Whether a HARD action (full-screen ShieldBlockActivity) should fire: repeat offense
     * within the window for this package, package not exempt, cooldowns respected, and the
     * global hard cap has not been exceeded.
     */
    public synchronized boolean shouldHardBlock(String packageName) {
        if (isExempt(packageName)) return false;
        if (isBackingOff()) return false;
        if (!respectsCooldowns(packageName)) return false;
        if (exceedsGlobalCap()) {
            enterBackoff();
            return false;
        }
        return getRecentTriggerCount(packageName) >= HARD_BLOCK_TRIGGER_THRESHOLD;
    }

    /** Force a hard block regardless of soft/hard escalation state (e.g. strict mode). Still respects the hard cap + cooldowns. */
    public synchronized boolean shouldForceHardBlock(String packageName) {
        if (isExempt(packageName)) return false;
        if (isBackingOff()) return false;
        if (!respectsCooldowns(packageName)) return false;
        if (exceedsGlobalCap()) {
            enterBackoff();
            return false;
        }
        return true;
    }

    private boolean respectsCooldowns(String packageName) {
        long now = System.currentTimeMillis();
        if (now - lastGlobalActionTime < GLOBAL_POST_BLOCK_COOLDOWN_MS) return false;
        Long lastForPkg = lastActionTimeByPackage.get(packageName);
        if (lastForPkg != null && now - lastForPkg < PER_PACKAGE_COOLDOWN_MS) return false;
        return true;
    }

    private boolean isBackingOff() {
        long now = System.currentTimeMillis();
        if (backingOff && now >= backoffUntil) {
            backingOff = false;
        }
        return backingOff;
    }

    private void enterBackoff() {
        backingOff = true;
        backoffUntil = System.currentTimeMillis() + BACKOFF_COOLDOWN_MS;
        Log.w(TAG, "Block-loop guard tripped: more than " + MAX_ACTIONS_PER_WINDOW
            + " actions within " + TRIGGER_WINDOW_MS + "ms — backing off for "
            + BACKOFF_COOLDOWN_MS + "ms instead of acting.");
    }

    private boolean exceedsGlobalCap() {
        pruneOld(globalActionTimestamps);
        return globalActionTimestamps.size() >= MAX_ACTIONS_PER_WINDOW;
    }

    private int getRecentTriggerCount(String packageName) {
        Deque<Long> timestamps = triggerTimestampsByPackage.get(packageName);
        if (timestamps == null) return 0;
        pruneOld(timestamps);
        return timestamps.size();
    }

    private void pruneOld(Deque<Long> timestamps) {
        long now = System.currentTimeMillis();
        while (!timestamps.isEmpty() && now - timestamps.peekFirst() > TRIGGER_WINDOW_MS) {
            timestamps.pollFirst();
        }
    }

    /**
     * Records that an interception actually fired for this package (soft or hard). Must be
     * called exactly once per real action so escalation counting stays accurate.
     */
    public synchronized void registerTrigger(String packageName) {
        if (isExempt(packageName)) return;
        long now = System.currentTimeMillis();
        lastGlobalActionTime = now;
        lastActionTimeByPackage.put(packageName, now);

        Deque<Long> timestamps = triggerTimestampsByPackage.get(packageName);
        if (timestamps == null) {
            timestamps = new ArrayDeque<>();
            triggerTimestampsByPackage.put(packageName, timestamps);
        }
        timestamps.addLast(now);
        pruneOld(timestamps);

        globalActionTimestamps.addLast(now);
        pruneOld(globalActionTimestamps);
    }

    /** Clears escalation state for a package (e.g. user navigated away cleanly, or timer expired). */
    public synchronized void reset(String packageName) {
        lastActionTimeByPackage.remove(packageName);
        triggerTimestampsByPackage.remove(packageName);
    }

    /** Clears all state, including the global backoff. */
    public synchronized void resetAll() {
        lastActionTimeByPackage.clear();
        triggerTimestampsByPackage.clear();
        globalActionTimestamps.clear();
        backingOff = false;
        backoffUntil = 0L;
        lastGlobalActionTime = 0L;
    }
}
