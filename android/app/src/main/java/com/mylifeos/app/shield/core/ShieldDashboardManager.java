package com.mylifeos.app.shield.core;

import android.content.Context;
import com.mylifeos.app.shield.ShieldPreferences;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ShieldDashboardManager {
    private final ShieldPreferences preferences;
    private final Context context;

    public ShieldDashboardManager(Context context) {
        this.context = context;
        this.preferences = new ShieldPreferences(context);
    }

    public Map<String, Object> getDashboardData() {
        Map<String, Object> data = new HashMap<>();
        
        data.put("isEnabled", preferences.isEnabled());
        data.put("currentMode", preferences.getCurrentMode());
        data.put("isStrictMode", preferences.isStrictMode());
        data.put("blockedAppsCount", preferences.getBlockedApps().size());
        data.put("timeLimitsCount", preferences.getTimeLimits().size());
        
        return data;
    }

    public List<Map<String, Object>> getBlockedAppsList() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (String pkg : preferences.getBlockedApps()) {
            Map<String, Object> app = new HashMap<>();
            app.put("packageName", pkg);
            app.put("appName", getAppName(pkg));
            list.add(app);
        }
        return list;
    }

    public Map<String, Integer> getTimeLimits() {
        return preferences.getTimeLimits();
    }

    public void updateTimeLimit(String packageName, int minutes) {
        Map<String, Integer> limits = preferences.getTimeLimits();
        if (minutes <= 0) {
            limits.remove(packageName);
        } else {
            limits.put(packageName, minutes);
        }
        preferences.setTimeLimits(limits);
    }

    private String getAppName(String packageName) {
        try {
            return context.getPackageManager()
                .getApplicationLabel(context.getPackageManager()
                .getApplicationInfo(packageName, 0))
                .toString();
        } catch (Exception e) {
            return packageName;
        }
    }
}