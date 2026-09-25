package com.mylifeos.app.rise.nighttorise;

import java.util.Calendar;
import java.util.Set;

/**
 * Pure phase logic for Sleep-to-Rise, mirroring the `status` memo in
 * useNightToRise.ts — with one deliberate difference: Rise Guard here is
 * event-driven (starts when the alarm is actually dismissed, via
 * NightToRiseManager#onAlarmDismissed) rather than clock-driven. Sleep
 * Guard remains clock-driven, anchored to the rise-alarm epoch pushed from
 * JS via setRiseAlarm.
 */
public final class NightToRiseDecider {

    public enum Phase {
        OFF, PAUSED, INACTIVE_DAY, SLEEP_LOCK, RISE_LOCK, ARMED
    }

    public static final class Result {
        public final Phase phase;
        /** Epoch millis the current lock window ends, or 0 if not locked. */
        public final long windowEndEpochMillis;

        Result(Phase phase, long windowEndEpochMillis) {
            this.phase = phase;
            this.windowEndEpochMillis = windowEndEpochMillis;
        }
    }

    private NightToRiseDecider() {
    }

    public static Result computePhase(NightToRisePreferences prefs, long nowEpochMillis) {
        if (!prefs.isEnabled() || !prefs.isConfigured()) {
            return new Result(Phase.OFF, 0L);
        }

        long pausedUntil = prefs.getPausedUntilEpoch();
        if (pausedUntil > nowEpochMillis) {
            return new Result(Phase.PAUSED, pausedUntil);
        }

        if (!isScheduledToday(prefs, nowEpochMillis)) {
            return new Result(Phase.INACTIVE_DAY, 0L);
        }

        // Rise Guard takes priority: it's event-driven (started on alarm
        // dismiss) and should win even if, for some reason, the clock-driven
        // sleep-window math still thinks it's "before" the rise alarm.
        long riseGuardUntil = prefs.getRiseGuardActiveUntilEpoch();
        if (riseGuardUntil > nowEpochMillis) {
            return new Result(Phase.RISE_LOCK, riseGuardUntil);
        }

        long riseAlarmEpoch = prefs.getRiseAlarmEpochMillis();
        int sleepStartMinutes = wrapMinutes(
                prefs.getSleepTimeMinutes() - prefs.getSleepLockMinutesBefore());

        long sleepStart;
        long sleepEnd;
        if (riseAlarmEpoch > 0) {
            sleepStart = epochOfPriorOrEqualTimeOfDay(riseAlarmEpoch, sleepStartMinutes);
            sleepEnd = riseAlarmEpoch;
        } else {
            // No alarm configured — fall back to a fixed 9.5h window from
            // sleep time, same fallback useNightToRise.ts uses for its
            // in-app preview overlay.
            sleepStart = epochOfPriorOrEqualTimeOfDay(nowEpochMillis, sleepStartMinutes);
            if (sleepStart > nowEpochMillis) {
                sleepStart -= 24L * 60 * 60 * 1000;
            }
            sleepEnd = sleepStart + 570L * 60 * 1000; // 9.5 hours
        }

        if (nowEpochMillis >= sleepStart && nowEpochMillis < sleepEnd) {
            return new Result(Phase.SLEEP_LOCK, sleepEnd);
        }

        return new Result(Phase.ARMED, 0L);
    }

    private static boolean isScheduledToday(NightToRisePreferences prefs, long nowEpochMillis) {
        String mode = prefs.getScheduleMode();
        if ("everyday".equals(mode)) {
            return true;
        }
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(nowEpochMillis);
        int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK) - 1; // Calendar.SUNDAY=1 -> 0

        if ("weekdays".equals(mode)) {
            return dayOfWeek >= 1 && dayOfWeek <= 5;
        }
        // "custom"
        Set<String> days = prefs.getScheduleDays();
        return days.contains(String.valueOf(dayOfWeek));
    }

    /**
     * Finds the most recent epoch (at or before anchorEpochMillis) whose
     * time-of-day equals minutesOfDay. Used to anchor the sleep-window
     * start to "the occurrence just before the alarm/now", regardless of
     * whether that means today or yesterday.
     */
    static long epochOfPriorOrEqualTimeOfDay(long anchorEpochMillis, int minutesOfDay) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(anchorEpochMillis);
        cal.set(Calendar.HOUR_OF_DAY, minutesOfDay / 60);
        cal.set(Calendar.MINUTE, minutesOfDay % 60);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() > anchorEpochMillis) {
            cal.add(Calendar.DAY_OF_MONTH, -1);
        }
        return cal.getTimeInMillis();
    }

    private static int wrapMinutes(int minutes) {
        int wrapped = minutes % 1440;
        return wrapped < 0 ? wrapped + 1440 : wrapped;
    }

    /**
     * Whether a foreground package should be blocked given the current
     * phase and the configured blocklist/allowlist.
     */
    public static boolean shouldBlockPackage(NightToRisePreferences prefs, Phase phase,
                                              String ownPackageName, String foregroundPackage) {
        if (phase != Phase.SLEEP_LOCK && phase != Phase.RISE_LOCK) {
            return false;
        }
        if (foregroundPackage.equals(ownPackageName)) {
            return false;
        }
        if (NightToRisePreferences.ALWAYS_ALLOWED_IDS.contains(foregroundPackage)) {
            return false;
        }
        if (prefs.getAllowedApps().contains(foregroundPackage)) {
            return false;
        }

        if ("allowlist".equals(prefs.getBlocklistMode())) {
            // Stricter: everything is locked except explicitly allowed apps
            // (already excluded above), so anything else reaching here is
            // blocked.
            return true;
        }
        // "blocklist" mode: only the configured blockedApps are locked.
        return prefs.getBlockedApps().contains(foregroundPackage);
    }
}

