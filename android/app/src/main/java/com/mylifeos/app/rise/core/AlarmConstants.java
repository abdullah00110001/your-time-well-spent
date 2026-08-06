package com.mylifeos.app.rise.core;

/**
 * AlarmConstants — Rise System এর সব constant একজায়গায়।
 * Multiple files এ duplicate string ব্যবহার করলে bug হয়।
 * এখান থেকে import করো সবসময়।
 */
public final class AlarmConstants {

    private AlarmConstants() {} // instantiate করা যাবে না

    // ─────────────────────────────────────────────
    // SharedPreferences file names
    // ─────────────────────────────────────────────
    /** Rise alarm state (is ringing, snooze count etc.) */
    public static final String PREFS_RISE_STATE      = "RiseAlarmState";

    /** Capacitor Preferences file (JS <-> Java bridge) */
    public static final String PREFS_CAPACITOR        = "CapacitorStorage";

    // ─────────────────────────────────────────────
    // State keys — RiseAlarmState prefs
    // ─────────────────────────────────────────────
    public static final String KEY_IS_RINGING         = "rise_is_ringing";
    public static final String KEY_ACTIVE_UUID        = "rise_active_uuid";
    public static final String KEY_ACTIVE_ID          = "rise_active_id";
    public static final String KEY_MISSION_DONE       = "rise_mission_done";
    public static final String KEY_SNOOZE_COUNT       = "rise_snooze_count";
    public static final String KEY_SNOOZE_MAX         = "rise_snooze_max";
    public static final String KEY_TRIGGER_TIME       = "rise_trigger_time";
    public static final String KEY_ALARM_TITLE        = "rise_alarm_title";
    public static final String KEY_ALARM_BODY         = "rise_alarm_body";

    // ─────────────────────────────────────────────
    // Capacitor bridge keys — CapacitorStorage prefs
    // ─────────────────────────────────────────────
    /** Capacitor Preferences stores keys with "_cap_" prefix */
    public static final String KEY_CAP_RINGING_ID     = "_cap_ringing_alarm_id";
    public static final String KEY_RAW_RINGING_ID     = "ringing_alarm_id";
    public static final String KEY_CAP_RISE_ALARMS    = "_cap_rise_alarms";
    public static final String KEY_RAW_RISE_ALARMS    = "rise_alarms";

    // ─────────────────────────────────────────────
    // Notification channel IDs
    // ─────────────────────────────────────────────
    public static final String CHANNEL_ALARM_SOUND    = "rise_sound_service_v3";
    public static final String CHANNEL_ALARM_NOTIF    = "rise_alarm_notif_v3";

    // ─────────────────────────────────────────────
    // Notification IDs
    // ─────────────────────────────────────────────
    public static final int NOTIF_ID_SOUND_SERVICE    = 8888;
    public static final int NOTIF_ID_RECOVERY         = 8889;

    // ─────────────────────────────────────────────
    // Intent extras — alarm trigger payload
    // ─────────────────────────────────────────────
    public static final String EXTRA_ALARM_ID         = "ALARM_ID";
    public static final String EXTRA_ALARM_UUID       = "ALARM_UUID";
    public static final String EXTRA_ALARM_TITLE      = "ALARM_TITLE";
    public static final String EXTRA_ALARM_BODY       = "ALARM_BODY";

    // ─────────────────────────────────────────────
    // Timing
    // ─────────────────────────────────────────────
    /** Maximum alarm duration before auto-stop (30 minutes) */
    public static final long   MAX_ALARM_DURATION_MS  = 30 * 60 * 1000L;

    /** WakeLock timeout for BroadcastReceiver (30 seconds) */
    public static final long   RECEIVER_WAKELOCK_MS   = 30_000L;

    /** MediaPlayer recovery delay after error (2 seconds) */
    public static final long   MEDIA_RECOVERY_DELAY_MS = 2_000L;

    /** Recovery health-check interval (15 minutes) */
    public static final long   RECOVERY_INTERVAL_MS   = 15 * 60 * 1000L;

    // ─────────────────────────────────────────────
    // Deep link scheme
    // ─────────────────────────────────────────────
    public static final String DEEP_LINK_BASE         = "capacitor://localhost/rise/ring/";

    // ─────────────────────────────────────────────
    // WakeLock tags
    // ─────────────────────────────────────────────
    public static final String WAKELOCK_RECEIVER      = "RiseAlarm:ReceiverWL";
    public static final String WAKELOCK_SERVICE       = "RiseAlarm:ServiceWL";
}
