package com.mylifeos.app.shield;

import android.content.Context;
import android.util.Log;

public class ShieldTimerManager {
    private ShieldPreferences prefs;
    private ShieldNotificationManager notifier;

    public ShieldTimerManager(Context context) {
        this.prefs = new ShieldPreferences(context);
        this.notifier = new ShieldNotificationManager(context);
    }

    // প্রতি ১ মিনিটে এই মেথডটি কল হবে (Service থেকে)
    public void checkTimeLimits(String packageName, long usedMinutes) {
        int limit = prefs.getAppLimit(packageName);
        
        if (limit > 0) {
            long remaining = limit - usedMinutes;

            // ১. Low Time Alert (৫ মিনিট বাকি থাকলে)
            if (remaining == 5 && prefs.isLowTimeAlertEnabled()) {
                notifier.triggerAlert();
                Log.d("ShieldTimer", "⚠️ Low time alert for " + packageName);
            }

            // ২. লিমিট শেষ হয়ে গেলে
            if (remaining <= 0) {
                // এখানে ব্লক স্ক্রিন দেখানোর কমান্ড ট্রিগার হবে
                Log.d("ShieldTimer", "🛑 Time's up for " + packageName);
            }
        }
    }
}