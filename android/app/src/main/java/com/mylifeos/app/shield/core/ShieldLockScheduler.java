package com.mylifeos.app.shield.core;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.mylifeos.app.shield.ShieldPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * Time-based Shield lock (used by Sleep to Rise). JS hands over the lock list,
 * the user's own Shield list and absolute lock windows. AlarmManager wakes this
 * receiver at every window start/end so blocking starts and ends on time even
 * when the app is fully closed. Only Shield's block list is touched.
 */
public class ShieldLockScheduler extends BroadcastReceiver {
    private static final String PREFS = "shield_lock_schedule";
    private static final int REQ = 47120;

    public static void save(Context ctx, JSONArray lockApps, JSONArray userApps, JSONArray windows) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("lock", lockApps.toString())
            .putString("user", userApps.toString())
            .putString("windows", windows.toString())
            .apply();
        apply(ctx);
    }

    public static void clear(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean wasActive = p.getBoolean("active", false);
        Set<String> user = toSet(p.getString("user", "[]"));
        p.edit().clear().apply();
        cancel(ctx);
        if (wasActive) {
            new ShieldPreferences(ctx).setBlockedApps(user);
            ForegroundGuardService.forceSync(ctx);
        }
    }

    /** Evaluate now, apply/release the block and schedule the next boundary. */
    public static void apply(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        boolean inside = false;
        long next = Long.MAX_VALUE;
        try {
            JSONArray w = new JSONArray(p.getString("windows", "[]"));
            for (int i = 0; i < w.length(); i++) {
                JSONObject o = w.getJSONObject(i);
                long s = o.getLong("start"), e = o.getLong("end");
                if (now >= s && now < e) inside = true;
                if (s > now && s < next) next = s;
                if (e > now && e < next) next = e;
            }
        } catch (Exception ignored) {}

        boolean active = p.getBoolean("active", false);
        Set<String> user = toSet(p.getString("user", "[]"));
        ShieldPreferences sp = new ShieldPreferences(ctx);
        if (inside && !active) {
            Set<String> merged = new HashSet<>(user);
            merged.addAll(toSet(p.getString("lock", "[]")));
            sp.setBlockedApps(merged);
            sp.setEnabled(true);
            p.edit().putBoolean("active", true).apply();
            ForegroundGuardService.forceSync(ctx);
            log(ctx, "lock start: " + merged.size() + " apps");
        } else if (!inside && active) {
            sp.setBlockedApps(user);
            p.edit().putBoolean("active", false).apply();
            ForegroundGuardService.forceSync(ctx);
            log(ctx, "lock end: restored " + user.size() + " apps");
        }

        cancel(ctx);
        if (next != Long.MAX_VALUE) schedule(ctx, next + 500);
    }

    public static boolean isActive(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("active", false);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        try { apply(ctx.getApplicationContext()); } catch (Throwable t) { log(ctx, "apply failed " + t); }
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

    private static void log(Context ctx, String msg) {
        try { com.mylifeos.app.LifeLog.i("ShieldLock", msg); } catch (Throwable ignored) {}
    }
}
