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

    public void activateFocusMode() {
        Set<String> apps = new HashSet<>(shieldPrefs.getBlockedApps());
        
        // 🎯 ফোকাস মোডের জন্য ডেডলি ডিস্ট্রাকশন অ্যাপগুলো ব্লক লিস্টে ঢুকানো
        apps.add("com.facebook.katana"); // Facebook
        apps.add("com.instagram.android"); // Instagram
        apps.add("com.zhiliaoapp.musically"); // TikTok
        apps.add("com.google.android.youtube"); // YouTube
        
        shieldPrefs.setBlockedApps(apps);
        shieldPrefs.setEnabled(true);
        setMode("focus");
    }

    public void activateSleepMode() {
        activateFocusMode(); // ফোকাস মোডের অ্যাপগুলোও থাকবে
        
        Set<String> apps = new HashSet<>(shieldPrefs.getBlockedApps());
        // 🌙 স্লিপ মোডের জন্য এক্সট্রা লেট-নাইট অ্যাপ ব্লক
        apps.add("com.twitter.android"); // X / Twitter
        apps.add("com.reddit.frontpage"); // Reddit
        apps.add("com.netflix.mediaclient"); // Netflix
        
        shieldPrefs.setBlockedApps(apps);
        shieldPrefs.setEnabled(true);
        setMode("sleep");
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
        
        // নরমাল মোডে ফিরে গেলে সব ব্লকড অ্যাপ ক্লিয়ার করে দেওয়া (অথবা ইউজার চাইলে ম্যানুয়ালি করতে পারে)
        shieldPrefs.setBlockedApps(new HashSet<>()); 
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

