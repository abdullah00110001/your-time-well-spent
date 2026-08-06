package com.mylifeos.app.nighttorise;

import android.content.Context;
import java.util.Calendar;
import java.util.Set;

/**
 * NightToRiseManager — pure decision logic. Given the current time, returns
 * whether the foreground app should be blocked, in which phase, and the
 * message/end-time to display on the block screen.
 *
 * FIX (v2): Sleep lock no longer auto-releases after a fixed 30-min grace.
 * It now runs continuously from the sleep-start time until either:
 *   - the next Rise alarm fires (seamless hand-off to RISE_LOCK), or
 *   - DEFAULT_MAX_LOCK_MINUTES elapses, if no alarm is set.
 * This closes the "gap window" where nothing was blocked between the old
 * 30-min grace and the alarm going off.
 */
public class NightToRiseManager {

    public enum Phase { OFF, ARMED, SLEEP_LOCK, RISE_LOCK, PAUSED, INACTIVE_DAY }

    /** Fallback lock duration when no rise alarm is configured (9.5 hours). */
    private static final int DEFAULT_MAX_LOCK_MINUTES = 570;

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

    public NightToRiseManager(Context ctx) {
        this.prefs = new NightToRisePreferences(ctx);
    }

    public NightToRisePreferences prefs() { return prefs; }

    /** Compute current decision. */
    public Decision decide(long nowMs, String foregroundPackage) {
        if (!prefs.isEnabled()) return new Decision(Phase.OFF, false, 0, "");
        if (prefs.pausedUntilMs() > nowMs) return new Decision(Phase.PAUSED, false, prefs.pausedUntilMs(), "");

        Set<String> allowed = prefs.allowedPackages();
        if (foregroundPackage != null && allowed.contains(foregroundPackage)) {
            return new Decision(Phase.ARMED, false, 0, "");
        }

        // ---- Sleep-start time (today or yesterday, whichever is most recent) ----
        String[] s = prefs.sleepTime().split(":");
        int sh = Integer.parseInt(s[0]), sm = Integer.parseInt(s[1]);
        int sleepStartMin = ((sh * 60 + sm) - prefs.sleepBeforeMin() + 1440) % 1440;
        long sleepStartMs = mostRecentOccurrence(sleepStartMin, nowMs);

        // Schedule-day check uses the DAY THE SLEEP WINDOW STARTED, not "now",
        // since "now" may already be past midnight into the next calendar day.
        if (!isDayActive(sleepStartMs)) {
            // Even if today isn't scheduled, a rise-lock from a still-open alarm
            // (set on a previous active day) should still be honored below.
            Decision riseOnly = checkRiseOnly(nowMs);
            if (riseOnly != null) return riseOnly;
            return new Decision(Phase.INACTIVE_DAY, false, 0, "");
        }

        long alarmMs = prefs.riseAlarmMs();
        boolean hasAlarm = alarmMs > sleepStartMs; // alarm belongs to this sleep window

        if (hasAlarm) {
            long riseEnd = alarmMs + (long) prefs.riseAfterMin() * 60_000L;
            if (nowMs >= sleepStartMs && nowMs < alarmMs) {
                return new Decision(Phase.SLEEP_LOCK, true, alarmMs, prefs.sleepMessage());
            }
            if (nowMs >= alarmMs && nowMs < riseEnd) {
                return new Decision(Phase.RISE_LOCK, true, riseEnd, prefs.riseMessage());
            }
        } else {
            long fallbackEnd = sleepStartMs + (long) DEFAULT_MAX_LOCK_MINUTES * 60_000L;
            if (nowMs >= sleepStartMs && nowMs < fallbackEnd) {
                return new Decision(Phase.SLEEP_LOCK, true, fallbackEnd, prefs.sleepMessage());
            }
        }

        return new Decision(Phase.ARMED, false, 0, "");
    }

    /**
     * Handles the edge case where the sleep window started on a scheduled day
     * but has rolled into a non-scheduled day (e.g. sleep Sun night -> wake
     * Mon, but only "weekdays" or a custom set that excludes Sunday is active).
     * We still allow a currently-open rise-lock to finish naturally.
     */
    private Decision checkRiseOnly(long nowMs) {
        long alarmMs = prefs.riseAlarmMs();
        if (alarmMs <= 0) return null;
        long riseEnd = alarmMs + (long) prefs.riseAfterMin() * 60_000L;
        if (nowMs >= alarmMs && nowMs < riseEnd) {
            return new Decision(Phase.RISE_LOCK, true, riseEnd, prefs.riseMessage());
        }
        return null;
    }

    private boolean isDayActive(long atMs) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(atMs);
        int dow = c.get(Calendar.DAY_OF_WEEK) - 1; // 0=Sun..6=Sat
        String mode = prefs.scheduleMode();
        if ("everyday".equals(mode)) return true;
        if ("weekdays".equals(mode)) return dow >= 1 && dow <= 5;
        return prefs.scheduleDays().contains(dow);
    }

    /** Latest timestamp <= nowMs at which the clock read `minuteOfDay`. */
    private long mostRecentOccurrence(int minuteOfDay, long nowMs) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(nowMs);
        c.set(Calendar.HOUR_OF_DAY, minuteOfDay / 60);
        c.set(Calendar.MINUTE, minuteOfDay % 60);
        c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() > nowMs) c.add(Calendar.DAY_OF_MONTH, -1);
        return c.getTimeInMillis();
    }
}
