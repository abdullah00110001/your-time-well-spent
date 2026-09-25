package com.mylifeos.app.rise.state;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.mylifeos.app.rise.core.AlarmConstants;

/**
 * AlarmStateManager — Rise System এর persistent global state manager।
 *
 * কেন দরকার?
 * ─────────────────────────────────────────────────────────────────
 * Android এ static variables process death এ মরে যায়।
 * Activity, Service, BroadcastReceiver সবার আলাদা lifecycle।
 * SharedPreferences disk এ থাকে — app kill / reboot সব survive করে।
 *
 * এই class সব Android components এর single source of truth।
 * JS side ও Capacitor bridge দিয়ে এটা পড়তে পারে।
 * ─────────────────────────────────────────────────────────────────
 *
 * State fields:
 *   is_ringing       → alarm বাজছে কিনা
 *   active_uuid      → কোন alarm UUID
 *   active_id        → numeric alarm id
 *   mission_done     → mission complete হয়েছে কিনা
 *   snooze_count     → কতবার snooze হয়েছে
 *   snooze_max       → maximum allowed snooze
 *   trigger_time     → alarm কখন trigger হয়েছিল (epoch ms)
 *   alarm_title      → notification title
 *   alarm_body       → notification body
 */
public class AlarmStateManager {

    private static final String TAG = "AlarmStateManager";

    // ──────────────────────────────────────────────────
    // WRITE: Alarm trigger হলে call করো
    // ──────────────────────────────────────────────────

    /**
     * Alarm trigger হওয়ার সাথে সাথে call করো।
     * সব state persist করে — দুটো SharedPrefs এ লেখে:
     *   1. RiseAlarmState   → native layer reads
     *   2. CapacitorStorage → JS bridge reads
     */
    public static void setRinging(Context ctx, int id, String uuid,
                                   String title, String body, int snoozeMax) {
        // Native state
        statePrefs(ctx).edit()
            .putBoolean(AlarmConstants.KEY_IS_RINGING,   true)
            .putString(AlarmConstants.KEY_ACTIVE_UUID,   uuid)
            .putInt(AlarmConstants.KEY_ACTIVE_ID,        id)
            .putBoolean(AlarmConstants.KEY_MISSION_DONE, false)
            .putInt(AlarmConstants.KEY_SNOOZE_COUNT,     0)
            .putInt(AlarmConstants.KEY_SNOOZE_MAX,       snoozeMax)
            .putLong(AlarmConstants.KEY_TRIGGER_TIME,    System.currentTimeMillis())
            .putString(AlarmConstants.KEY_ALARM_TITLE,   title != null ? title : "Rise Alarm")
            .putString(AlarmConstants.KEY_ALARM_BODY,    body  != null ? body  : "Wake up!")
            .apply();

        // JS bridge state (Capacitor Preferences format)
        capacitorPrefs(ctx).edit()
            .putString(AlarmConstants.KEY_CAP_RINGING_ID, uuid)
            .putString(AlarmConstants.KEY_RAW_RINGING_ID, uuid)
            .apply();

        Log.d(TAG, "✅ State: RINGING — id=" + id + " uuid=" + uuid);
    }

    /**
     * Mission complete বা manual stop হলে call করো।
     * সব ringing state clear করে।
     */
    public static void clearRinging(Context ctx) {
        statePrefs(ctx).edit()
            .putBoolean(AlarmConstants.KEY_IS_RINGING,   false)
            .putBoolean(AlarmConstants.KEY_MISSION_DONE, true)
            .remove(AlarmConstants.KEY_ACTIVE_UUID)
            .remove(AlarmConstants.KEY_ACTIVE_ID)
            .apply();

        capacitorPrefs(ctx).edit()
            .remove(AlarmConstants.KEY_CAP_RINGING_ID)
            .remove(AlarmConstants.KEY_RAW_RINGING_ID)
            .apply();

        Log.d(TAG, "🔕 State: CLEARED");
    }

    /**
     * Snooze হলে call করো।
     * Count increment করে, ringing false করে (পরের alarm আবার true করবে)।
     */
    public static void onSnooze(Context ctx) {
        int current = getSnoozeCount(ctx);
        statePrefs(ctx).edit()
            .putInt(AlarmConstants.KEY_SNOOZE_COUNT, current + 1)
            .putBoolean(AlarmConstants.KEY_IS_RINGING, false)
            .apply();

        capacitorPrefs(ctx).edit()
            .remove(AlarmConstants.KEY_CAP_RINGING_ID)
            .remove(AlarmConstants.KEY_RAW_RINGING_ID)
            .apply();

        Log.d(TAG, "😴 Snooze count: " + (current + 1) + "/" + getSnoozeMax(ctx));
    }

    // ──────────────────────────────────────────────────
    // READ
    // ──────────────────────────────────────────────────

    public static boolean isRinging(Context ctx) {
        return statePrefs(ctx).getBoolean(AlarmConstants.KEY_IS_RINGING, false);
    }

    public static String getActiveUuid(Context ctx) {
        String uuid = statePrefs(ctx).getString(AlarmConstants.KEY_ACTIVE_UUID, null);
        // Fallback: capacitor prefs
        if (uuid == null) {
            uuid = capacitorPrefs(ctx).getString(AlarmConstants.KEY_CAP_RINGING_ID, null);
        }
        if (uuid == null) {
            uuid = capacitorPrefs(ctx).getString(AlarmConstants.KEY_RAW_RINGING_ID, null);
        }
        return uuid;
    }

    public static int getActiveId(Context ctx) {
        return statePrefs(ctx).getInt(AlarmConstants.KEY_ACTIVE_ID, -1);
    }

    public static boolean isMissionDone(Context ctx) {
        return statePrefs(ctx).getBoolean(AlarmConstants.KEY_MISSION_DONE, false);
    }

    public static int getSnoozeCount(Context ctx) {
        return statePrefs(ctx).getInt(AlarmConstants.KEY_SNOOZE_COUNT, 0);
    }

    public static int getSnoozeMax(Context ctx) {
        return statePrefs(ctx).getInt(AlarmConstants.KEY_SNOOZE_MAX, 3);
    }

    public static long getTriggerTime(Context ctx) {
        return statePrefs(ctx).getLong(AlarmConstants.KEY_TRIGGER_TIME, 0);
    }

    public static String getAlarmTitle(Context ctx) {
        return statePrefs(ctx).getString(AlarmConstants.KEY_ALARM_TITLE, "Rise Alarm");
    }

    public static String getAlarmBody(Context ctx) {
        return statePrefs(ctx).getString(AlarmConstants.KEY_ALARM_BODY, "Wake up!");
    }

    /** Alarm কতক্ষণ ধরে বাজছে (minutes) */
    public static long getRingingDurationMinutes(Context ctx) {
        long trigger = getTriggerTime(ctx);
        if (trigger == 0) return 0;
        return (System.currentTimeMillis() - trigger) / 60_000L;
    }

    /** আরো snooze করা যাবে কিনা */
    public static boolean canSnooze(Context ctx) {
        return getSnoozeCount(ctx) < getSnoozeMax(ctx);
    }

    /**
     * Recovery check — alarm ringing state এ আছে কিন্তু
     * MAX duration পার হয়ে গেছে → auto-clear করো।
     */
    public static boolean shouldAutoStop(Context ctx) {
        if (!isRinging(ctx)) return false;
        long durationMin = getRingingDurationMinutes(ctx);
        boolean expired = durationMin >= 30;
        if (expired) Log.w(TAG, "⚠️ Alarm ringing for " + durationMin + " min — auto-stop triggered");
        return expired;
    }

    // ──────────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────────

    private static SharedPreferences statePrefs(Context ctx) {
        return ctx.getSharedPreferences(AlarmConstants.PREFS_RISE_STATE, Context.MODE_PRIVATE);
    }

    private static SharedPreferences capacitorPrefs(Context ctx) {
        return ctx.getSharedPreferences(AlarmConstants.PREFS_CAPACITOR, Context.MODE_PRIVATE);
    }
}
