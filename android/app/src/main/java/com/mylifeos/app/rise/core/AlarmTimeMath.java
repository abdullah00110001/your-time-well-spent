package com.mylifeos.app.rise.core;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * AlarmTimeMath — pure, unit-testable time helpers for recurring alarms.
 * No Android APIs so it can run on the JVM in unit tests.
 */
public final class AlarmTimeMath {

    private AlarmTimeMath() {}

    public static final long WEEK_MS = 7L * 24 * 60 * 60 * 1000;

    /**
     * Next future occurrence of {@code dayOfWeek} (0=Sun..6=Sat) at hour:minute.
     * Returns a timestamp strictly greater than {@code nowMs}.
     */
    public static long nextOccurrence(int dayOfWeek, int hour, int minute, long nowMs, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(nowMs);
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        int current = c.get(Calendar.DAY_OF_WEEK) - 1; // 0=Sun
        int diff = dayOfWeek - current;
        if (diff < 0) diff += 7;
        c.add(Calendar.DAY_OF_MONTH, diff);
        if (c.getTimeInMillis() <= nowMs) c.add(Calendar.DAY_OF_MONTH, 7);
        return c.getTimeInMillis();
    }

    public static long nextOccurrence(int dayOfWeek, int hour, int minute, long nowMs) {
        return nextOccurrence(dayOfWeek, hour, minute, nowMs, TimeZone.getDefault());
    }

    /**
     * Rolls a stored weekly trigger forward until it is in the future, keeping
     * the same local time-of-day and weekday (DST safe because it steps in
     * calendar days rather than fixed milliseconds).
     */
    public static long rollForwardWeekly(long previousTriggerMs, long nowMs, TimeZone tz) {
        if (previousTriggerMs > nowMs) return previousTriggerMs;
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(previousTriggerMs);
        int guard = 0;
        while (c.getTimeInMillis() <= nowMs && guard++ < 520) {
            c.add(Calendar.DAY_OF_MONTH, 7);
        }
        return c.getTimeInMillis();
    }

    public static long rollForwardWeekly(long previousTriggerMs, long nowMs) {
        return rollForwardWeekly(previousTriggerMs, nowMs, TimeZone.getDefault());
    }

    /** Day of week (0=Sun..6=Sat) for a timestamp. */
    public static int dayOfWeek(long atMs, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(atMs);
        return c.get(Calendar.DAY_OF_WEEK) - 1;
    }
}
