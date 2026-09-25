package com.mylifeos.app.shield.core;

import android.app.AppOpsManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Process;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.mylifeos.app.MainActivity;
import com.mylifeos.app.R;
import com.mylifeos.app.nighttorise.NightToRiseManager;
import com.mylifeos.app.shield.ShieldPreferences;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Set;

/**
 * ForegroundGuardService — the reliability layer behind app blocking.
 *
 * FIX (guard-stop): the service never stopped itself when a lock window ended
 * mid-session. sync() only started/stopped based on whether N2R is *enabled*
 * (the feature toggle), not whether a lock is *currently active*. So after
 * Sleep Guard ended at the alarm, the service kept running and kept showing
 * the block screen on every app switch.
 *
 * FIX (rise-only notification): notification was always showing "sleep lock
 * ACTIVE" even during Rise Guard because it used a hardcoded label instead
 * of reading probe.phase.
 */
public class ForegroundGuardService extends Service {

    private static final String TAG = "ForegroundGuard";
    private static final String CHANNEL_ID = "shield_guard_status";
    private static final int NOTIF_ID = 4711;
    /**
     * SAFETY-CRITICAL (device reboot): every poll tick hits system_server
     * (UsageStatsService + AppOps). At a fixed 1s all night, plus a second
     * 2-minute-range queryEvents, that sustained binder load was the last
     * remaining watchdog trigger. Poll is now adaptive: fast only while the
     * screen is on AND a lock is active, slow otherwise, and paused while
     * the screen is off (nothing can be opened then).
     */
    private static final long POLL_FAST_MS = 1500L;
    private static final long POLL_IDLE_MS = 10_000L;
    private static final long POLL_SCREEN_OFF_MS = 60_000L;
    private static final long PERM_CACHE_MS = 30_000L;
    private volatile boolean screenOn = true;
    private long nextDelay = POLL_FAST_MS;
    private android.content.BroadcastReceiver screenReceiver;
    private Boolean cachedUsageAccess = null;
    private long usageAccessAt = 0L;
    private Boolean cachedA11yPerm = null;
    private long a11yPermAt = 0L;
    private long lastQueryEnd = 0L;
    private String lastKnownPkg = null;

    private static final String PROBE_PACKAGE = "zz.lifeos.lock.probe";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable tick;
    private String lastNotificationText = null;

    /**
     * SAFETY-CRITICAL (device reboot): sync() was called from
     * onAccessibilityEvent, i.e. several times per second while the user
     * scrolls or switches apps. Each call issued a
     * startForegroundService()/stopService() binder transaction to
     * ActivityManager in system_server, and each one also re-read
     * SharedPreferences. On OEM ROMs that flood of service-start transactions
     * trips the system_server watchdog, which restarts system_server — on the
     * device this looks exactly like the phone rebooting on its own.
     *
     * sync() is now idempotent and cheap: it starts/stops only on a real state
     * change, and never more than once every SYNC_MIN_INTERVAL_MS.
     */
    private static final long SYNC_MIN_INTERVAL_MS = 5000L;
    private static volatile long lastSyncAt = 0L;
    private static volatile Boolean lastSyncNeeded = null;
    /** True between onCreate and onDestroy of the running instance. */
    private static volatile boolean running = false;

    /**
     * Explicit, user-driven state change (settings saved, alarm changed, boot):
     * bypass the rate limit so the guard starts/stops immediately.
     */
    public static void forceSync(Context ctx) {
        lastSyncAt = 0L;
        lastSyncNeeded = null;
        com.mylifeos.app.nighttorise.NightToRiseManager.invalidateSafetyCache();
        sync(ctx);
    }

    public static void sync(Context ctx) {
        long now = android.os.SystemClock.elapsedRealtime();
        if (lastSyncNeeded != null && now - lastSyncAt < SYNC_MIN_INTERVAL_MS) return;
        try {
            com.mylifeos.app.nighttorise.NightToRisePreferences n2rPrefs =
                new com.mylifeos.app.nighttorise.NightToRisePreferences(ctx);
            boolean n2rOn = n2rPrefs.isEnabled();
            Set<String> blocked = new ShieldPreferences(ctx).getBlockedApps();
            boolean shieldOn = blocked != null && !blocked.isEmpty();
            boolean needed = n2rOn || shieldOn;
            lastSyncAt = now;

            // Nothing to do: desired state already matches reality.
            if (lastSyncNeeded != null && lastSyncNeeded == needed && running == needed) return;
            lastSyncNeeded = needed;

            Intent i = new Intent(ctx, ForegroundGuardService.class);
            if (needed) {
                if (running) return;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
                else ctx.startService(i);
            } else {
                if (!running) return;
                ctx.stopService(i);
            }
        } catch (Throwable t) {
            Log.w(TAG, "sync failed", t);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        createChannel();
        startForeground(NOTIF_ID, buildNotification("Protection active", "Checking your lock schedule…"));
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) screenOn = pm.isInteractive();
        } catch (Throwable ignored) {}
        screenReceiver = new android.content.BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent in) {
                screenOn = !Intent.ACTION_SCREEN_OFF.equals(in.getAction());
                if (screenOn && tick != null) {
                    handler.removeCallbacks(tick);
                    handler.post(tick);
                }
            }
        };
        try {
            android.content.IntentFilter f = new android.content.IntentFilter();
            f.addAction(Intent.ACTION_SCREEN_ON);
            f.addAction(Intent.ACTION_SCREEN_OFF);
            f.addAction(Intent.ACTION_USER_PRESENT);
            registerReceiver(screenReceiver, f);
        } catch (Throwable t) { screenReceiver = null; }
        tick = new Runnable() {
            @Override public void run() {
                nextDelay = POLL_IDLE_MS;
                try { pass(); } catch (Throwable t) { Log.w(TAG, "guard pass failed", t); }
                handler.postDelayed(this, screenOn ? nextDelay : POLL_SCREEN_OFF_MS);
            }
        };
        handler.post(tick);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        lastSyncNeeded = null;
        if (tick != null) handler.removeCallbacks(tick);
        if (screenReceiver != null) {
            try { unregisterReceiver(screenReceiver); } catch (Throwable ignored) {}
            screenReceiver = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void pass() {
        NightToRiseManager n2r = new NightToRiseManager(this);
        NightToRiseManager.Decision probe = n2r.decide(System.currentTimeMillis(), PROBE_PACKAGE);
        if (probe.shouldBlock) nextDelay = POLL_FAST_MS;
        // Screen off: no app can be opened, so skip all system_server queries.
        String pkg = screenOn ? currentForegroundPackage() : lastKnownPkg;

        boolean accessibilityAvailable =
            com.mylifeos.app.shield.ShieldAccessibilityService.isConnected()
            || hasA11yPermCached();

        BlockEnforcer.noteGuardPass(probe.phase.name(), probe.shouldBlock, pkg,
            hasUsageAccess(), accessibilityAvailable);

        // Announce guard start / end / timer completion to the user.
        com.mylifeos.app.nighttorise.GuardTransitionNotifier.onDecision(this, probe);

        // FIX: when nothing is actively locking AND Shield has no blocked apps
        // AND N2R feature is off — stop so Sleep Guard auto-releases correctly.
        boolean shieldHasBlocked = false;
        try {
            Set<String> blockedApps = new ShieldPreferences(this).getBlockedApps();
            shieldHasBlocked = blockedApps != null && !blockedApps.isEmpty();
        } catch (Throwable ignored) {}

        if (shieldHasBlocked) nextDelay = POLL_FAST_MS;
        if (!probe.shouldBlock && !shieldHasBlocked && !n2r.prefs().isEnabled()) {
            stopSelf();
            return;
        }

        updateNotification(probe, pkg != null && canLeaveApp());

        if (pkg == null) {
            if (probe.shouldBlock) Log.w(TAG, "Lock active but no foreground-app signal available");
            return;
        }
        BlockEnforcer.enforce(this, pkg, this::goHome);
    }

    private boolean canLeaveApp() {
        if (com.mylifeos.app.shield.ShieldAccessibilityService.isConnected()) return true;
        try {
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                || android.provider.Settings.canDrawOverlays(this);
        } catch (Throwable t) {
            return false;
        }
    }

    private void goHome() {
        if (com.mylifeos.app.shield.ShieldAccessibilityService.goHomeViaAccessibility()) return;
        try {
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(home);
        } catch (Throwable t) {
            Log.w(TAG, "goHome intent rejected", t);
        }
    }

    private boolean hasA11yPermCached() {
        long now = android.os.SystemClock.elapsedRealtime();
        if (cachedA11yPerm == null || now - a11yPermAt > PERM_CACHE_MS) {
            try { cachedA11yPerm = new com.mylifeos.app.shield.ShieldPermissionHelper(this).hasAccessibilityPermission(); }
            catch (Throwable t) { cachedA11yPerm = false; }
            a11yPermAt = now;
        }
        return cachedA11yPerm;
    }

    /**
     * Incremental: only asks UsageStats for events since the previous query,
     * so each call covers ~1-10s instead of repeatedly re-reading 10s + 2min
     * windows. One small binder call per tick, at most.
     */
    private String currentForegroundPackage() {
        if (hasUsageAccess()) {
            long now = System.currentTimeMillis();
            long from = (lastQueryEnd <= 0 || now - lastQueryEnd > 2L * 60 * 1000)
                ? now - 2L * 60 * 1000 : lastQueryEnd - 500L;
            String recent = lastResumedBetween(from, now);
            lastQueryEnd = now;
            if (recent != null) lastKnownPkg = recent;
            if (lastKnownPkg != null) return lastKnownPkg;
        }
        if (BlockEnforcer.lastForegroundAgeMs() < 60_000) return BlockEnforcer.lastForegroundPackage();
        return null;
    }

    private String lastResumedBetween(long from, long to) {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return null;
            UsageEvents events = usm.queryEvents(from, to);
            UsageEvents.Event e = new UsageEvents.Event();
            String last = null;
            while (events != null && events.hasNextEvent()) {
                events.getNextEvent(e);
                int type = e.getEventType();
                boolean resumed = type == UsageEvents.Event.MOVE_TO_FOREGROUND
                    || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        && type == UsageEvents.Event.ACTIVITY_RESUMED);
                if (resumed) last = e.getPackageName();
            }
            return last;
        } catch (Throwable t) {
            Log.w(TAG, "usage query failed", t);
            return null;
        }
    }

    private boolean hasUsageAccess() {
        long now = android.os.SystemClock.elapsedRealtime();
        if (cachedUsageAccess != null && now - usageAccessAt < PERM_CACHE_MS) return cachedUsageAccess;
        usageAccessAt = now;
        cachedUsageAccess = hasUsageAccessUncached();
        return cachedUsageAccess;
    }

    private boolean hasUsageAccessUncached() {
        try {
            AppOpsManager ops = (AppOpsManager) getSystemService(Context.APP_OPS_SERVICE);
            if (ops == null) return false;
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(), getPackageName());
            } else {
                mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(), getPackageName());
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Throwable t) {
            return false;
        }
    }

    private void updateNotification(NightToRiseManager.Decision probe, boolean canEnforce) {
        String title;
        String text;

        boolean locking = probe.shouldBlock;
        if (locking && !canEnforce) {
            title = "Sleep to Rise — permission needed";
            text = "Grant Usage Access or Accessibility to enforce this lock";
        } else if (locking) {
            String until = probe.endTimeMs > 0
                ? new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date(probe.endTimeMs))
                : null;
            // FIX: read actual phase, not hardcoded "sleep lock"
            boolean isRise = probe.phase == NightToRiseManager.Phase.RISE_LOCK;
            title = isRise
                ? "🌅 Sleep to Rise — rise lock ACTIVE"
                : "🌙 Sleep to Rise — sleep lock ACTIVE";
            text = "Only your allowed apps can open"
                + (until != null ? " · until " + until : "");
        } else {
            int blockedCount = 0;
            try {
                Set<String> blocked = new ShieldPreferences(this).getBlockedApps();
                blockedCount = blocked == null ? 0 : blocked.size();
            } catch (Throwable ignored) {}
            switch (probe.phase) {
                case PAUSED:       title = "Sleep to Rise — paused tonight"; break;
                case INACTIVE_DAY: title = "Sleep to Rise — not scheduled today"; break;
                case OFF:          title = "Shield protection running"; break;
                default:           title = "Sleep to Rise — armed"; break;
            }
            text = blockedCount > 0
                ? blockedCount + " app" + (blockedCount == 1 ? "" : "s") + " blocked by Shield"
                : "Lock is not enforcing right now";
        }

        String signature = title + "|" + text;
        if (signature.equals(lastNotificationText)) return;
        lastNotificationText = signature;

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(title, text));
    }

    private Notification buildNotification(String title, String text) {
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pi)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Blocking status", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Shows whether Sleep to Rise / Shield blocking is currently enforcing");
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }
}
