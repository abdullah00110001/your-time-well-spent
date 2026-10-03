package com.mylifeos.app.shield.core;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.mylifeos.app.LifeLog;
import com.mylifeos.app.shield.ShieldPreferences;
import com.mylifeos.app.shield.SleepToRiseNotifier;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * Time-based Shield lock (used by Sleep to Rise). JS hands over the lock list,
 * the user's own Shield list and absolute lock windows ({start, end, kind}).
 * AlarmManager wakes this receiver at every window start/end so blocking
 * starts and ends on time even when the app is fully closed or after reboot.
 */
public class ShieldLockScheduler extends BroadcastReceiver {
    private static final String TAG = "ShieldLock";
    private static final String PREFS = "shield_lock_schedule";
    private static final int REQ = 47120;

    private static volatile Set<String> cachedLock = null;
    private static volatile Set<String> cachedUser = null;

    public static void save(Context ctx, JSONArray lockApps, JSONArray userApps, JSONArray windows,
                            String sleepMessage, String riseMessage) {
        SharedPreferences p = prefs(ctx);
        boolean firstArm = !p.contains("windows");
        p.edit()
            .putString("lock", lockApps.toString())
            .putString("user", userApps.toString())
            .putString("windows", windows.toString())
            .putString("msg_sleep", sleepMessage == null ? "" : sleepMessage)
            .putString("msg_rise", riseMessage == null ? "" : riseMessage)
            .commit();
        cachedLock = null; cachedUser = null;
        LifeLog.i(TAG, "schedule saved: " + windows.length() + " windows, " + lockApps.length() + " lock apps");
        Next n = apply(ctx);
        if (firstArm && !isActive(ctx) && n != null) SleepToRiseNotifier.armed(ctx, n.kind, n.start);
    }

    public static void clear(Context ctx) {
        SharedPreferences p = prefs(ctx);
        boolean had = p.contains("windows");
        boolean wasActive = p.getBoolean("active", false);
        Set<String> user = toSet(p.getString("user", "[]"));
        p.edit().clear().commit();
        cachedLock = null; cachedUser = null;
        cancel(ctx);
        if (wasActive) {
            new ShieldPreferences(ctx).setBlockedApps(user);
            ForegroundGuardService.forceSync(ctx);
        }
        if (had) {
            SleepToRiseNotifier.cleared(ctx);
            LifeLog.i(TAG, "schedule cleared (wasActive=" + wasActive + ")");
        }
    }

    private static final class Next { String kind; long start; }

    /** Evaluate now, apply/release the block, schedule the next boundary. */
    public static synchronized Next apply(Context ctx) {
        SharedPreferences p = prefs(ctx);
        long now = System.currentTimeMillis();
        String insideKind = null;
        long insideEnd = 0;
        long insideStart = -1;
        long nextBoundary = Long.MAX_VALUE;
        Next nextStart = null;
        try {
            JSONArray w = new JSONArray(p.getString("windows", "[]"));
            for (int i = 0; i < w.length(); i++) {
                JSONObject o = w.getJSONObject(i);
                long s = o.getLong("start"), e = o.getLong("end");
                String k = o.optString("kind", "sleep");
                if (now >= s && now < e) {
                    // Latest-starting window wins (Rise Guard takes over from Sleep Guard).
                    if (s >= insideStart) { insideKind = k; insideStart = s; }
                    insideEnd = Math.max(insideEnd, e);
                }
                if (s > now && s < nextBoundary) nextBoundary = s;
                if (e > now && e < nextBoundary) nextBoundary = e;
                if (s > now && (nextStart == null || s < nextStart.start)) {
                    nextStart = new Next(); nextStart.kind = k; nextStart.start = s;
                }
            }
            // Extend the end over back-to-back windows (sleep → rise).
            boolean grew = true;
            while (insideKind != null && grew) {
                grew = false;
                for (int i = 0; i < w.length(); i++) {
                    JSONObject o = w.getJSONObject(i);
                    if (o.getLong("start") <= insideEnd && o.getLong("end") > insideEnd) {
                        insideEnd = o.getLong("end"); grew = true;
                    }
                }
            }
        } catch (Exception ex) {
            LifeLog.e(TAG, "bad schedule", ex);
        }

        boolean active = p.getBoolean("active", false);
        String activeKind = p.getString("active_kind", null);
        Set<String> user = toSet(p.getString("user", "[]"));
        ShieldPreferences sp = new ShieldPreferences(ctx);

        if (insideKind != null && !active) {
            Set<String> merged = new HashSet<>(user);
            merged.addAll(lockSet(ctx));
            sp.setBlockedApps(merged);
            sp.setEnabled(true);
            p.edit().putBoolean("active", true).putString("active_kind", insideKind)
                .putLong("active_end", insideEnd).commit();
            ForegroundGuardService.forceSync(ctx);
            LifeLog.i(TAG, SleepToRiseNotifier.guardName(insideKind) + " START — " + merged.size() + " apps locked, ends " + new java.util.Date(insideEnd));
            SleepToRiseNotifier.started(ctx, insideKind, insideEnd, merged.size());
        } else if (insideKind != null && !insideKind.equals(activeKind)) {
            p.edit().putString("active_kind", insideKind).putLong("active_end", insideEnd).commit();
            LifeLog.i(TAG, "guard switch → " + SleepToRiseNotifier.guardName(insideKind));
            SleepToRiseNotifier.switched(ctx, insideKind, insideEnd, sp.getBlockedApps().size());
        } else if (insideKind == null && active) {
            sp.setBlockedApps(user);
            p.edit().putBoolean("active", false).remove("active_kind").remove("active_end").commit();
            ForegroundGuardService.forceSync(ctx);
            LifeLog.i(TAG, "lock END — restored " + user.size() + " user apps");
            SleepToRiseNotifier.ended(ctx, nextStart == null ? null : nextStart.kind,
                nextStart == null ? 0 : nextStart.start);
        }

        cancel(ctx);
        if (nextBoundary != Long.MAX_VALUE) {
            schedule(ctx, nextBoundary + 500);
            LifeLog.i(TAG, "next boundary at " + new java.util.Date(nextBoundary));
        }
        return nextStart;
    }

    // ---- queries used by BlockEnforcer ----
    public static boolean isActive(Context ctx) { return prefs(ctx).getBoolean("active", false); }
    public static String activeKind(Context ctx) { return prefs(ctx).getString("active_kind", "sleep"); }
    public static long activeEnd(Context ctx) { return prefs(ctx).getLong("active_end", 0L); }
    public static String message(Context ctx, String kind) {
        return prefs(ctx).getString("rise".equals(kind) ? "msg_rise" : "msg_sleep", "");
    }

    /** During an active guard, Sleep to Rise owns the screen for every app in its lock set.
     * An app in both lists still has a Sleep to Rise reason; Shield takes over when the guard ends. */
    public static boolean isLockedByN2R(Context ctx, String pkg) {
        if (pkg == null || !isActive(ctx)) return false;
        return lockSet(ctx).contains(pkg);
    }

    public static int lockedAppCount(Context ctx) {
        return isActive(ctx) ? lockSet(ctx).size() : 0;
    }

    private static Set<String> lockSet(Context ctx) {
        Set<String> s = cachedLock;
        if (s == null) { s = toSet(prefs(ctx).getString("lock", "[]")); cachedLock = s; }
        return s;
    }

    private static Set<String> userSet(Context ctx) {
        Set<String> s = cachedUser;
        if (s == null) { s = toSet(prefs(ctx).getString("user", "[]")); cachedUser = s; }
        return s;
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        try { LifeLog.init(ctx); apply(ctx.getApplicationContext()); }
        catch (Throwable t) { LifeLog.e(TAG, "apply failed", t); }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static PendingIntent pi(Context ctx) {
        Intent i = new Intent(ctx, ShieldLockScheduler.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(ctx, REQ, i, flags);
    }

    private static void cancel(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pi(ctx));
    }

    private static void schedule(Context ctx, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pi(ctx);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Throwable t) {
            am.set(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    private static Set<String> toSet(String json) {
        Set<String> out = new HashSet<>();
        try { JSONArray a = new JSONArray(json); for (int i = 0; i < a.length(); i++) out.add(a.getString(i)); }
        catch (Exception ignored) {}
        return out;
    }
}
