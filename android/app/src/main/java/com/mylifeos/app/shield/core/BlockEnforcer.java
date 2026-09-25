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

/**
 * BlockEnforcer — the SINGLE place where "is this foreground package allowed
 * right now?" is answered and acted upon.
 *
 * Root cause this class fixes: enforcement used to live inline inside
 * {@link com.mylifeos.app.shield.ShieldAccessibilityService}, so it only ever
 * ran when Android happened to deliver an accessibility event. On many OEM
 * ROMs (MIUI / HyperOS / OneUI / ColorOS) window events for a cold app launch
 * are delivered late, coalesced, or not at all while the service is in the
 * background — which is exactly why blocking looked "sometimes works, mostly
 * doesn't" and why Sleep to Rise never fired at all.
 *
 * Enforcement is now callable from two independent drivers:
 *   1. the accessibility service (fast path, event driven)
 *   2. {@link ForegroundGuardService} (reliable path, 1s poll while a lock or
 *      a blocklist is active)
 *
 * Both share the dedupe map below, so the two drivers can never stack two
 * block screens for the same launch.
 *
 * FIX: this call site was missing NightToRiseBlockActivity.EXTRA_PHASE, so
 * the block screen always fell back to its default (Sleep) styling even
 * during an active Rise Guard window. ForegroundGuardService's own call site
 * already passed it correctly — only this one (the primary enforcement path)
 * was missing it.
 */
public final class BlockEnforcer {

    private static final String TAG = "BlockEnforcer";

    /**
     * Only suppresses DUPLICATE block screens — never suppresses enforcement.
     *
     * CRITICAL: this MUST stay comfortably above ForegroundGuardService.POLL_MS,
     * otherwise every poll tick re-launches the block activity / re-posts the
     * full-screen notification, which looks exactly like the app crash-looping.
     */
    private static final long SCREEN_DEDUPE_MS = 4000;

    /** Cooldown on "pull the user out of the app" so HOME is not spammed 1x/sec. */
    private static final long LEAVE_COOLDOWN_MS = 2500;
    private static volatile long lastLeaveAt = 0L;

    private static final Map<String, Long> lastScreenAt = new HashMap<>();

    /** Last package seen in the foreground by the accessibility service. */
    private static volatile String lastForegroundPackage = null;
    private static volatile long lastForegroundAt = 0L;

    private BlockEnforcer() {}

    // ------------------------------------------------------------------
    // Diagnostics — surfaced to the UI so "active but nothing blocked" is
    // never a mystery again.
    // ------------------------------------------------------------------
    public static volatile String  lastPhase        = "UNKNOWN";
    public static volatile boolean lastLocking      = false;
    public static volatile String  lastProbePackage = null;
    public static volatile boolean lastUsageAccess  = false;
    public static volatile boolean lastAccessibility = false;
    public static volatile long    lastGuardPassAt  = 0L;
    public static volatile long    lastBlockAt      = 0L;
    public static volatile String  lastBlockedPkg   = null;
    public static volatile String  lastError        = null;

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

    /**
     * Runs the "leave the blocked app" action at most once per cooldown.
     *
     * Without this, both enforcement drivers (the 1s poll and the accessibility
     * event stream) could issue GLOBAL_ACTION_HOME several times a second, which
     * on the device looks like the launcher relaunching over and over — the
     * "phone keeps restarting" symptom.
     */
    private static void leave(Runnable leaveApp) {
        if (leaveApp == null) return;
        long now = SystemClock.elapsedRealtime();
        if (now - lastLeaveAt < LEAVE_COOLDOWN_MS) return;
        lastLeaveAt = now;
        try { leaveApp.run(); } catch (Throwable t) { Log.w(TAG, "leaveApp failed", t); }
    }

    /** Called right after the user has been pulled out of a blocked app. */
    public static void noteLeftBlockedApp(String pkg) {
        lastLeaveAt = SystemClock.elapsedRealtime();
        if (pkg != null && pkg.equals(lastForegroundPackage)) {
            // Stop the stale foreground cache from resurrecting the app the user
            // just left and re-triggering the block screen a second later.
            lastForegroundPackage = null;
            lastForegroundAt = 0L;
        }
    }


    /**
     * Packages that must never be intercepted by ANY blocking path: Life OS
     * itself (otherwise the user is locked out of the very screen that turns
     * the lock off), and our own block screens.
     */
    public static boolean isNeverBlockable(Context ctx, String pkg) {
        if (pkg == null || pkg.isEmpty()) return true;
        // Runtime application id is the only authoritative self identity. The
        // Java namespace is com.mylifeos.app, but the installed application id
        // is com.mylifeosv2.app, so hardcoded prefixes are unsafe here.
        if (pkg.equals(ctx.getApplicationContext().getPackageName())) return true;
        if (pkg.contains("ShieldBlock") || pkg.contains("NightToRise")) return true;
        return false;
    }

    /** Result of one enforcement pass. */
    public static final class Result {
        public final boolean blocked;
        public final boolean sleepToRise;
        public Result(boolean blocked, boolean sleepToRise) {
            this.blocked = blocked; this.sleepToRise = sleepToRise;
        }
        static final Result NONE = new Result(false, false);
    }

    /**
     * Evaluates {@code pkg} and, when it must be blocked, leaves the app and
     * shows the right block screen.
     *
     * @param leaveApp action that pulls the user out of the offending app
     *                 (GLOBAL_ACTION_HOME from the accessibility service, or a
     *                 HOME intent from the poll service).
     */
    public static Result enforce(Context ctx, String pkg, Runnable leaveApp) {
        if (isNeverBlockable(ctx, pkg)) return Result.NONE;

        // ---------- 1. Sleep to Rise (allowlist model) ----------
        try {
            NightToRiseManager n2r = new NightToRiseManager(ctx);
            NightToRiseManager.Decision d = n2r.decide(System.currentTimeMillis(), pkg);
            if (d.shouldBlock) {
                if (allowScreen(pkg)) {
                    n2r.prefs().recordBlockedAttempt(
                        pkg,
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
                    // FIX: this was missing — the block screen always fell back
                    // to Sleep styling without it, even during Rise Guard.
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
            // Lock window is over — drop any pending strict-unlock request.
            if (n2r.prefs().strictUnlockRequestedAt() > 0
                && d.phase != NightToRiseManager.Phase.SLEEP_LOCK
                && d.phase != NightToRiseManager.Phase.RISE_LOCK) {
                n2r.prefs().clearStrictUnlockRequest();
            }
        } catch (Throwable t) {
            Log.w(TAG, "Sleep to Rise check failed", t);
        }

        // ---------- 2. Shield "Block Apps" list ----------
        try {
            ShieldPreferences prefs = new ShieldPreferences(ctx);
            Set<String> blockedApps = prefs.getBlockedApps();
            if (blockedApps != null && blockedApps.contains(pkg)) {
                if (allowScreen(pkg)) {
                    prefs.incrementBlockedAttempts();
                    Intent intent = new Intent(ctx, ShieldBlockActivity.class);
                    intent.putExtra("BLOCKED_PACKAGE", pkg);
                    intent.putExtra("IS_ADULT_BLOCK", false);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                        | Intent.FLAG_ACTIVITY_NO_ANIMATION);
                    // [SHIELD-CARD] overlay first; the activity is used only if no overlay can be drawn.
                    presentShield(ctx, intent, leaveApp);
                } else if (!isBlockScreenForeground()) {
                    leave(leaveApp);
                }
                return new Result(true, false);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Shield blocklist check failed", t);
        }

        return Result.NONE;
    }

    // ------------------------------------------------------------------
    // Block-screen launching
    //
    // ROOT CAUSE of "guards report active but nothing is blocked":
    // enforce() used to call ctx.startActivity() unconditionally. That works
    // from the accessibility service (exempt from background-activity-start
    // restrictions), but ForegroundGuardService is a plain service — on
    // Android 10+ its startActivity() is silently swallowed by the platform
    // unless "Display over other apps" (SYSTEM_ALERT_WINDOW) is granted.
    // No exception, no log: the block screen simply never appeared.
    //
    // So: only start the activity directly when that is actually allowed,
    // and otherwise fall back to a high-priority full-screen-intent
    // notification, which is one of the few background-launch paths still
    // honoured on Android 10-15.
    // ------------------------------------------------------------------

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

    /**
     * [SHIELD-CARD] Shield block presentation. Strict order, never two at once, no timers:
     *   1. accessibility overlay  (instant; not subject to background-launch limits)
     *   2. system overlay         (needs only "Display over other apps")
     *   3. ShieldBlockActivity    (only when no overlay could be drawn)
     *   4. full-screen notification
     * Sleep to Rise keeps using launchBlockScreen() below, unchanged.
     */
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

        // Prefer the bound accessibility service itself. Starting from the
        // polling foreground service is restricted on Android 10+, even when
        // accessibility happens to be connected in the same process.
        // [N2R-REBOOT-FIX] Same rule as Shield's presentShield(): a successful
        // presentation stops here. The old code ALSO scheduled a "just in
        // case" BlockingOverlay 450ms after a successful Activity launch,
        // unconditionally — even when the Activity was already on screen.
        // That put two full-screen surfaces on top of each other on every
        // single block, which is what was actually causing the repeated
        // flashing and, almost certainly, the reboot: WindowManager churn
        // this rapid is the same failure class already documented and fixed
        // once before in ForegroundGuardService (see its SAFETY-CRITICAL
        // comment). dismissBlockingOverlay() cannot cancel this scheduled
        // call — it can only hide a view that already exists — so the
        // Activity had no way to prevent it.
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
        // Accessibility-independent tier: a plain TYPE_APPLICATION_OVERLAY needs
        // only "Display over other apps". Without this, every remaining path
        // shares accessibility as a single point of failure and the block screen
        // silently never appears on Android 14/15.
        if (BlockingOverlay.showSystem(ctx, sleepToRise, rise, title, body, leaveApp)) {
            lastError = null;
            return true;
        }
        return showFullScreenFallback(ctx, i, title, body);
    }

    /** Android 14+ auto-revokes full-screen-intent for ordinary apps. */
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
