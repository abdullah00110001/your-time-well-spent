package com.mylifeos.app.shield.core;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;

import com.mylifeos.app.nighttorise.NightToRiseBlockActivity;
import com.mylifeos.app.nighttorise.NightToRiseManager;
import com.mylifeos.app.shield.ShieldBlockActivity;
import com.mylifeos.app.shield.ShieldPreferences;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

public final class BlockEnforcer {
    private static final String TAG = "BlockEnforcer";

    private static final long SCREEN_DEDUPE_MS = 4000;
    private static final long LEAVE_COOLDOWN_MS = 2500;
    private static volatile long lastLeaveAt = 0L;
    private static final Map<String, Long> lastScreenAt = new HashMap<>();
    private static volatile String lastForegroundPackage = null;
    private static volatile long lastForegroundAt = 0L;

    public static volatile String  lastPhase        = "UNKNOWN";
    public static volatile boolean lastLocking      = false;
    public static volatile String  lastProbePackage = null;
    public static volatile boolean lastUsageAccess  = false;
    public static volatile boolean lastAccessibility = false;
    public static volatile long    lastGuardPassAt  = 0L;
    public static volatile long    lastBlockAt      = 0L;
    public static volatile String  lastBlockedPkg   = null;
    public static volatile String  lastError        = null;

    private BlockEnforcer() {}

    public static void noteGuardPass(String phase, boolean locking, String pkg,
                                     boolean usageAccess, boolean accessibility) {
        lastPhase = phase;
        lastLocking = locking;
        lastProbePackage = pkg;
        lastUsageAccess = usageAccess;
        lastAccessibility = accessibility;
        lastGuardPassAt = System.currentTimeMillis();
    }

    public static void noteForeground(String pkg) {
        if (pkg == null || pkg.isEmpty()) return;
        lastForegroundPackage = pkg;
        lastForegroundAt = SystemClock.elapsedRealtime();
    }

    public static String lastForegroundPackage() { return lastForegroundPackage; }
    public static long lastForegroundAgeMs() {
        return lastForegroundAt == 0 ? Long.MAX_VALUE : SystemClock.elapsedRealtime() - lastForegroundAt;
    }

    private static synchronized boolean allowScreen(String pkg) {
        long now = SystemClock.elapsedRealtime();
        Long prev = lastScreenAt.get(pkg);
        if (prev != null && now - prev < SCREEN_DEDUPE_MS) return false;
        lastScreenAt.put(pkg, now);
        return true;
    }

    private static void leave(Runnable leaveApp) {
        if (leaveApp == null) return;
        long now = SystemClock.elapsedRealtime();
        if (now - lastLeaveAt < LEAVE_COOLDOWN_MS) return;
        lastLeaveAt = now;
        try { leaveApp.run(); } catch (Throwable t) { Log.w(TAG, "leaveApp failed", t); }
    }

    public static void noteLeftBlockedApp(String pkg) {
        lastLeaveAt = SystemClock.elapsedRealtime();
        if (pkg != null && pkg.equals(lastForegroundPackage)) {
            lastForegroundPackage = null;
            lastForegroundAt = 0L;
        }
    }

    public static boolean isNeverBlockable(Context ctx, String pkg) {
        if (pkg == null || pkg.isEmpty()) return true;
        if (pkg.equals(ctx.getApplicationContext().getPackageName())) return true;
        if (pkg.contains("ShieldBlock") || pkg.contains("NightToRise")) return true;
        return false;
    }

    private static boolean isProtectedSystemPackage(String pkg) {
        if (pkg == null) return true;
        String v = pkg.trim();
        if (v.isEmpty()) return true;
        return v.equals("android") || v.startsWith("com.android.") || v.startsWith("com.google.android.")
            || v.startsWith("com.sec.android.") || v.startsWith("com.miui.")
            || v.startsWith("com.oneplus.") || v.startsWith("com.samsung.")
            || v.startsWith("com.huawei.");
    }

    public static final class Result {
        public final boolean blocked;
        public final boolean sleepToRise;
        public Result(boolean blocked, boolean sleepToRise) {
            this.blocked = blocked; this.sleepToRise = sleepToRise;
        }
        static final Result NONE = new Result(false, false);
    }

    public static Result enforce(Context ctx, String pkg, Runnable leaveApp) {
        if (isNeverBlockable(ctx, pkg) || isProtectedSystemPackage(pkg)) return Result.NONE;

        try {
            NightToRiseManager n2r = new NightToRiseManager(ctx);
            NightToRiseManager.Decision d = n2r.decide(System.currentTimeMillis(), pkg);
            if (d.shouldBlock) {
                if (allowScreen(pkg)) {
                    n2r.prefs().recordBlockedAttempt(pkg,
                        d.phase == NightToRiseManager.Phase.RISE_LOCK ? "rise" : "sleep");
                    Intent i = new Intent(ctx, NightToRiseBlockActivity.class);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                        | Intent.FLAG_ACTIVITY_NO_ANIMATION);
                    i.putExtra(NightToRiseBlockActivity.EXTRA_MESSAGE, d.message);
                    i.putExtra(NightToRiseBlockActivity.EXTRA_END_MS, d.endTimeMs);
                    i.putExtra(NightToRiseBlockActivity.EXTRA_STRICT, n2r.prefs().strictMode());
                    i.putExtra(NightToRiseBlockActivity.EXTRA_PACKAGE, pkg);
                    i.putExtra(NightToRiseBlockActivity.EXTRA_PHASE, d.phase.name());
                    boolean shown = launchBlockScreen(ctx, i, "Sleep to Rise",
                        d.phase == NightToRiseManager.Phase.RISE_LOCK
                            ? "Rise with intention\n" + d.message
                            : "Rest now\n" + d.message,
                        true, d.phase == NightToRiseManager.Phase.RISE_LOCK, leaveApp);
                    if (!shown) leave(leaveApp);
                } else if (!isBlockScreenForeground()) {
                    leave(leaveApp);
                }
                return new Result(true, true);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Sleep to Rise check failed", t);
        }

        try {
            ShieldPreferences prefs = new ShieldPreferences(ctx);
            Set<String> allowedApps = prefs.getAllowedApps();
            if (allowedApps != null && !allowedApps.isEmpty()) {
                if (!allowedApps.contains(pkg)) {
                    if (allowScreen(pkg)) {
                        prefs.incrementBlockedAttempts();
                        Intent intent = new Intent(ctx, ShieldBlockActivity.class);
                        intent.putExtra("BLOCKED_PACKAGE", pkg);
                        intent.putExtra("IS_ADULT_BLOCK", false);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                            | Intent.FLAG_ACTIVITY_NO_ANIMATION);
                        presentShield(ctx, intent, leaveApp);
                    } else if (!isBlockScreenForeground()) {
                        leave(leaveApp);
                    }
                    return new Result(true, false);
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "Allowlist enforcement failed", t);
        }

        return Result.NONE;
    }

    private static final String BLOCK_CHANNEL_ID = "lifeos_block_screen_v1";

    private static boolean canStartActivityFromBackground(Context ctx) {
        if (com.mylifeos.app.shield.ShieldAccessibilityService.isConnected()) return true;
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) return true;
        try {
            return android.provider.Settings.canDrawOverlays(ctx);
        } catch (Throwable t) {
            return false;
        }
    }

    private static boolean isBlockScreenForeground() {
        String foreground = lastForegroundPackage();
        return foreground != null
            && (foreground.contains("ShieldBlock") || foreground.contains("NightToRise"));
    }

    public static boolean presentShield(Context ctx, Intent blockIntent, Runnable leaveApp) {
        lastBlockAt = System.currentTimeMillis();
        lastBlockedPkg = blockIntent.getStringExtra("BLOCKED_PACKAGE");

        ShieldBlockCard.Spec spec = null;
        try {
            spec = ShieldBlockCard.Spec.fromIntent(ctx, blockIntent, false);
        } catch (Throwable t) {
            Log.w(TAG, "block card spec failed", t);
        }

        final Context appCtx = ctx.getApplicationContext() != null ? ctx.getApplicationContext() : ctx;
        final Runnable goHome = () -> {
            if (com.mylifeos.app.shield.ShieldAccessibilityService.goHomeViaAccessibility()) return;
            try {
                Intent home = new Intent(Intent.ACTION_MAIN);
                home.addCategory(Intent.CATEGORY_HOME);
                home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                appCtx.startActivity(home);
            } catch (Throwable t) {
                Log.w(TAG, "goHome intent rejected", t);
            }
        };

        if (spec != null) {
            boolean drawn = false;
            try {
                drawn = com.mylifeos.app.shield.ShieldAccessibilityService.showShieldCard(spec, goHome);
                if (!drawn) drawn = BlockingOverlay.showCardSystem(ctx, spec, goHome);
            } catch (Throwable t) {
                Log.w(TAG, "block card overlay failed", t);
            }
            if (drawn) {
                lastError = null;
                leave(leaveApp);
                return true;
            }
        }

        if (com.mylifeos.app.shield.ShieldAccessibilityService.launchBlockActivity(blockIntent)) {
            lastError = null;
            return true;
        }
        if (canStartActivityFromBackground(ctx)) {
            try {
                ctx.startActivity(blockIntent);
                lastError = null;
                return true;
            } catch (Throwable t) {
                Log.w(TAG, "startActivity for block screen rejected", t);
                lastError = "startActivity rejected: " + t.getMessage();
            }
        }
        boolean shown = showFullScreenFallback(ctx, blockIntent,
            "Shield is protecting your focus", "This app is blocked right now.");
        if (!shown) leave(leaveApp);
        return shown;
    }

    private static boolean launchBlockScreen(Context ctx, Intent i, String title, String body,
                                             boolean sleepToRise, boolean rise, Runnable leaveApp) {
        lastBlockAt = System.currentTimeMillis();
        lastBlockedPkg = i.getStringExtra(NightToRiseBlockActivity.EXTRA_PACKAGE);

        if (com.mylifeos.app.shield.ShieldAccessibilityService.launchBlockActivity(i)) {
            lastError = null;
            return true;
        }

        if (canStartActivityFromBackground(ctx)) {
            try {
                ctx.startActivity(i);
                lastError = null;
                return true;
            } catch (Throwable t) {
                Log.w(TAG, "startActivity for block screen rejected", t);
                lastError = "startActivity rejected: " + t.getMessage();
            }
        } else {
            lastError = "background activity start not permitted (no overlay permission / accessibility off)";
        }
        if (com.mylifeos.app.shield.ShieldAccessibilityService.showBlockingOverlay(
                sleepToRise, rise, title, body, leaveApp)) {
            lastError = null;
            return true;
        }
        if (BlockingOverlay.showSystem(ctx, sleepToRise, rise, title, body, leaveApp)) {
            lastError = null;
            return true;
        }
        return showFullScreenFallback(ctx, i, title, body);
    }

    private static boolean canUseFullScreenIntent(Context ctx) {
        try {
            if (android.os.Build.VERSION.SDK_INT < 34) return true;
            NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            return nm == null || nm.canUseFullScreenIntent();
        } catch (Throwable t) {
            return false;
        }
    }

    private static boolean showFullScreenFallback(Context ctx, Intent i, String title, String body) {
        try {
            NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return false;
            if (!canUseFullScreenIntent(ctx)) {
                lastError = "no display path: accessibility off, overlay permission off, "
                    + "full-screen notifications not allowed";
                return false;
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(
                    BLOCK_CHANNEL_ID, "Blocking", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Shown when an app is blocked");
                nm.createNotificationChannel(ch);
            }
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent full = PendingIntent.getActivity(ctx, 4021, i, flags);

            Notification n = new androidx.core.app.NotificationCompat.Builder(ctx, BLOCK_CHANNEL_ID)
                .setSmallIcon(com.mylifeos.app.R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body == null ? "This app is blocked right now." : body)
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX)
                .setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setOngoing(false)
                .setContentIntent(full)
                .setFullScreenIntent(full, true)
                .build();
            nm.notify(4021, n);
            return true;
        } catch (Throwable t) {
            Log.w(TAG, "full-screen fallback failed", t);
            lastError = "full-screen fallback failed: " + t.getMessage();
            return false;
        }
    }
}
