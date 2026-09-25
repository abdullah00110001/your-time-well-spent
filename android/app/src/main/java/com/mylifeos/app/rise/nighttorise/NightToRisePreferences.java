package com.mylifeos.app.rise.nighttorise;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Persists the Sleep-to-Rise state that the native side needs, derived from
 * the JSON `NightToRiseConfig` pushed from JS via NightToRisePlugin#setConfig.
 *
 * IMPORTANT: JSON is parsed exactly once, inside applyConfigJson(), and the
 * result is stored as plain SharedPreferences primitives/sets. The
 * AccessibilityService reads these primitives on every foreground-app
 * change, so it must never re-parse JSON on that hot path.
 *
 * Field names below mirror src/components/rise/night-to-rise/types.ts
 * (NightToRiseConfig) as closely as Android SharedPreferences allows.
 */
public final class NightToRisePreferences {

    private static final String PREFS_NAME = "night_to_rise_prefs";

    // --- mirrors of NightToRiseConfig ---
    private static final String KEY_ENABLED = "n2r_enabled";
    private static final String KEY_CONFIGURED = "n2r_configured";
    private static final String KEY_SLEEP_TIME_MINUTES = "n2r_sleep_time_minutes";
    private static final String KEY_SLEEP_LOCK_BEFORE = "n2r_sleep_lock_before";
    private static final String KEY_RISE_LOCK_AFTER = "n2r_rise_lock_after";
    private static final String KEY_BLOCKLIST_MODE = "n2r_blocklist_mode"; // "blocklist" | "allowlist"
    private static final String KEY_BLOCKED_APPS = "n2r_blocked_apps";
    private static final String KEY_ALLOWED_APPS = "n2r_allowed_apps";
    private static final String KEY_SCHEDULE_MODE = "n2r_schedule_mode"; // everyday|weekdays|custom
    private static final String KEY_SCHEDULE_DAYS = "n2r_schedule_days"; // set of "0".."6"
    private static final String KEY_STRICT_MODE = "n2r_strict_mode";
    private static final String KEY_PAUSED_UNTIL_EPOCH = "n2r_paused_until_epoch";
    private static final String KEY_SLEEP_BLOCK_MESSAGE = "n2r_sleep_block_message";
    private static final String KEY_RISE_BLOCK_MESSAGE = "n2r_rise_block_message";
    private static final String KEY_SHOW_STREAK_ON_BLOCK = "n2r_show_streak_on_block";

    // --- pushed separately via setRiseAlarm ---
    private static final String KEY_RISE_ALARM_EPOCH = "n2r_rise_alarm_epoch";

    // --- native-only runtime state ---
    private static final String KEY_RISE_GUARD_ACTIVE_UNTIL_EPOCH = "n2r_rise_guard_active_until";
    private static final String KEY_OVERRIDDEN_FOR_WINDOW = "n2r_overridden_for_window";
    private static final String KEY_STRICT_UNLOCK_REQUESTED_AT = "n2r_strict_unlock_requested_at";
    private static final String KEY_PENDING_BREAK = "n2r_pending_break";

    /** Mirrors ALWAYS_ALLOWED_IDS in types.ts — never blocked, in either mode. */
    public static final Set<String> ALWAYS_ALLOWED_IDS = new HashSet<>(Arrays.asList(
            "com.android.phone",
            "com.android.dialer",
            "com.google.android.dialer",
            "com.android.server.telecom",
            "com.android.emergency",
            "com.android.deskclock",
            "com.google.android.deskclock"
    ));

    public static final long STRICT_UNLOCK_DELAY_MS = 10 * 60 * 1000L;

    private final SharedPreferences prefs;

    public NightToRisePreferences(Context context) {
        this.prefs = context.getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /**
     * Parses the full NightToRiseConfig JSON (as sent by nightToRiseBridge.setConfig)
     * and stores the derived fields. Called once per JS-side config push, never on
     * the accessibility hot path.
     */
    public void applyConfigJson(String json) throws JSONException {
        JSONObject obj = new JSONObject(json);

        SharedPreferences.Editor editor = prefs.edit();

        editor.putBoolean(KEY_ENABLED, obj.optBoolean("enabled", false));
        editor.putBoolean(KEY_CONFIGURED, obj.optBoolean("configured", false));

        int sleepMinutes = parseHHMM(obj.optString("sleepTime", "22:30"));
        editor.putInt(KEY_SLEEP_TIME_MINUTES, sleepMinutes);
        editor.putInt(KEY_SLEEP_LOCK_BEFORE, obj.optInt("sleepLockMinutesBefore", 30));
        editor.putInt(KEY_RISE_LOCK_AFTER, obj.optInt("riseLockMinutesAfter", 30));

        editor.putString(KEY_BLOCKLIST_MODE, obj.optString("blocklistMode", "blocklist"));
        editor.putStringSet(KEY_BLOCKED_APPS, extractIds(obj.optJSONArray("blockedApps")));
        editor.putStringSet(KEY_ALLOWED_APPS, extractIds(obj.optJSONArray("allowedApps")));

        editor.putString(KEY_SCHEDULE_MODE, obj.optString("scheduleMode", "everyday"));
        editor.putStringSet(KEY_SCHEDULE_DAYS, extractInts(obj.optJSONArray("scheduleDays")));

        editor.putBoolean(KEY_STRICT_MODE, obj.optBoolean("strictMode", false));

        String pausedUntilIso = obj.isNull("pausedUntil") ? null : obj.optString("pausedUntil", null);
        editor.putLong(KEY_PAUSED_UNTIL_EPOCH, parseIsoToEpoch(pausedUntilIso));

        editor.putString(KEY_SLEEP_BLOCK_MESSAGE,
                obj.optString("sleepBlockMessage", "Time to rest. Put the phone down."));
        editor.putString(KEY_RISE_BLOCK_MESSAGE,
                obj.optString("riseBlockMessage", "Start your morning right. No scrolling yet."));
        editor.putBoolean(KEY_SHOW_STREAK_ON_BLOCK, obj.optBoolean("showStreakOnBlock", true));

        editor.apply();
    }

    private static Set<String> extractIds(JSONArray apps) {
        Set<String> out = new HashSet<>();
        if (apps == null) return out;
        for (int i = 0; i < apps.length(); i++) {
            JSONObject app = apps.optJSONObject(i);
            if (app != null) {
                String id = app.optString("id", null);
                if (id != null) out.add(id);
            }
        }
        return out;
    }

    private static Set<String> extractInts(JSONArray arr) {
        Set<String> out = new HashSet<>();
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            out.add(String.valueOf(arr.optInt(i, -1)));
        }
        return out;
    }

    /** "HH:MM" -> minutes since midnight. Defaults to 0 on malformed input. */
    public static int parseHHMM(String hhmm) {
        if (hhmm == null) return 0;
        String[] parts = hhmm.split(":");
        if (parts.length != 2) return 0;
        try {
            int h = Integer.parseInt(parts[0].trim());
            int m = Integer.parseInt(parts[1].trim());
            return h * 60 + m;
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * Parses a JS `Date#toISOString()` value (e.g. "2026-09-25T18:30:00.000Z"),
     * which is exactly what NightToRiseConfig.pausedUntil is set from
     * (see useNightToRise.ts#pauseTonight). Requires minSdk 26 for
     * java.time; this project already targets a modern minSdk elsewhere
     * (Capacitor/AndroidX baseline), so no desugaring fallback is included
     * here — add one if your minSdk is below 26.
     */
    private static long parseIsoToEpoch(String iso) {
        if (iso == null || iso.isEmpty()) return 0L;
        try {
            return java.time.Instant.parse(iso).toEpochMilli();
        } catch (Exception e) {
            return 0L;
        }
    }

    // ---- getters used by NightToRiseDecider / NightToRiseBlockActivity ----

    public boolean isEnabled() {
        return prefs.getBoolean(KEY_ENABLED, false);
    }

    public boolean isConfigured() {
        return prefs.getBoolean(KEY_CONFIGURED, false);
    }

    public int getSleepTimeMinutes() {
        return prefs.getInt(KEY_SLEEP_TIME_MINUTES, 22 * 60 + 30);
    }

    public int getSleepLockMinutesBefore() {
        return prefs.getInt(KEY_SLEEP_LOCK_BEFORE, 30);
    }

    public int getRiseLockMinutesAfter() {
        return prefs.getInt(KEY_RISE_LOCK_AFTER, 30);
    }

    public String getBlocklistMode() {
        return prefs.getString(KEY_BLOCKLIST_MODE, "blocklist");
    }

    public Set<String> getBlockedApps() {
        return new HashSet<>(prefs.getStringSet(KEY_BLOCKED_APPS, new HashSet<>()));
    }

    public Set<String> getAllowedApps() {
        return new HashSet<>(prefs.getStringSet(KEY_ALLOWED_APPS, new HashSet<>()));
    }

    public String getScheduleMode() {
        return prefs.getString(KEY_SCHEDULE_MODE, "everyday");
    }

    public Set<String> getScheduleDays() {
        return new HashSet<>(prefs.getStringSet(KEY_SCHEDULE_DAYS,
                new HashSet<>(Arrays.asList("0", "1", "2", "3", "4", "5", "6"))));
    }

    public boolean isStrictMode() {
        return prefs.getBoolean(KEY_STRICT_MODE, false);
    }

    public long getPausedUntilEpoch() {
        return prefs.getLong(KEY_PAUSED_UNTIL_EPOCH, 0L);
    }

    public String getSleepBlockMessage() {
        return prefs.getString(KEY_SLEEP_BLOCK_MESSAGE, "Time to rest. Put the phone down.");
    }

    public String getRiseBlockMessage() {
        return prefs.getString(KEY_RISE_BLOCK_MESSAGE, "Start your morning right. No scrolling yet.");
    }

    public boolean isShowStreakOnBlock() {
        return prefs.getBoolean(KEY_SHOW_STREAK_ON_BLOCK, true);
    }

    public long getRiseAlarmEpochMillis() {
        return prefs.getLong(KEY_RISE_ALARM_EPOCH, 0L);
    }

    public void setRiseAlarmEpochMillis(long epochMillis) {
        prefs.edit().putLong(KEY_RISE_ALARM_EPOCH, epochMillis).apply();
    }

    /**
     * Set by NightToRiseManager#onAlarmDismissed when the rise alarm is
     * actually turned off — this is what starts Rise Guard, independent of
     * clock time (a snooze delays it, an early dismiss starts it early).
     */
    public long getRiseGuardActiveUntilEpoch() {
        return prefs.getLong(KEY_RISE_GUARD_ACTIVE_UNTIL_EPOCH, 0L);
    }

    public void setRiseGuardActiveUntilEpoch(long epochMillis) {
        prefs.edit().putLong(KEY_RISE_GUARD_ACTIVE_UNTIL_EPOCH, epochMillis).apply();
    }

    public boolean isOverriddenForWindow() {
        return prefs.getBoolean(KEY_OVERRIDDEN_FOR_WINDOW, false);
    }

    public void setOverriddenForWindow(boolean overridden) {
        prefs.edit().putBoolean(KEY_OVERRIDDEN_FOR_WINDOW, overridden).apply();
    }

    public long getStrictUnlockRequestedAtEpoch() {
        return prefs.getLong(KEY_STRICT_UNLOCK_REQUESTED_AT, 0L);
    }

    public void setStrictUnlockRequestedAtEpoch(long epochMillis) {
        prefs.edit().putLong(KEY_STRICT_UNLOCK_REQUESTED_AT, epochMillis).apply();
    }

    public boolean isPendingBreak() {
        return prefs.getBoolean(KEY_PENDING_BREAK, false);
    }

    public void setPendingBreak(boolean pending) {
        prefs.edit().putBoolean(KEY_PENDING_BREAK, pending).apply();
    }

    /** Consumes (reads + clears) the pending-break flag atomically enough for our needs. */
    public boolean consumePendingBreak() {
        boolean value = isPendingBreak();
        if (value) {
            setPendingBreak(false);
        }
        return value;
    }
}

