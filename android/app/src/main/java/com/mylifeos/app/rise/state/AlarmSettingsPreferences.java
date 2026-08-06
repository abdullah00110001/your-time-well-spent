package com.mylifeos.app.rise.state;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * AlarmSettingsPreferences
 * ------------------------
 * Typed accessor for the user-controlled "Dismiss & Mission" + speaker /
 * notification toggles exposed in the Rise → Settings screen.
 *
 * The React layer writes these via Capacitor's `Preferences` plugin, which on
 * Android persists into the {@code CapacitorStorage} SharedPreferences file.
 * Reading from the same file here keeps the JS UI and the native alarm
 * pipeline (Receiver / Scheduler / RingActivity) in lock-step without a
 * dedicated bridge plugin.
 *
 * Key namespace: {@code alarm.<setting>}  — values stored as strings to match
 * the Capacitor Preferences contract (booleans are "true"/"false").
 */
public final class AlarmSettingsPreferences {

    private static final String PREFS_NAME = "CapacitorStorage";

    // Keys — keep in sync with src/components/rise/RiseSettings.tsx
    public static final String KEY_USE_BUILT_IN_SPEAKER       = "alarm.useBuiltInSpeaker";
    public static final String KEY_SHOW_NEXT_ALARM_NOTIF      = "alarm.showNextAlarmNotification";
    public static final String KEY_PREVENT_LAST_MINUTE_EDITS  = "alarm.preventLastMinuteEdits";
    public static final String KEY_PREVENT_UNINSTALL          = "alarm.preventUninstall";
    public static final String KEY_AUTO_DISMISS_MINUTES       = "alarm.autoDismissMinutes"; // 0 = off
    public static final String KEY_MUTE_DURING_MISSION        = "alarm.muteDuringMission";
    public static final String KEY_MUTE_LIMIT                 = "alarm.muteLimit";           // int

    // Sensible defaults that mirror the React-side initial state
    public static final boolean DEFAULT_USE_BUILT_IN_SPEAKER      = true;
    public static final boolean DEFAULT_SHOW_NEXT_ALARM_NOTIF     = false;
    public static final boolean DEFAULT_PREVENT_LAST_MINUTE_EDITS = false;
    public static final boolean DEFAULT_PREVENT_UNINSTALL         = false;
    public static final int     DEFAULT_AUTO_DISMISS_MINUTES      = 0;
    public static final boolean DEFAULT_MUTE_DURING_MISSION       = true;
    public static final int     DEFAULT_MUTE_LIMIT                = 3;

    private final SharedPreferences prefs;

    public AlarmSettingsPreferences(Context context) {
        this.prefs = context.getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // ---- boolean helpers (Capacitor stores them as "true" / "false" strings) ----

    private boolean readBool(String key, boolean fallback) {
        String raw = prefs.getString(key, null);
        if (raw == null) return fallback;
        return "true".equalsIgnoreCase(raw.trim());
    }

    private int readInt(String key, int fallback) {
        String raw = prefs.getString(key, null);
        if (raw == null || raw.isEmpty()) return fallback;
        try { return Integer.parseInt(raw.trim()); }
        catch (NumberFormatException ignored) { return fallback; }
    }

    private void writeString(String key, String value) {
        prefs.edit().putString(key, value).apply();
    }

    // ---- Speaker / notification toggles ----

    public boolean useBuiltInSpeaker()        { return readBool(KEY_USE_BUILT_IN_SPEAKER, DEFAULT_USE_BUILT_IN_SPEAKER); }
    public boolean showNextAlarmNotification() { return readBool(KEY_SHOW_NEXT_ALARM_NOTIF, DEFAULT_SHOW_NEXT_ALARM_NOTIF); }
    public boolean preventLastMinuteEdits()    { return readBool(KEY_PREVENT_LAST_MINUTE_EDITS, DEFAULT_PREVENT_LAST_MINUTE_EDITS); }
    public boolean preventUninstallDuringAlarm() { return readBool(KEY_PREVENT_UNINSTALL, DEFAULT_PREVENT_UNINSTALL); }

    // ---- Dismiss & mission ----

    /** @return minutes after which the alarm auto-dismisses; 0 means never. */
    public int autoDismissMinutes() { return Math.max(0, readInt(KEY_AUTO_DISMISS_MINUTES, DEFAULT_AUTO_DISMISS_MINUTES)); }
    public boolean muteDuringMission() { return readBool(KEY_MUTE_DURING_MISSION, DEFAULT_MUTE_DURING_MISSION); }
    /** @return number of times the user can mute before it is ignored. */
    public int muteLimit() { return Math.max(0, readInt(KEY_MUTE_LIMIT, DEFAULT_MUTE_LIMIT)); }

    // ---- Writers (used by Java-side flows that need to update defaults) ----

    public void setUseBuiltInSpeaker(boolean v)        { writeString(KEY_USE_BUILT_IN_SPEAKER, String.valueOf(v)); }
    public void setShowNextAlarmNotification(boolean v) { writeString(KEY_SHOW_NEXT_ALARM_NOTIF, String.valueOf(v)); }
    public void setPreventLastMinuteEdits(boolean v)    { writeString(KEY_PREVENT_LAST_MINUTE_EDITS, String.valueOf(v)); }
    public void setPreventUninstallDuringAlarm(boolean v) { writeString(KEY_PREVENT_UNINSTALL, String.valueOf(v)); }
    public void setAutoDismissMinutes(int minutes)       { writeString(KEY_AUTO_DISMISS_MINUTES, String.valueOf(Math.max(0, minutes))); }
    public void setMuteDuringMission(boolean v)          { writeString(KEY_MUTE_DURING_MISSION, String.valueOf(v)); }
    public void setMuteLimit(int n)                      { writeString(KEY_MUTE_LIMIT, String.valueOf(Math.max(0, n))); }

    // ---- Convenience: shared snapshot for native alarm trigger ----

    public Snapshot snapshot() {
        return new Snapshot(
                useBuiltInSpeaker(),
                showNextAlarmNotification(),
                preventLastMinuteEdits(),
                preventUninstallDuringAlarm(),
                autoDismissMinutes(),
                muteDuringMission(),
                muteLimit()
        );
    }

    public static final class Snapshot {
        public final boolean useBuiltInSpeaker;
        public final boolean showNextAlarmNotification;
        public final boolean preventLastMinuteEdits;
        public final boolean preventUninstallDuringAlarm;
        public final int     autoDismissMinutes;
        public final boolean muteDuringMission;
        public final int     muteLimit;

        Snapshot(boolean a, boolean b, boolean c, boolean d, int e, boolean f, int g) {
            this.useBuiltInSpeaker = a;
            this.showNextAlarmNotification = b;
            this.preventLastMinuteEdits = c;
            this.preventUninstallDuringAlarm = d;
            this.autoDismissMinutes = e;
            this.muteDuringMission = f;
            this.muteLimit = g;
        }
    }
}
