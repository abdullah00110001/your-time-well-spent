package com.mylifeos.app.shield;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

public class ShieldPreferences {
    private static final String PREF_NAME = "ShieldPrefs";
    private SharedPreferences prefs;

    public ShieldPreferences(Context context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    // ==========================================
    // 🛡️ Basic Shield Toggles
    // ==========================================
    public boolean isEnabled() {
        return prefs.getBoolean("is_enabled", false);
    }

    public void setEnabled(boolean enabled) {
        prefs.edit().putBoolean("is_enabled", enabled).apply();
    }

    public Set<String> getBlockedApps() {
        return prefs.getStringSet("blocked_apps", new HashSet<>());
    }

    public void setBlockedApps(Set<String> apps) {
        prefs.edit().putStringSet("blocked_apps", apps).apply();
    }

    public Set<String> getBlockedSites() {
        return prefs.getStringSet("blocked_sites", new HashSet<>());
    }

    public void setBlockedSites(Set<String> sites) {
        prefs.edit().putStringSet("blocked_sites", sites).apply();
    }

    // ==========================================
    // 🧠 Modes & Strict Mode
    // ==========================================
    public boolean isStrictMode() {
        return prefs.getBoolean("strict_mode", false);
    }

    public void setStrictMode(boolean strictMode) {
        prefs.edit().putBoolean("strict_mode", strictMode).apply();
    }

    public String getCurrentMode() {
        return prefs.getString("current_mode", "normal");
    }

    public void setCurrentMode(String mode) {
        prefs.edit().putString("current_mode", mode).apply();
    }

    // ==========================================
    // 🚫 Reels, Keywords & Filters
    // ==========================================
    public boolean isReelsBlockEnabled() {
        return prefs.getBoolean("block_reels", false);
    }

    public void setReelsBlockEnabled(boolean enabled) {
        prefs.edit().putBoolean("block_reels", enabled).apply();
    }

    public Set<String> getBlockedKeywords() {
        return prefs.getStringSet("blocked_keywords", new HashSet<>());
    }

    public void setBlockedKeywords(Set<String> keywords) {
        prefs.edit().putStringSet("blocked_keywords", keywords).apply();
    }

    // ==========================================
    // 🔞 Adult Filter
    // ✅ NEW: toggle support — default true (সবসময় on)
    // ==========================================
    public boolean isAdultFilterEnabled() {
        return prefs.getBoolean("adult_filter_enabled", true);
    }

    public void setAdultFilterEnabled(boolean enabled) {
        prefs.edit().putBoolean("adult_filter_enabled", enabled).apply();
    }

    // ==========================================
    // 🔑 Emergency Bypass Settings
    // ==========================================
    public String getEmergencyPin() {
        return prefs.getString("emergency_pin", "");
    }

    public void setEmergencyPin(String pin) {
        prefs.edit().putString("emergency_pin", pin).apply();
    }

    public boolean isBypassActive() {
        return prefs.getBoolean("is_bypass_active", false);
    }

    public void setBypassActive(boolean active) {
        prefs.edit().putBoolean("is_bypass_active", active).apply();
    }

    // ==========================================
    // 🔒 Hardcore Protection
    // ==========================================
    public boolean isBlockSplitScreenEnabled() {
        return prefs.getBoolean("block_split_screen", false);
    }

    public void setBlockSplitScreen(boolean enabled) {
        prefs.edit().putBoolean("block_split_screen", enabled).apply();
    }

    public boolean isBlockPowerOffEnabled() {
        return prefs.getBoolean("block_power_off", false);
    }

    public void setBlockPowerOff(boolean enabled) {
        prefs.edit().putBoolean("block_power_off", enabled).apply();
    }

    public boolean isBlockRecentAppsEnabled() {
        return prefs.getBoolean("block_recent_apps", false);
    }

    public void setBlockRecentApps(boolean enabled) {
        prefs.edit().putBoolean("block_recent_apps", enabled).apply();
    }

    public boolean isPreventUninstallEnabled() {
        return prefs.getBoolean("prevent_uninstall", false);
    }

    public void setPreventUninstall(boolean enabled) {
        prefs.edit().putBoolean("prevent_uninstall", enabled).apply();
    }

    // ==========================================
    // ⏱️ Time Limits & Stats
    // ==========================================
    public Map<String, Integer> getTimeLimits() {
        Map<String, Integer> map = new HashMap<>();
        String jsonString = prefs.getString("time_limits", "{}");
        try {
            JSONObject json = new JSONObject(jsonString);
            Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                map.put(key, json.getInt(key));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return map;
    }

    public void setTimeLimits(Map<String, Integer> limits) {
        try {
            JSONObject json = new JSONObject();
            for (Map.Entry<String, Integer> entry : limits.entrySet()) {
                json.put(entry.getKey(), entry.getValue());
            }
            prefs.edit().putString("time_limits", json.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ==========================================
    // 📊 Usage History (Daily Stats)
    // ==========================================
    public void saveDailyHistory(String date, long totalMinutes) {
        try {
            String historyJson = prefs.getString("usage_history", "{}");
            JSONObject history = new JSONObject(historyJson);
            history.put(date, totalMinutes);
            prefs.edit().putString("usage_history", history.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public String getFullHistory() {
        return prefs.getString("usage_history", "{}");
    }

    public long getTodayTotalMinutes() {
        return prefs.getLong("today_minutes", 0);
    }

    public void setTodayTotalMinutes(long minutes) {
        prefs.edit().putLong("today_minutes", minutes).apply();
    }

    // ==========================================
    // 🔔 Notification Settings
    // ==========================================
    public boolean isVibrationEnabled() { return prefs.getBoolean("vibrate_alerts", true); }
    public void setVibrationEnabled(boolean v) { prefs.edit().putBoolean("vibrate_alerts", v).apply(); }

    public boolean isSoundEnabled() { return prefs.getBoolean("sound_alerts", false); }
    public void setSoundEnabled(boolean s) { prefs.edit().putBoolean("sound_alerts", s).apply(); }

    public boolean isLowTimeAlertEnabled() { return prefs.getBoolean("low_time_alert", true); }
    public void setLowTimeAlert(boolean a) { prefs.edit().putBoolean("low_time_alert", a).apply(); }

    /**
     * Per-app daily limit in minutes (0 = unlimited).
     * NOTE: reads the SAME "time_limits" JSON that {@link #setTimeLimits(Map)} writes.
     * It previously read a "limit_<pkg>" int key that nothing ever wrote, so every
     * configured limit silently resolved to 0 (limits were dead).
     */
    public int getAppLimit(String pkg) {
        if (pkg == null) return 0;
        Integer v = getTimeLimits().get(pkg);
        return v == null ? 0 : v;
    }

    public void setAppLimit(String pkg, int minutes) {
        Map<String, Integer> limits = getTimeLimits();
        if (minutes <= 0) limits.remove(pkg);
        else limits.put(pkg, minutes);
        setTimeLimits(limits);
    }


    // ==========================================
    // 📅 Reset Dates
    // ==========================================
    public String getLastResetDate() {
        return prefs.getString("last_reset_date", "");
    }

    public void setLastResetDate(String date) {
        prefs.edit().putString("last_reset_date", date).apply();
    }

    public void updateLastResetDate(String date) {
        prefs.edit().putString("last_reset_date", date).apply();
    }

    // ==========================================
    // 📊 Block Attempts Counter
    // ==========================================
    public int getBlockedAttemptsToday() {
        return prefs.getInt("blocked_attempts_" + getLastResetDate(), 0);
    }

    public void incrementBlockedAttempts() {
        String today = getLastResetDate();
        int current = prefs.getInt("blocked_attempts_" + today, 0);
        prefs.edit().putInt("blocked_attempts_" + today, current + 1).apply();
    }

    // ==========================================
    // ⏱️ Floating Timer Settings
    // ==========================================
    public boolean isFloatingTimerEnabled() { return prefs.getBoolean("floating_timer", false); }
    public void setFloatingTimerEnabled(boolean v) { prefs.edit().putBoolean("floating_timer", v).apply(); }

    public int getFloatingTimerSize() { return prefs.getInt("timer_size", 16); }
    public void setFloatingTimerSize(int size) { prefs.edit().putInt("timer_size", size).apply(); }

    public float getFloatingTimerOpacity() { return prefs.getFloat("timer_opacity", 0.8f); }
    public void setFloatingTimerOpacity(float opacity) { prefs.edit().putFloat("timer_opacity", opacity).apply(); }

    public boolean isCountdownMode() { return prefs.getBoolean("countdown_mode", false); }
    public void setCountdownMode(boolean v) { prefs.edit().putBoolean("countdown_mode", v).apply(); }

    public int getTimerX() { return prefs.getInt("timer_x", 0); }
    public int getTimerY() { return prefs.getInt("timer_y", 100); }
    public void setTimerPosition(int x, int y) { prefs.edit().putInt("timer_x", x).putInt("timer_y", y).apply(); }
    // 🎨 Adult Filter — Block Screen Style
public String getAdultBlockScreenStyle() {
    return prefs.getString("adult_block_style", "focus");
}
public void setAdultBlockScreenStyle(String style) {
    prefs.edit().putString("adult_block_style", style).apply();
}

public String getAdultBlockCustomMessage() {
    return prefs.getString("adult_block_custom_msg", "");
}
public void setAdultBlockCustomMessage(String message) {
    prefs.edit().putString("adult_block_custom_msg", message).apply();
}

// 🗑️ Clear History
public void clearHistory() {
    prefs.edit().remove("usage_history").apply();
    prefs.edit().putLong("today_minutes", 0).apply();
}

// ==========================================
// 📱 Monitored Apps (keyword scan applies here)
// ==========================================
public Set<String> getMonitoredApps() {
    return prefs.getStringSet("monitored_apps", new HashSet<>());
}

public void setMonitoredApps(Set<String> apps) {
    prefs.edit().putStringSet("monitored_apps", apps).apply();
}

// ==========================================
// ✨ Light Orb Timer — style + real session state
// ==========================================
public boolean isOrbShowSeconds() { return prefs.getBoolean("orb_show_seconds", true); }
public void setOrbShowSeconds(boolean v) { prefs.edit().putBoolean("orb_show_seconds", v).apply(); }

public boolean isOrbPulseEnabled() { return prefs.getBoolean("orb_pulse", true); }
public void setOrbPulseEnabled(boolean v) { prefs.edit().putBoolean("orb_pulse", v).apply(); }

/** Orb diameter in dp (44–112). */
public int getOrbSize() { return prefs.getInt("orb_size", 64); }
public void setOrbSize(int dp) { prefs.edit().putInt("orb_size", dp).apply(); }

/**
 * The session is stored as a wall-clock end timestamp (not a counter), so the
 * remaining time survives process death, service restarts and doze.
 */
public boolean hasFocusSession() {
    return prefs.getLong("focus_end_ms", 0) > 0 || prefs.getLong("focus_paused_remaining_ms", 0) > 0;
}

public boolean isFocusSessionPaused() {
    return prefs.getBoolean("focus_paused", false);
}

public long getFocusRemainingMs() {
    if (isFocusSessionPaused()) return prefs.getLong("focus_paused_remaining_ms", 0);
    long end = prefs.getLong("focus_end_ms", 0);
    if (end <= 0) return 0;
    return Math.max(0, end - System.currentTimeMillis());
}

public void startFocusSession(int minutes) {
    prefs.edit()
        .putLong("focus_end_ms", System.currentTimeMillis() + minutes * 60_000L)
        .putBoolean("focus_paused", false)
        .putLong("focus_paused_remaining_ms", 0)
        .apply();
}

public void pauseFocusSession() {
    if (isFocusSessionPaused()) return;
    long remaining = getFocusRemainingMs();
    prefs.edit()
        .putBoolean("focus_paused", true)
        .putLong("focus_paused_remaining_ms", remaining)
        .putLong("focus_end_ms", 0)
        .apply();
}

public void resumeFocusSession() {
    if (!isFocusSessionPaused()) return;
    long remaining = prefs.getLong("focus_paused_remaining_ms", 0);
    prefs.edit()
        .putBoolean("focus_paused", false)
        .putLong("focus_paused_remaining_ms", 0)
        .putLong("focus_end_ms", System.currentTimeMillis() + remaining)
        .apply();
}

public void addFocusMinutes(int minutes) {
    if (isFocusSessionPaused()) {
        long r = prefs.getLong("focus_paused_remaining_ms", 0) + minutes * 60_000L;
        prefs.edit().putLong("focus_paused_remaining_ms", Math.max(0, r)).apply();
    } else {
        long end = prefs.getLong("focus_end_ms", System.currentTimeMillis());
        prefs.edit().putLong("focus_end_ms", end + minutes * 60_000L).apply();
    }
}

public void stopFocusSession() {
    prefs.edit()
        .putLong("focus_end_ms", 0)
        .putBoolean("focus_paused", false)
        .putLong("focus_paused_remaining_ms", 0)
        .apply();
}

// ==========================================
// 🔒 App Lock (protects Focus Shield itself)
// ==========================================
public boolean isAppLockEnabled() { return prefs.getBoolean("app_lock_enabled", false); }
public void setAppLockEnabled(boolean v) { prefs.edit().putBoolean("app_lock_enabled", v).apply(); }

public boolean isAppLockBiometricEnabled() { return prefs.getBoolean("app_lock_biometric", true); }
public void setAppLockBiometricEnabled(boolean v) { prefs.edit().putBoolean("app_lock_biometric", v).apply(); }

/** Stores only a salted hash — the raw PIN is never persisted. */
public void setAppLockPin(String pin) {
    prefs.edit().putString("app_lock_pin_hash", hashPin(pin)).apply();
}

public boolean hasAppLockPin() {
    String h = prefs.getString("app_lock_pin_hash", "");
    return h != null && !h.isEmpty();
}

public boolean verifyAppLockPin(String pin) {
    String stored = prefs.getString("app_lock_pin_hash", "");
    if (stored == null || stored.isEmpty()) return false;
    return stored.equals(hashPin(pin));
}

public void clearAppLockPin() {
    prefs.edit().remove("app_lock_pin_hash").apply();
}

private String hashPin(String pin) {
    try {
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        byte[] out = md.digest(("shield_v2$" + pin).getBytes("UTF-8"));
        StringBuilder sb = new StringBuilder();
        for (byte b : out) sb.append(String.format("%02x", b));
        return sb.toString();
    } catch (Exception e) {
        return "";
    }
}

// ==========================================
// 🌅 Day boundary + general notification prefs
// ==========================================
/** Hour (0–23) at which daily counters/limits reset. */
public int getStartOfDayHour() { return prefs.getInt("start_of_day_hour", 0); }
public void setStartOfDayHour(int hour) {
    prefs.edit().putInt("start_of_day_hour", Math.max(0, Math.min(23, hour))).apply();
}

public boolean isAutoResetDailyEnabled() { return prefs.getBoolean("auto_reset_daily", true); }
public void setAutoResetDailyEnabled(boolean v) { prefs.edit().putBoolean("auto_reset_daily", v).apply(); }
}

