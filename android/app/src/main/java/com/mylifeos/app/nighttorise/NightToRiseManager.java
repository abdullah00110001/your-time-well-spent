package com.mylifeos.app.nighttorise;

import android.content.Context;

/**
 * NightToRiseManager — thin Android adapter over {@link NightToRiseDecider}.
 *
 * All decision logic lives in the decider (pure, unit tested). This class only
 * reads persisted preferences and maps them onto a Config snapshot.
 *
 * Sleep lock runs continuously from the configured pre-sleep start until either
 * the next Rise alarm fires (seamless hand-off to RISE_LOCK) or the fallback
 * maximum elapses when no alarm is set — unless the user has chosen
 * "duration" end mode, in which case Sleep Guard auto-releases after a fixed
 * number of minutes and a gap follows until Rise Guard starts at the alarm.
 */
public class NightToRiseManager {

    /** Kept as an alias so existing call sites keep compiling. */
    public enum Phase { OFF, ARMED, SLEEP_LOCK, RISE_LOCK, PAUSED, INACTIVE_DAY }

    public static class Decision {
        public final Phase phase;
        public final boolean shouldBlock;
        public final long endTimeMs;
        public final String message;
        public Decision(Phase p, boolean b, long end, String msg) {
            this.phase = p; this.shouldBlock = b; this.endTimeMs = end; this.message = msg;
        }
    }

    private final NightToRisePreferences prefs;
    private final String selfPackage;
    private final Context appCtx;

    public NightToRiseManager(Context ctx) {
        this.prefs = new NightToRisePreferences(ctx);
        this.appCtx = ctx.getApplicationContext();
        this.selfPackage = appCtx.getPackageName();
    }

    public NightToRisePreferences prefs() { return prefs; }

    /** One shared instance: no new manager / prefs object per accessibility event. */
    private static volatile NightToRiseManager shared;
    public static NightToRiseManager get(Context ctx) {
        NightToRiseManager m = shared;
        if (m == null) {
            synchronized (NightToRiseManager.class) {
                if (shared == null) shared = new NightToRiseManager(ctx);
                m = shared;
            }
        }
        return m;
    }

    /**
     * Runtime safety exemptions that can only be resolved on-device: the user's
     * default SMS app, the default dialer, and every launcher that could ever
     * be the home-screen handler on this device.
     */
    /**
     * SAFETY-CRITICAL (device reboot): this resolution does 3+ PackageManager
     * binder calls (including queryIntentActivities, which returns every
     * launcher on the device). decide() is called once per second by the guard
     * service AND on every accessibility event, so it was issuing hundreds of
     * PackageManager transactions per second into system_server — a binder
     * flood that trips the system_server watchdog and restarts the phone.
     *
     * The result only changes when the user swaps their launcher / default SMS
     * / default dialer, so it is cached process-wide for 10 minutes.
     */
    private static final long SAFETY_CACHE_TTL_MS = 30L * 60 * 1000;
    private static volatile java.util.Set<String> safetyCache = null;
    private static volatile long safetyCacheAt = 0L;
    private static final java.util.concurrent.atomic.AtomicBoolean safetyResolving =
        new java.util.concurrent.atomic.AtomicBoolean(false);

    /**
     * SAFETY-CRITICAL (OPPO/ColorOS reboot): this NEVER does PackageManager work
     * on the calling thread anymore. decide() runs on the accessibility/guard
     * thread many times per second; resolving launchers/SMS/dialer/IMEs inline
     * issued heavy binder transactions into system_server until its watchdog
     * restarted the phone. Now the caller always gets the last known set
     * immediately, and a single background thread refreshes it at most once.
     */
    private java.util.Set<String> safetyPackages() {
        java.util.Set<String> cached = safetyCache;
        boolean stale = cached == null
            || android.os.SystemClock.elapsedRealtime() - safetyCacheAt > SAFETY_CACHE_TTL_MS;
        if (stale && safetyResolving.compareAndSet(false, true)) {
            final Context ctx = appCtx;
            Thread t = new Thread(() -> {
                try {
                    safetyCache = java.util.Collections.unmodifiableSet(resolveSafetyPackages(ctx));
                    safetyCacheAt = android.os.SystemClock.elapsedRealtime();
                } catch (Throwable ignored) {
                } finally {
                    safetyResolving.set(false);
                }
            }, "n2r-safety-resolve");
            t.setPriority(Thread.MIN_PRIORITY);
            try { t.start(); } catch (Throwable ignored) { safetyResolving.set(false); }
        }
        return cached != null ? cached : java.util.Collections.<String>emptySet();
    }

    private static java.util.Set<String> resolveSafetyPackages(Context appCtx) {
        java.util.Set<String> out = new java.util.HashSet<>();
        try {
            String sms = android.provider.Telephony.Sms.getDefaultSmsPackage(appCtx);
            if (sms != null) out.add(sms);
        } catch (Throwable ignored) {}
        try {
            android.telecom.TelecomManager tm =
                (android.telecom.TelecomManager) appCtx.getSystemService(Context.TELECOM_SERVICE);
            if (tm != null) {
                String dialer = tm.getDefaultDialerPackage();
                if (dialer != null) out.add(dialer);
            }
        } catch (Throwable ignored) {}
        // Every launcher that could ever handle Home must stay reachable, or the
        // block screen re-covers the home screen on every poll tick.
        try {
            android.content.Intent home = new android.content.Intent(android.content.Intent.ACTION_MAIN);
            home.addCategory(android.content.Intent.CATEGORY_HOME);
            android.content.pm.PackageManager pm = appCtx.getPackageManager();
            android.content.pm.ResolveInfo ri = pm.resolveActivity(home, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
            if (ri != null && ri.activityInfo != null) out.add(ri.activityInfo.packageName);
            for (android.content.pm.ResolveInfo r : pm.queryIntentActivities(home, 0)) {
                if (r.activityInfo != null) out.add(r.activityInfo.packageName);
            }
        } catch (Throwable ignored) {}
        try {
            android.view.inputmethod.InputMethodManager imm =
                (android.view.inputmethod.InputMethodManager) appCtx.getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) for (android.view.inputmethod.InputMethodInfo im : imm.getEnabledInputMethodList())
                out.add(im.getPackageName());
        } catch (Throwable ignored) {}
        return out;
    }

    /**
     * Marks the launcher/SMS/dialer exemptions stale. It deliberately keeps the
     * old set in place: dropping it to null would make every package look
     * blockable for the split second before the refresh lands, which is exactly
     * the window that produced the block-screen storm on ColorOS.
     */
    public static void invalidateSafetyCache() {
        safetyCacheAt = 0L;
    }



    public NightToRiseDecider.Config snapshot() {
        NightToRiseDecider.Config cfg = new NightToRiseDecider.Config();
        cfg.enabled         = prefs.isEnabled();
        cfg.pausedUntilMs   = prefs.pausedUntilMs();
        cfg.sleepTime       = prefs.sleepTime();
        cfg.sleepBeforeMin  = prefs.sleepBeforeMin();
        cfg.riseAfterMin    = prefs.riseAfterMin();
        cfg.riseAlarmMs     = prefs.riseAlarmMs();
        cfg.riseAlarmDays   = prefs.riseAlarmDays();
        cfg.scheduleMode    = prefs.scheduleMode();
        cfg.scheduleDays    = prefs.scheduleDays();
        cfg.allowedPackages = prefs.allowedPackages();
        cfg.extraSafePackages = safetyPackages();

        cfg.sleepMessage    = prefs.sleepMessage();
        cfg.riseMessage     = prefs.riseMessage();
        cfg.selfPackage     = selfPackage;
        // NEW (v3 safety cap): wire the user-configurable ceiling through to
        // the decider. Falls back to the decider's own default (9.5h) if the
        // stored value is somehow 0/unset.
        int capHours = prefs.safetyCapHours();
        cfg.safetyCapMinutes = capHours > 0 ? capHours * 60 : NightToRiseDecider.DEFAULT_MAX_LOCK_MINUTES;

        // NEW (v4): independent guard toggles + Sleep Guard end mode.
        cfg.sleepGuardEnabled = prefs.sleepGuardEnabled();
        cfg.riseGuardEnabled  = prefs.riseGuardEnabled();
        cfg.sleepGuardEndMode = prefs.sleepGuardEndMode();
        cfg.sleepGuardDurationMinutes = prefs.sleepGuardDurationMinutes();

        return cfg;
    }

    /** Compute the current decision for a foreground package. */
    public Decision decide(long nowMs, String foregroundPackage) {
        // Native Sleep to Rise enforcement is retired: blocking now runs through
        // the Shield block list (driven from JS). Never block from here.
        return new Decision(Phase.OFF, false, 0L, "");
    }

    /**
     * Called from BootReceiver: the stored Rise alarm reference points at a
     * timestamp that may have passed while the phone was off, which would leave
     * the Rise window permanently "already ended". Re-point it at the earliest
     * future alarm shot that survived the reboot so Sleep/Rise enforcement
     * keeps working without waiting for the app to be opened.
     */
    public static void onBootRestored(Context ctx) {
        NightToRisePreferences p = new NightToRisePreferences(ctx);
        long now = System.currentTimeMillis();
        if (p.riseAlarmMs() > now) return;

        long earliest = Long.MAX_VALUE;
        for (com.mylifeos.app.rise.scheduler.RiseAlarmStore.Shot s
                : com.mylifeos.app.rise.scheduler.RiseAlarmStore.all(ctx)) {
            if (s == null) continue;
            long when = s.dayOfWeek >= 0
                ? com.mylifeos.app.rise.core.AlarmTimeMath.rollForwardWeekly(s.timeInMillis, now)
                : s.timeInMillis;
            if (when > now && when < earliest) earliest = when;
        }
        if (earliest != Long.MAX_VALUE) p.saveRiseAlarmMillis(earliest);
    }
}
