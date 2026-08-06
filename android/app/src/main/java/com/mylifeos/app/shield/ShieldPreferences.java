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

    public int getAppLimit(String pkg) { return prefs.getInt("limit_" + pkg, 0); }

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
}
