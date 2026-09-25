package com.mylifeos.app.nighttorise;

import java.util.Calendar;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.TimeZone;

/**
 * NightToRiseDecider — the pure, side-effect free heart of Sleep to Rise.
 *
 * It knows nothing about Android Context / SharedPreferences so it can be unit
 * tested directly (midnight rollover, blocklist vs allowlist, safety
 * exemptions, alarm hand-off). NightToRiseManager adapts the persisted
 * preferences onto {@link Config} and delegates here.
 *
 * FIX (v4): Sleep Guard and Rise Guard can now be toggled independently
 * (cfg.sleepGuardEnabled / cfg.riseGuardEnabled), and Sleep Guard supports two
 * end modes:
 *   - "until-alarm" (default, unchanged behavior): Sleep Guard runs
 *     continuously until the Rise alarm fires (or the safety cap, if no
 *     alarm) — no gap between Sleep Guard and Rise Guard.
 *   - "duration": Sleep Guard auto-releases a fixed number of minutes after
 *     it starts (cfg.sleepGuardDurationMinutes), regardless of the alarm.
 *     This intentionally creates a GAP — the phone is unlocked between
 *     Sleep Guard ending and Rise Guard starting at the alarm — matching what
 *     was explicitly requested: "Sleep Guard auto-off after 2-3 hours, Rise
 *     Guard starts separately when the alarm fires."
 */
public final class NightToRiseDecider {

    private NightToRiseDecider() {}

    public enum Phase { OFF, ARMED, SLEEP_LOCK, RISE_LOCK, PAUSED, INACTIVE_DAY }

    /** Fallback lock duration when no rise alarm is configured (spec: 10 hours). */
    public static final int DEFAULT_MAX_LOCK_MINUTES = 600;

    /** A sleep window can never span longer than this (18 hours). */
    static final long MAX_WINDOW_MS = 18L * 60 * 60 * 1000;

    /**
     * Packages that can never be locked. Emergency calling, the system dialer,
     * the system clock, the system UI (status bar / recents chrome) and Life OS
     * itself must always stay reachable, in every mode.
     */
    private static final String[] SAFE_EXACT = new String[]{
        "com.android.phone",
        "com.android.dialer",
        "com.google.android.dialer",
        "com.samsung.android.dialer",
        "com.android.server.telecom",
        "com.android.emergency",
        "com.android.deskclock",
        "com.google.android.deskclock",
        "com.sec.android.app.clockpackage",
        "com.android.systemui",
        "com.android.settings",
    };

    private static final String[] SAFE_CONTAINS = new String[]{
        "dialer", "telecom", "emergency", "incallui", "deskclock", "clockpackage", "systemui",
    };

    public static class Config {
        public boolean enabled;
        public long    pausedUntilMs;
        public String  sleepTime = "22:30";     // "HH:MM"
        public int     sleepBeforeMin = 30;
        public int     riseAfterMin = 30;
        public long    riseAlarmMs;
        /**
         * Weekdays (0=Sun..6=Sat) the rise alarm rings on. EMPTY means daily.
         * Without this the alarm's clock time was repeated every morning, so
         * Rise Guard locked the phone on days with no alarm at all.
         */
        public Set<Integer> riseAlarmDays = new HashSet<>();
        public String  scheduleMode = "everyday";
        public Set<Integer> scheduleDays = new HashSet<>();
        /** The ONLY packages the user may foreground during a lock window. */
        public Set<String>  allowedPackages = Collections.emptySet();
        /**
         * Runtime-resolved safety exemptions (e.g. the device's default SMS
         * app), added on top of the hardcoded SAFE_* lists.
         */
        public Set<String>  extraSafePackages = Collections.emptySet();
        public String  sleepMessage = "Time to rest.";
        public String  riseMessage  = "Start your morning right.";
        /** Our own package — always exempt. */
        public String  selfPackage = "com.mylifeos.app";
        /** Injectable for deterministic tests. */
        public TimeZone timeZone = TimeZone.getDefault();
        /**
         * NEW (v3 safety cap): user-configurable ceiling (minutes) on how long
         * Sleep Guard can run with NO valid alarm attached, so a missed/never
         * -set alarm can never leave the lock running indefinitely. Defaults
         * to DEFAULT_MAX_LOCK_MINUTES when the user hasn't set one.
         */
        public int safetyCapMinutes = DEFAULT_MAX_LOCK_MINUTES;

        // NEW (v4) — independent guard toggles + Sleep Guard end mode.
        public boolean sleepGuardEnabled = true;
        public boolean riseGuardEnabled  = true;
        /** "until-alarm" (default) or "duration". */
        public String  sleepGuardEndMode = "until-alarm";
        /** Minutes Sleep Guard runs when sleepGuardEndMode == "duration". */
        public int     sleepGuardDurationMinutes = 180;
    }


    public static class Decision {
        public final Phase phase;
        public final boolean shouldBlock;
        public final long endTimeMs;
        public final String message;
        public Decision(Phase p, boolean b, long end, String msg) {
            this.phase = p; this.shouldBlock = b; this.endTimeMs = end; this.message = msg;
        }
    }

    /** True when the package must never be locked, whatever the config says. */
    public static boolean isSafePackage(Config cfg, String pkg) {
        if (pkg == null || pkg.isEmpty()) return true;
        if (cfg.selfPackage != null && pkg.equals(cfg.selfPackage)) return true;
        if (cfg.extraSafePackages != null && cfg.extraSafePackages.contains(pkg)) return true;
        for (String s : SAFE_EXACT) if (s.equals(pkg)) return true;
        String lower = pkg.toLowerCase();
        for (String s : SAFE_CONTAINS) if (lower.contains(s)) return true;
        return false;
    }

    /** Packages displayed by the native block screen as still reachable. */
    public static Set<String> effectiveAllowedPackages(Config cfg) {
        Set<String> out = new LinkedHashSet<>();
        if (cfg.allowedPackages != null) out.addAll(cfg.allowedPackages);
        if (cfg.extraSafePackages != null) out.addAll(cfg.extraSafePackages);
        Collections.addAll(out, SAFE_EXACT);
        return out;
    }

    /**
     * FIX (v5) — mirrors the JS model in timeMath.ts exactly, which is the
     * SINGLE source of truth the UI shows to the user:
     *
     *   - Sleep Guard : [sleepStart, alarmTimeOfDay) on the clock circle.
     *   - Rise Guard  : [alarmTimeOfDay, alarmTimeOfDay + riseAfterMin).
     *
     * Previously the native side rejected any alarm more than 18h after the
     * sleep start ("hasAlarm=false"), fell back to the safety cap, and ALSO
     * skipped Rise Guard entirely in that case. The UI, working purely on the
     * 24h clock, kept saying "Sleep Guard active" / "Rise Guard active" while
     * native reported ARMED and blocked nothing. Both guards are now derived
     * from the alarm's time-of-day, so what the UI shows is what native does.
     */
    public static Decision decide(Config cfg, long nowMs, String foregroundPackage) {
        if (cfg == null || !cfg.enabled) return new Decision(Phase.OFF, false, 0, "");
        if (cfg.pausedUntilMs > nowMs)   return new Decision(Phase.PAUSED, false, cfg.pausedUntilMs, "");

        // ---- Safety exemptions come first ----
        if (isSafePackage(cfg, foregroundPackage)) return new Decision(Phase.ARMED, false, 0, "");

        // ---- ALLOWLIST: anything explicitly allowed passes through ----
        if (foregroundPackage != null
            && cfg.allowedPackages != null
            && cfg.allowedPackages.contains(foregroundPackage)) {
            return new Decision(Phase.ARMED, false, 0, "");
        }

        int  sleepStartMin = sleepStartMinuteOfDay(cfg);
        long sleepStartMs  = mostRecentOccurrence(cfg, sleepStartMin, nowMs);
        boolean hasAlarm   = cfg.riseAlarmMs > 0;

        // ---- Rise Guard: pure time-of-day window, checked FIRST ----
        if (cfg.riseGuardEnabled && hasAlarm && cfg.riseAfterMin > 0) {
            int  alarmMin  = minuteOfDay(cfg, cfg.riseAlarmMs);
            long riseStart = mostRecentOccurrence(cfg, alarmMin, nowMs);
            long riseEnd   = riseStart + (long) cfg.riseAfterMin * 60_000L;
            // FIX: only lock a morning the alarm actually rings on.
            if (nowMs >= riseStart && nowMs < riseEnd && isAlarmDay(cfg, riseStart)) {
                // Honour the schedule of the night that led into this morning.
                long nightStart = mostRecentOccurrence(cfg, sleepStartMin, riseStart);
                if (isDayActive(cfg, nightStart)) {
                    return new Decision(Phase.RISE_LOCK, true, riseEnd, cfg.riseMessage);
                }
            }
        }

        // Schedule-day check uses the DAY THE SLEEP WINDOW STARTED.
        if (!isDayActive(cfg, sleepStartMs)) return new Decision(Phase.INACTIVE_DAY, false, 0, "");

        // ---- Sleep Guard phase ----
        if (cfg.sleepGuardEnabled) {
            // Hand off to the next occurrence that falls on a day the alarm
            // really rings on — not simply tomorrow at alarm o'clock.
            long alarmMs = hasAlarm ? nextAlarmOnValidDayAfter(cfg, sleepStartMs) : 0L;
            long capMs   = sleepStartMs
                + (long) (cfg.safetyCapMinutes > 0 ? cfg.safetyCapMinutes : DEFAULT_MAX_LOCK_MINUTES) * 60_000L;
            boolean alarmUsable = alarmMs > sleepStartMs && alarmMs <= capMs;
            long sleepEnd;
            if ("duration".equals(cfg.sleepGuardEndMode)) {
                int dur = Math.max(15, cfg.sleepGuardDurationMinutes);
                sleepEnd = sleepStartMs + (long) dur * 60_000L;
                if (alarmUsable && alarmMs < sleepEnd) sleepEnd = alarmMs;
            } else {
                // The cap is always counted from the LOCK START, exactly as the
                // in-app countdown does, so screen and phone can never drift.
                sleepEnd = alarmUsable ? alarmMs : capMs;
            }
            if (nowMs >= sleepStartMs && nowMs < sleepEnd) {
                return new Decision(Phase.SLEEP_LOCK, true, sleepEnd, cfg.sleepMessage);
            }
        }

        return new Decision(Phase.ARMED, false, 0, "");
    }

    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    /** Local minute-of-day (0..1439) of an epoch timestamp. */
    static int minuteOfDay(Config cfg, long epochMs) {
        Calendar c = Calendar.getInstance(cfg.timeZone);
        c.setTimeInMillis(epochMs);
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
    }

    /** Earliest timestamp strictly AFTER {@code afterMs} at which the clock reads `minuteOfDay`. */
    static long nextOccurrenceAfter(Config cfg, int minuteOfDay, long afterMs) {
        Calendar c = Calendar.getInstance(cfg.timeZone);
        c.setTimeInMillis(afterMs);
        c.set(Calendar.HOUR_OF_DAY, minuteOfDay / 60);
        c.set(Calendar.MINUTE, minuteOfDay % 60);
        c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= afterMs) c.add(Calendar.DAY_OF_MONTH, 1);
        return c.getTimeInMillis();
    }

    /** Kept for callers/tests: snaps an alarm onto (sleepStartMs, sleepStartMs + 24h]. */
    static long alarmForWindow(long alarmMs, long sleepStartMs) {
        if (alarmMs <= 0) return 0L;
        long shifted = alarmMs;
        while (shifted - sleepStartMs > DAY_MS) shifted -= DAY_MS;
        while (shifted <= sleepStartMs) shifted += DAY_MS;
        return shifted;
    }

    static int sleepStartMinuteOfDay(Config cfg) {
        String time = (cfg.sleepTime == null || !cfg.sleepTime.contains(":")) ? "22:30" : cfg.sleepTime;
        String[] s = time.split(":");
        int sh, sm;
        try { sh = Integer.parseInt(s[0].trim()); sm = Integer.parseInt(s[1].trim()); }
        catch (Throwable t) { sh = 22; sm = 30; }
        return ((sh * 60 + sm) - cfg.sleepBeforeMin + 1440 * 2) % 1440;
    }

    static boolean isDayActive(Config cfg, long atMs) {
        Calendar c = Calendar.getInstance(cfg.timeZone);
        c.setTimeInMillis(atMs);
        int dow = c.get(Calendar.DAY_OF_WEEK) - 1; // 0=Sun..6=Sat
        String mode = cfg.scheduleMode;
        if ("everyday".equals(mode)) return true;
        if ("weekdays".equals(mode)) return dow >= 1 && dow <= 5;
        return cfg.scheduleDays.contains(dow);
    }

    /**
     * Returns whether the alarm rings on the local calendar day represented by
     * {@code alarmMs}. An empty set means the alarm rings daily.
     */
    static boolean isAlarmDay(Config cfg, long alarmMs) {
        if (cfg == null || cfg.riseAlarmDays == null || cfg.riseAlarmDays.isEmpty()) {
            return true;
        }

        Calendar c = Calendar.getInstance(cfg.timeZone);
        c.setTimeInMillis(alarmMs);
        int dow = c.get(Calendar.DAY_OF_WEEK) - 1; // 0=Sun..6=Sat
        return cfg.riseAlarmDays.contains(dow);
    }

    /**
     * Finds the first alarm occurrence strictly after {@code afterMs} that
     * falls on a configured alarm day.
     */
    static long nextAlarmOnValidDayAfter(Config cfg, long afterMs) {
        if (cfg == null || cfg.riseAlarmMs <= 0) return 0L;

        int alarmMinute = minuteOfDay(cfg, cfg.riseAlarmMs);
        long candidate = nextOccurrenceAfter(cfg, alarmMinute, afterMs);

        // A weekly schedule must contain a valid day within seven occurrences.
        // The larger bound also protects against unusual or malformed configs.
        for (int i = 0; i < 370; i++) {
            if (isAlarmDay(cfg, candidate)) return candidate;
            candidate = nextOccurrenceAfter(cfg, alarmMinute, candidate);
        }

        return 0L;
    }

    /** Latest timestamp <= nowMs at which the clock read `minuteOfDay`. */
    static long mostRecentOccurrence(Config cfg, int minuteOfDay, long nowMs) {
        Calendar c = Calendar.getInstance(cfg.timeZone);
        c.setTimeInMillis(nowMs);
        c.set(Calendar.HOUR_OF_DAY, minuteOfDay / 60);
        c.set(Calendar.MINUTE, minuteOfDay % 60);
        c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() > nowMs) c.add(Calendar.DAY_OF_MONTH, -1);
        return c.getTimeInMillis();
    }
}
