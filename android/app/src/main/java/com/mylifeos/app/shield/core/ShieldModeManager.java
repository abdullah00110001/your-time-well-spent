package com.mylifeos.app.shield.core;

import android.content.Context;
import android.content.SharedPreferences;
import com.mylifeos.app.shield.ShieldPreferences;
import java.util.HashSet;
import java.util.Set;

public class ShieldModeManager {
    private static final String PREF_NAME = "ShieldModePrefs";
    private SharedPreferences prefs;
    private ShieldPreferences shieldPrefs;

    public ShieldModeManager(Context context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        shieldPrefs = new ShieldPreferences(context);
    }

    /** Packages a mode added on top of the user's own choices. */
    private static final String KEY_MODE_ADDED = "mode_added_apps";

    private static final String[] FOCUS_APPS = new String[]{
        "com.facebook.katana",      // Facebook
        "com.instagram.android",    // Instagram
        "com.zhiliaoapp.musically", // TikTok
        "com.google.android.youtube" // YouTube
    };

    private static final String[] SLEEP_EXTRA_APPS = new String[]{
        "com.twitter.android",       // X / Twitter
        "com.reddit.frontpage",      // Reddit
        "com.netflix.mediaclient"    // Netflix
    };

    public void activateFocusMode() {
        addModeApps(FOCUS_APPS);
        shieldPrefs.setEnabled(true);
        setMode("focus");
    }

    public void activateSleepMode() {
        addModeApps(FOCUS_APPS);       // ফোকাস মোডের অ্যাপগুলোও থাকবে
        addModeApps(SLEEP_EXTRA_APPS); // 🌙 এক্সট্রা লেট-নাইট অ্যাপ
        shieldPrefs.setEnabled(true);
        setMode("sleep");
    }

    /**
     * Adds mode packages to the block list AND remembers which ones the mode
     * itself contributed, so deactivating a mode can undo exactly its own
     * additions instead of nuking the user's hand-picked list.
     */
    private void addModeApps(String[] packages) {
        Set<String> blocked = new HashSet<>(shieldPrefs.getBlockedApps());
        Set<String> modeAdded = new HashSet<>(readModeAdded());
        for (String pkg : packages) {
            // Only track it as "mode added" when the user had not blocked it
            // themselves — otherwise deactivating the mode would silently
            // unblock an app the user chose to block.
            if (blocked.add(pkg)) modeAdded.add(pkg);
        }
        shieldPrefs.setBlockedApps(blocked);
        writeModeAdded(modeAdded);
    }

    private Set<String> readModeAdded() {
        Set<String> stored = prefs.getStringSet(KEY_MODE_ADDED, null);
        return stored == null ? new HashSet<>() : new HashSet<>(stored);
    }

    private void writeModeAdded(Set<String> values) {
        prefs.edit().remove(KEY_MODE_ADDED).apply();
        prefs.edit().putStringSet(KEY_MODE_ADDED, new HashSet<>(values)).apply();
    }

    public void activateStrictMode() {
        prefs.edit()
             .putBoolean("strict_mode", true)
             // "Irreversible until tomorrow" — store the local midnight boundary
             // so strict mode expires by itself instead of locking forever.
             .putLong("strict_until", nextLocalMidnightMillis())
             .apply();
        shieldPrefs.setEnabled(true);
        setMode("strict");
    }

    public void deactivateMode() {
        // 🔒 স্ট্রিক্ট মোড চেকিং
        if (isStrictMode()) {
            // স্ট্রিক্ট মোড অন থাকলে কোনোভাবেই মোড ডিঅ্যাক্টিভেট করা যাবে না!
            return; 
        }
        
        // FIX: this used to wipe the ENTIRE block list, so every mode switch
        // silently deleted the apps the user had picked in Block Apps — which
        // looked exactly like "blocking stopped working". Now only the packages
        // the mode itself added are removed; user choices survive.
        Set<String> blocked = new HashSet<>(shieldPrefs.getBlockedApps());
        blocked.removeAll(readModeAdded());
        shieldPrefs.setBlockedApps(blocked);
        writeModeAdded(new HashSet<>());
        prefs.edit().putBoolean("strict_mode", false).remove("strict_until").apply();
        setMode("normal");
    }

    // ==========================================
    // ⚙️ হেল্পার মেথডস
    // ==========================================

    private void setMode(String mode) {
        prefs.edit().putString("current_mode", mode).apply();
    }

    public String getCurrentMode() {
        if (isStrictMode()) return "strict";
        return prefs.getString("current_mode", "normal");
    }

    public boolean isStrictMode() {
        if (!prefs.getBoolean("strict_mode", false)) return false;
        long until = prefs.getLong("strict_until", 0L);
        if (until > 0L && System.currentTimeMillis() >= until) {
            // Expired — clear it so the UI and disable() stop being blocked.
            prefs.edit().putBoolean("strict_mode", false).remove("strict_until").apply();
            return false;
        }
        return true;
    }

    private long nextLocalMidnightMillis() {
        java.util.Calendar c = java.util.Calendar.getInstance();
        c.add(java.util.Calendar.DAY_OF_YEAR, 1);
        c.set(java.util.Calendar.HOUR_OF_DAY, 0);
        c.set(java.util.Calendar.MINUTE, 0);
        c.set(java.util.Calendar.SECOND, 0);
        c.set(java.util.Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }
}

