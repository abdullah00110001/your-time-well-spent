package com.mylifeos.app.shield;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import java.util.Calendar;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ⏱️ Daily app time-limit enforcement.
 *
 * Previously this class only logged — limits were effectively dead. It now:
 *   1. reads the real foreground usage for TODAY from UsageStatsManager,
 *   2. fires a single "low time" alert at ≤5 minutes remaining,
 *   3. actually blocks the app (full-screen ShieldBlockActivity) once the limit is spent.
 *
 * Safety: every enforcement path is throttled per package so a user who keeps
 * reopening a limited app cannot be trapped in a block/relaunch loop — the
 * BlockLoopGuard inside ShieldBlockActivity is the second line of defence.
 */
public class ShieldTimerManager {

    private static final String TAG = "ShieldTimer";

    /** Minimum gap between two enforcement evaluations for the same package. */
    private static final long CHECK_THROTTLE_MS = 15_000L;

    /** Minimum gap between two block screens for the same package. */
    private static final long BLOCK_THROTTLE_MS = 60_000L;

    private final Context context;
    private final ShieldPreferences prefs;
    private final ShieldNotificationManager notifier;

    private final Map<String, Long> lastCheck = new ConcurrentHashMap<>();
    private final Map<String, Long> lastBlock = new ConcurrentHashMap<>();
    private final Map<String, String> alertedOn = new ConcurrentHashMap<>();

    public ShieldTimerManager(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = new ShieldPreferences(this.context);
        this.notifier = new ShieldNotificationManager(this.context);
    }

    /**
     * Called on every foreground-app change. Cheap and throttled — safe to call often.
     *
     * @return true if the app was blocked (caller should stop further handling).
     */
    public boolean enforce(String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;
        if (packageName.equals(context.getPackageName())) return false;

        int limit = prefs.getAppLimit(packageName);
        if (limit <= 0) return false;

        long now = System.currentTimeMillis();
        Long last = lastCheck.get(packageName);
        if (last != null && now - last < CHECK_THROTTLE_MS) return false;
        lastCheck.put(packageName, now);

        long usedMinutes = getTodayUsageMinutes(packageName);
        return checkTimeLimits(packageName, usedMinutes);
    }

    /** Pure limit evaluation — kept public so it can be unit tested / called with known usage. */
    public boolean checkTimeLimits(String packageName, long usedMinutes) {
        int limit = prefs.getAppLimit(packageName);
        if (limit <= 0) return false;

        long remaining = limit - usedMinutes;

        // 1. Low-time alert — fires at most once per package per day.
        if (remaining > 0 && remaining <= 5 && prefs.isLowTimeAlertEnabled()) {
            String today = todayKey();
            if (!today.equals(alertedOn.get(packageName))) {
                alertedOn.put(packageName, today);
                try { notifier.triggerAlert(); } catch (Throwable t) { Log.w(TAG, "alert failed", t); }
                Log.d(TAG, "⚠️ Low time alert for " + packageName + " (" + remaining + "m left)");
            }
        }

        // 2. Limit spent → real block.
        if (remaining <= 0) {
            long now = System.currentTimeMillis();
            Long lastB = lastBlock.get(packageName);
            if (lastB != null && now - lastB < BLOCK_THROTTLE_MS) return true;
            lastBlock.put(packageName, now);
            showLimitBlock(packageName, limit);
            return true;
        }
        return false;
    }

    private void showLimitBlock(String packageName, int limitMinutes) {
        try {
            Intent intent = new Intent(context, ShieldBlockActivity.class);
            intent.putExtra("BLOCKED_PACKAGE", packageName);
            intent.putExtra("IS_ADULT_BLOCK", false);
            intent.putExtra("IS_LIMIT_BLOCK", true);
            intent.putExtra("LIMIT_MINUTES", limitMinutes);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            context.startActivity(intent);
            prefs.incrementBlockedAttempts();
            Log.d(TAG, "🛑 Daily limit reached — blocked " + packageName);
        } catch (Throwable t) {
            Log.e(TAG, "Failed to show limit block", t);
        }
    }

    /** Foreground minutes used today for a package (0 when usage access is not granted). */
    public long getTodayUsageMinutes(String packageName) {
        try {
            UsageStatsManager usm = (UsageStatsManager)
                context.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return 0;

            Calendar cal = Calendar.getInstance();
            cal.set(Calendar.HOUR_OF_DAY, prefs.getStartOfDayHour());
            cal.set(Calendar.MINUTE, 0);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            long start = cal.getTimeInMillis();
            long now = System.currentTimeMillis();
            // If "start of day" is later than now (e.g. 6am boundary at 2am), roll back a day.
            if (start > now) start -= 24 * 60 * 60_000L;

            List<UsageStats> stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY, start, now);
            if (stats == null) return 0;

            long totalMs = 0;
            for (UsageStats s : stats) {
                if (packageName.equals(s.getPackageName())) {
                    totalMs += s.getTotalTimeInForeground();
                }
            }
            return totalMs / 60_000L;
        } catch (Throwable t) {
            Log.w(TAG, "usage query failed", t);
            return 0;
        }
    }

    private String todayKey() {
        Calendar c = Calendar.getInstance();
        return c.get(Calendar.YEAR) + "-" + c.get(Calendar.DAY_OF_YEAR);
    }
}
