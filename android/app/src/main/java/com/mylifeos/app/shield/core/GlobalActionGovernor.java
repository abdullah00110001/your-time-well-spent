package com.mylifeos.app.shield.core;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.util.Log;

import java.util.ArrayDeque;

/**
 * GlobalActionGovernor — ONE process-wide ceiling for every "leave the app /
 * cover the screen" primitive (GLOBAL_ACTION_HOME/BACK, block activity
 * launches, overlays) issued by Shield, Sleep to Rise and Hardcore Protection.
 *
 * Every path funnels through {@link #allow}. Whatever combination of features
 * misbehaves, system_server can never be flooded with binder transactions,
 * which is what tripped the watchdog and restarted the phone.
 *
 * Also provides the startup safe-mode check: if the governor tripped shortly
 * before the service (re)started — i.e. the device likely rebooted because of
 * a flood — Sleep to Rise is disabled and a notice flag is left for the app.
 */
public final class GlobalActionGovernor {
    private static final String TAG = "GlobalActionGovernor";
    private static final String PREFS = "lifeos_action_governor";
    private static final String K_LAST_TRIP = "last_trip_wall_ms";
    private static final String K_SAFE_MODE = "n2r_safe_mode_notice";

    private static final long MIN_GAP_MS = 400;        // per-kind spacing
    private static final int  MAX_PER_WINDOW = 8;
    private static final long WINDOW_MS = 10_000;
    private static final long BACKOFF_MS = 60_000;
    private static final long SAFE_MODE_LOOKBACK_MS = 3 * 60_000;

    private static final ArrayDeque<Long> recent = new ArrayDeque<>();
    private static final java.util.HashMap<String, Long> lastByKind = new java.util.HashMap<>();
    private static long backoffUntil = 0L;

    private GlobalActionGovernor() {}

    /** @return true if the caller may perform the action now. */
    public static synchronized boolean allow(Context ctx, String kind) {
        long now = SystemClock.elapsedRealtime();
        if (now < backoffUntil) return false;
        Long last = lastByKind.get(kind);
        if (last != null && now - last < MIN_GAP_MS) return false;
        while (!recent.isEmpty() && now - recent.peekFirst() > WINDOW_MS) recent.pollFirst();
        if (recent.size() >= MAX_PER_WINDOW) {
            backoffUntil = now + BACKOFF_MS;
            recent.clear();
            Log.w(TAG, "Tripped: >" + MAX_PER_WINDOW + " actions/" + WINDOW_MS + "ms — pausing all blocking " + BACKOFF_MS + "ms");
            com.mylifeos.app.LifeLog.w("Governor", "FLOOD: >" + MAX_PER_WINDOW + " block actions in " + WINDOW_MS + "ms (last kind=" + kind + ") — blocking paused " + BACKOFF_MS + "ms");
            try {
                if (ctx != null) prefs(ctx).edit().putLong(K_LAST_TRIP, System.currentTimeMillis()).apply();
            } catch (Throwable ignored) {}
            return false;
        }
        recent.addLast(now);
        lastByKind.put(kind, now);
        com.mylifeos.app.LifeLog.i("Governor", "action allowed: " + kind + " (" + recent.size() + "/" + MAX_PER_WINDOW + " in window)");
        return true;
    }

    public static synchronized boolean isBackingOff() {
        return SystemClock.elapsedRealtime() < backoffUntil;
    }

    /** Called once when the accessibility service connects (incl. after boot). */
    public static void startupCheck(Context ctx) {
        try {
            com.mylifeos.app.LifeLog.init(ctx);
            com.mylifeos.app.LifeLog.i("Accessibility", "service connected — startupCheck");
            long lastTrip = prefs(ctx).getLong(K_LAST_TRIP, 0L);
            if (lastTrip <= 0) return;
            if (System.currentTimeMillis() - lastTrip < SAFE_MODE_LOOKBACK_MS) {
                Log.w(TAG, "Flood detected right before restart — Sleep to Rise safe mode");
                com.mylifeos.app.LifeLog.w("Governor", "Flood detected right before restart — Sleep to Rise auto-disabled (safe mode)");
                new com.mylifeos.app.nighttorise.NightToRisePreferences(ctx).emergencyDisable();
                prefs(ctx).edit().putBoolean(K_SAFE_MODE, true).remove(K_LAST_TRIP).apply();
            }
        } catch (Throwable t) {
            Log.w(TAG, "startupCheck failed", t);
        }
    }

    /** Returns and clears the "Sleep to Rise was turned off for safety" notice. */
    public static boolean consumeSafeModeNotice(Context ctx) {
        SharedPreferences p = prefs(ctx);
        boolean v = p.getBoolean(K_SAFE_MODE, false);
        if (v) p.edit().remove(K_SAFE_MODE).apply();
        return v;
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
