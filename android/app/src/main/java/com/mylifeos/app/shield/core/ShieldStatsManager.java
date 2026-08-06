package com.mylifeos.app.shield.core;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.HashMap;
import java.util.Map;

public class ShieldStatsManager {
    private static final String PREF_STATS = "shield_stats";
    private static final String KEY_BLOCK_COUNT = "block_count_";
    private static final String KEY_TIME_SAVED = "time_saved_";
    
    private final SharedPreferences statsPrefs;

    public ShieldStatsManager(Context context) {
        statsPrefs = context.getSharedPreferences(PREF_STATS, Context.MODE_PRIVATE);
    }

    public void recordBlock(String packageName) {
        String key = KEY_BLOCK_COUNT + packageName;
        int count = statsPrefs.getInt(key, 0);
        statsPrefs.edit().putInt(key, count + 1).apply();
    }

    public void addTimeSaved(String packageName, int seconds) {
        String key = KEY_TIME_SAVED + packageName;
        int total = statsPrefs.getInt(key, 0);
        statsPrefs.edit().putInt(key, total + seconds).apply();
    }

    public int getBlockCount(String packageName) {
        return statsPrefs.getInt(KEY_BLOCK_COUNT + packageName, 0);
    }

    public int getTimeSaved(String packageName) {
        return statsPrefs.getInt(KEY_TIME_SAVED + packageName, 0);
    }

    public Map<String, Integer> getAllStats() {
        Map<String, Integer> stats = new HashMap<>();
        Map<String, ?> all = statsPrefs.getAll();
        for (Map.Entry<String, ?> entry : all.entrySet()) {
            if (entry.getValue() instanceof Integer) {
                stats.put(entry.getKey(), (Integer) entry.getValue());
            }
        }
        return stats;
    }

    public void resetStats() {
        statsPrefs.edit().clear().apply();
    }
}