package com.mylifeos.app.shield.core;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;

import java.util.ArrayDeque;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Sleep to Rise schedule. It has NO blocking code of its own: it only tells
 * BlockEnforcer (Shield's single pipeline) which allowlist applies right now.
 * Shield's card/overlay shows the block.
 */
public final class SleepToRise {
    private static final String TAG = "SleepToRise";
    private static final String PREFS = "SleepToRisePrefs";

    public static final String PHASE_OFF = "OFF";
    public static final String PHASE_IDLE = "IDLE";
    public static final String PHASE_SLEEP = "SLEEP";
    public static final String PHASE_RISE = "RISE";
    public static final String PHASE_PAUSED = "PAUSED";

    private static final int MAX_BLOCKS_PER_MINUTE = 20;
    private static final long SAFETY_PAUSE_MS = 10 * 60_000L;
    private static final long SAFE_CACHE_MS = 10 * 60_000L;

    private static final ArrayDeque<Long> recentBlocks = new ArrayDeque<>();
    private static Set<String> safeCache = null;
    private static long safeCacheAt = 0L;

    private SleepToRise() {}

    private static SharedPreferences p(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---------- config ----------
    public static void save(Context ctx, boolean enabled, int startMin, int endMin, int riseGuardMin, Set<String> allowed) {
        p(ctx).edit()
            .putBoolean("enabled", enabled)
            .putInt("start", clampMin(startMin))
            .putInt("end", clampMin(endMin))
            .putInt("rise_guard", Math.max(0, Math.min(180, riseGuardMin)))
            .putStringSet("allowed", new HashSet<>(allowed))
            .putLong("paused_until", 0L)
            .commit();
    }

    public static boolean isEnabled(Context ctx) { return p(ctx).getBoolean("enabled", false); }
    public static int startMin(Context ctx) { return p(ctx).getInt("start", 23 * 60); }
    public static int endMin(Context ctx) { return p(ctx).getInt("end", 6 * 60); }
    public static int riseGuardMin(Context ctx) { return p(ctx).getInt("rise_guard", 15); }
    public static Set<String> allowed(Context ctx) {
        return new HashSet<>(p(ctx).getStringSet("allowed", new HashSet<>()));
    }
    public static long pausedUntil(Context ctx) { return p(ctx).getLong("paused_until", 0L); }
    public static void clearPause(Context ctx) { p(ctx).edit().putLong("paused_until", 0L).commit(); }
    /** Morning mission done: ends the Rise guard early for today. */
    public static void markRiseDone(Context ctx) { p(ctx).edit().putLong("rise_done_at", System.currentTimeMillis()).commit(); }

    private static int clampMin(int m) { return ((m % 1440) + 1440) % 1440; }

    // ---------- phase ----------
    public static String phase(Context ctx) {
        try {
            if (!isEnabled(ctx)) return PHASE_OFF;
            if (System.currentTimeMillis() < pausedUntil(ctx)) return PHASE_PAUSED;
            Calendar c = Calendar.getInstance();
            int now = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
            int start = startMin(ctx), end = endMin(ctx);
            if (start == end) return PHASE_IDLE;
            if (inRange(now, start, end)) return PHASE_SLEEP;
            int guard = riseGuardMin(ctx);
            if (guard > 0 && inRange(now, end, clampMin(end + guard))) {
                long doneAt = p(ctx).getLong("rise_done_at", 0L);
                if (System.currentTimeMillis() - doneAt < (guard + 5) * 60_000L) return PHASE_IDLE;
                return PHASE_RISE;
            }
            return PHASE_IDLE;
        } catch (Throwable t) {
            Log.w(TAG, "phase failed", t);
            return PHASE_OFF;
        }
    }

    private static boolean inRange(int now, int a, int b) {
        return a < b ? (now >= a && now < b) : (now >= a || now < b);
    }

    public static boolean isLocking(Context ctx) {
        String ph = phase(ctx);
        return PHASE_SLEEP.equals(ph) || PHASE_RISE.equals(ph);
    }

    public static String endLabel(Context ctx) {
        try {
            int m = PHASE_RISE.equals(phase(ctx)) ? clampMin(endMin(ctx) + riseGuardMin(ctx)) : endMin(ctx);
            return String.format(Locale.US, "%02d:%02d", m / 60, m % 60);
        } catch (Throwable t) { return "morning"; }
    }

    // ---------- safety ----------
    /** Apps that must never be blocked: home screen, keyboards, phone, clock/alarm. */
    public static synchronized boolean isAlwaysSafe(Context ctx, String pkg) {
        if (pkg == null) return true;
        long now = SystemClock.elapsedRealtime();
        if (safeCache == null || now - safeCacheAt > SAFE_CACHE_MS) {
            safeCache = buildSafeSet(ctx.getApplicationContext());
            safeCacheAt = now;
        }
        if (safeCache.contains(pkg)) return true;
        String l = pkg.toLowerCase(Locale.US);
        return l.contains("launcher") || l.contains("dialer") || l.contains("deskclock")
            || l.contains("systemui") || l.contains("inputmethod") || l.contains("keyboard")
            || l.contains("emergency") || l.contains("telecom");
    }

    private static Set<String> buildSafeSet(Context ctx) {
        Set<String> s = new HashSet<>();
        s.add(ctx.getPackageName());
        PackageManager pm = ctx.getPackageManager();
        addResolvers(pm, s, new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME));
        addResolvers(pm, s, new Intent(Intent.ACTION_DIAL));
        addResolvers(pm, s, new Intent(android.provider.AlarmClock.ACTION_SHOW_ALARMS));
        try {
            InputMethodManager imm = (InputMethodManager) ctx.getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) for (InputMethodInfo i : imm.getEnabledInputMethodList()) s.add(i.getPackageName());
        } catch (Throwable ignored) {}
        try {
            String ime = Settings.Secure.getString(ctx.getContentResolver(), Settings.Secure.DEFAULT_INPUT_METHOD);
            if (ime != null && ime.contains("/")) s.add(ime.substring(0, ime.indexOf('/')));
        } catch (Throwable ignored) {}
        return s;
    }

    private static void addResolvers(PackageManager pm, Set<String> out, Intent i) {
        try {
            List<ResolveInfo> list = pm.queryIntentActivities(i, 0);
            for (ResolveInfo ri : list) if (ri.activityInfo != null) out.add(ri.activityInfo.packageName);
        } catch (Throwable ignored) {}
    }

    /** Hard cap: if blocks fire too often, pause Sleep to Rise instead of stressing the system. */
    public static synchronized boolean recordBlockAndCheck(Context ctx) {
        long now = SystemClock.elapsedRealtime();
        recentBlocks.addLast(now);
        while (!recentBlocks.isEmpty() && now - recentBlocks.peekFirst() > 60_000L) recentBlocks.pollFirst();
        if (recentBlocks.size() > MAX_BLOCKS_PER_MINUTE) {
            recentBlocks.clear();
            p(ctx).edit().putLong("paused_until", System.currentTimeMillis() + SAFETY_PAUSE_MS)
                .putLong("last_safety_trip", System.currentTimeMillis()).commit();
            Log.w(TAG, "Safety pause: too many blocks in 60s");
            return false;
        }
        return true;
    }

    public static long lastSafetyTrip(Context ctx) { return p(ctx).getLong("last_safety_trip", 0L); }
}
