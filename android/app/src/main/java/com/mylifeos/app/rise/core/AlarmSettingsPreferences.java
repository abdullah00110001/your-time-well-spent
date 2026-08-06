package com.mylifeos.app.rise.core;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Reads alarm user-preferences from Capacitor's SharedPreferences ("CapacitorStorage").
 *
 * Capacitor's Preferences plugin stores every key with a "_cap_" prefix, so the keys here
 * MUST match the JS-side {@code PK.*} constants in {@code src/components/rise/RiseSettings.tsx},
 * prepended with "_cap_".
 */
public final class AlarmSettingsPreferences {

    private AlarmSettingsPreferences() {}

    private static final String CAP_PREFIX = "_cap_";

    // Keys (must mirror RiseSettings.tsx)
    public static final String K_RINGTONE_URI    = "alarm.ringtoneUri";
    public static final String K_RINGTONE_NAME   = "alarm.ringtoneName";
    public static final String K_VOLUME_PCT      = "alarm.volumePct";      // 0..100
    public static final String K_VIBRATE         = "alarm.vibrate";        // true/false
    public static final String K_SNOOZE_MINUTES  = "alarm.snoozeMinutes";  // 1/3/5/10/15
    public static final String K_CRESCENDO       = "alarm.crescendo";      // true/false

    // Sensible defaults — match RiseSettings.tsx DEFAULTS
    public static final int     DEFAULT_VOLUME_PCT     = 100;
    public static final boolean DEFAULT_VIBRATE        = true;
    public static final int     DEFAULT_SNOOZE_MINUTES = 5;
    public static final boolean DEFAULT_CRESCENDO      = false;

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext()
                  .getSharedPreferences(AlarmConstants.PREFS_CAPACITOR, Context.MODE_PRIVATE);
    }

    private static String getStr(Context ctx, String key) {
        try { return prefs(ctx).getString(CAP_PREFIX + key, null); }
        catch (Exception ignored) { return null; }
    }

    public static String getRingtoneUri(Context ctx) {
        String v = getStr(ctx, K_RINGTONE_URI);
        return (v == null || v.isEmpty()) ? null : v;
    }

    public static String getRingtoneName(Context ctx) {
        return getStr(ctx, K_RINGTONE_NAME);
    }

    /** Volume percent 0..100. Defaults to 100 (max). */
    public static int getVolumePct(Context ctx) {
        String v = getStr(ctx, K_VOLUME_PCT);
        if (v == null) return DEFAULT_VOLUME_PCT;
        try {
            int n = Integer.parseInt(v.trim());
            if (n < 0) return 0;
            if (n > 100) return 100;
            return n;
        } catch (NumberFormatException e) {
            return DEFAULT_VOLUME_PCT;
        }
    }

    public static boolean isVibrateEnabled(Context ctx) {
        String v = getStr(ctx, K_VIBRATE);
        if (v == null) return DEFAULT_VIBRATE;
        return v.trim().equalsIgnoreCase("true");
    }

    public static int getSnoozeMinutes(Context ctx) {
        String v = getStr(ctx, K_SNOOZE_MINUTES);
        if (v == null) return DEFAULT_SNOOZE_MINUTES;
        try {
            int n = Integer.parseInt(v.trim());
            return (n > 0 && n <= 60) ? n : DEFAULT_SNOOZE_MINUTES;
        } catch (NumberFormatException e) {
            return DEFAULT_SNOOZE_MINUTES;
        }
    }

    public static boolean isCrescendoEnabled(Context ctx) {
        String v = getStr(ctx, K_CRESCENDO);
        if (v == null) return DEFAULT_CRESCENDO;
        return v.trim().equalsIgnoreCase("true");
    }
}