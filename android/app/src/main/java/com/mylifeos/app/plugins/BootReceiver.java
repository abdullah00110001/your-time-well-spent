/* package com.mylifeos.app.plugins;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * BootReceiver - Device reboot হলে সব alarm reschedule করে।
 * 
 * ✅ FIXED: RiseAlarmScheduler import সরানো হয়েছে।
 *    সরাসরি AlarmManager ব্যবহার করো - extra class dependency নেই।
 * /
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "RiseBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {

        if (intent == null) return;

        String action = intent.getAction();

        boolean shouldRestore =
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action);

        if (!shouldRestore) return;

        Log.d(TAG, "Boot detected → restoring alarms...");

        try {
            // Capacitor storage থেকে alarms পড়ো
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

            // Capacitor Preferences key format: "_cap_KEY"
            String alarmsJson = prefs.getString("_cap_rise_alarms", null);
            if (alarmsJson == null) {
                // Fallback to raw key
                alarmsJson = prefs.getString("rise_alarms", null);
            }

            if (alarmsJson == null || alarmsJson.isEmpty()) {
                Log.d(TAG, "No saved alarms found");
                return;
            }

            JSONArray alarms = new JSONArray(alarmsJson);
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarmManager == null) {
                Log.e(TAG, "AlarmManager null");
                return;
            }

            int restored = 0;

            for (int i = 0; i < alarms.length(); i++) {
                JSONObject alarm = alarms.getJSONObject(i);

                // enabled false হলে skip
                if (alarm.has("enabled") && !alarm.getBoolean("enabled")) {
                    continue;
                }

                int alarmId = alarm.getInt("id");
                long timeInMillis = alarm.getLong("timeInMillis");
                String title = alarm.optString("title", "Rise Alarm");
                String body = alarm.optString("body", "Wake up!");
                String uuid = alarm.optString("uuid", String.valueOf(alarmId));

                // Past time হলে skip
                if (timeInMillis <= System.currentTimeMillis()) {
                    Log.d(TAG, "Alarm " + alarmId + " is in the past, skipping");
                    continue;
                }

                scheduleAlarm(context, alarmManager, alarmId, timeInMillis, title, body, uuid);
                restored++;
                Log.d(TAG, "Restored alarm: id=" + alarmId + ", uuid=" + uuid);
            }

            Log.d(TAG, "Total restored: " + restored + " alarms");

        } catch (Exception e) {
            Log.e(TAG, "Error restoring alarms", e);
        }
    }

    private void scheduleAlarm(Context context, AlarmManager alarmManager,
                                int id, long timeInMillis, String title,
                                String body, String uuid) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                Log.w(TAG, "No exact alarm permission, skipping id=" + id);
                return;
            }

            Intent intent = new Intent(context, RiseAlarmReceiver.class);
            intent.putExtra("ALARM_ID", id);
            intent.putExtra("ALARM_TITLE", title);
            intent.putExtra("ALARM_BODY", body);
            intent.putExtra("ALARM_UUID", uuid);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pi = PendingIntent.getBroadcast(context, id, intent, flags);

            // Show intent for AlarmClock display
            Intent showIntent = new Intent(context, Class.forName("com.mylifeos.app.MainActivity"));
            showIntent.setAction(Intent.ACTION_VIEW);
            showIntent.setData(android.net.Uri.parse("capacitor://localhost/rise/ring/" + uuid));
            showIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            PendingIntent showPi = PendingIntent.getActivity(context, id, showIntent, flags);

            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(timeInMillis, showPi);
            alarmManager.setAlarmClock(info, pi);

        } catch (Exception e) {
            Log.e(TAG, "scheduleAlarm failed for id=" + id, e);
        }
    }
}
 */
 
package com.mylifeos.app.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import com.mylifeos.app.rise.scheduler.RiseAlarmScheduler;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * BootReceiver
 * Package: com.mylifeos.app.plugins
 *
 * Device reboot হলে সব alarm restore করে।
 * RiseAlarmScheduler ব্যবহার করে (correct package থেকে import)।
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "RiseBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        boolean shouldRestore =
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action);

        if (!shouldRestore) return;

        Log.d(TAG, "Boot detected → restoring alarms");

        try {
            SharedPreferences prefs =
                context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

            // Capacitor Preferences key format = "_cap_KEY"
            String alarmsJson = prefs.getString("_cap_rise_alarms", null);
            if (alarmsJson == null) alarmsJson = prefs.getString("rise_alarms", null);

            if (alarmsJson == null || alarmsJson.isEmpty()) {
                Log.d(TAG, "No saved alarms found");
                return;
            }

            JSONArray alarms = new JSONArray(alarmsJson);
            int restored = 0;

            for (int i = 0; i < alarms.length(); i++) {
                JSONObject alarm = alarms.getJSONObject(i);

                // Disabled হলে skip
                if (alarm.has("is_enabled") && !alarm.getBoolean("is_enabled")) continue;
                if (alarm.has("enabled")    && !alarm.getBoolean("enabled"))    continue;

                int    alarmId      = alarm.getInt("id");
                long   timeInMillis = alarm.getLong("timeInMillis");
                String title        = alarm.optString("title", "Rise Alarm");
                String body         = alarm.optString("body",  "Wake up!");
                String uuid         = alarm.optString("uuid",  String.valueOf(alarmId));

                // Past time হলে skip
                if (timeInMillis <= System.currentTimeMillis()) {
                    Log.d(TAG, "Past alarm skip: id=" + alarmId);
                    continue;
                }

                // ✅ RiseAlarmScheduler ব্যবহার করো (correct package import)
                RiseAlarmScheduler.scheduleAlarm(context, alarmId, timeInMillis, title, body, uuid);
                restored++;
                Log.d(TAG, "Restored id=" + alarmId + " uuid=" + uuid);
            }

            Log.d(TAG, "Total restored: " + restored + " alarms");

        } catch (Exception e) {
            Log.e(TAG, "Boot restore error", e);
        }
    }
}