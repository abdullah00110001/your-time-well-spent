package com.mylifeos.app.shield;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class ShieldService extends Service {
    private static final String CHANNEL_ID = "shield_service_channel";
    private static final int NOTIFICATION_ID = 1001;

    private ShieldPreferences preferences;
    private Handler handler;
    private Map<String, Integer> dailyUsage = new HashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        preferences = new ShieldPreferences(this);
        handler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        resetDailyUsageIfNeeded();
        Log.d("ShieldService", "🛡️ Shield Service started — Accessibility handles blocking");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // ✅ Polling বন্ধ করা হয়েছে
        // ShieldAccessibilityService এখন সব blocking handle করে
        // এতে ব্যাটারি বাঁচবে, কাজ একই থাকবে
        return START_STICKY;
    }

    // ==========================================
    // ⏱️ Time Limit Logic (ভবিষ্যতে কাজে লাগবে)
    // ==========================================
    private void checkTimeLimits(String currentPackage) {
        if (currentPackage == null) return;

        Map<String, Integer> timeLimits = preferences.getTimeLimits();

        if (timeLimits.containsKey(currentPackage)) {
            int limitSeconds = timeLimits.get(currentPackage) * 60;
            int usedSeconds = dailyUsage.getOrDefault(currentPackage, 0);

            if (usedSeconds >= limitSeconds) {
                launchBlockScreen(currentPackage, "time_limit");
            } else {
                dailyUsage.put(currentPackage, usedSeconds + 2);
            }
        }
    }

    private String getCurrentForegroundApp() {
        String currentApp = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            long time = System.currentTimeMillis();
            List<UsageStats> appList = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY, time - 1000 * 1000, time);
            if (appList != null && appList.size() > 0) {
                UsageStats recentApp = null;
                for (UsageStats usageStats : appList) {
                    if (recentApp == null ||
                        usageStats.getLastTimeUsed() > recentApp.getLastTimeUsed()) {
                        recentApp = usageStats;
                    }
                }
                if (recentApp != null) currentApp = recentApp.getPackageName();
            }
        }
        return currentApp;
    }

    private void launchBlockScreen(String packageName, String reason) {
        try {
            Intent intent = new Intent(this, ShieldBlockActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("blocked_package", packageName);
            intent.putExtra("reason", reason);
            startActivity(intent);
        } catch (Exception e) {
            Log.e("ShieldService", "Failed to launch block screen: " + e.getMessage());
        }
    }

    private void resetDailyUsageIfNeeded() {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String lastReset = preferences.getLastResetDate();
        if (lastReset == null || !today.equals(lastReset)) {
            dailyUsage.clear();
            preferences.updateLastResetDate(today);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Shield Protection",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shield is actively protecting you");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification() {
        Intent intent;
        try {
            Class<?> mainActivityClass = Class.forName("com.mylifeos.app.MainActivity");
            intent = new Intent(this, mainActivityClass);
        } catch (ClassNotFoundException e) {
            intent = new Intent(Settings.ACTION_SETTINGS);
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Shield Active")
            .setContentText("Protecting your focus")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Override
    public void onDestroy() {
        if (handler != null) {
            handler.removeCallbacksAndMessages(null);
        }
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}