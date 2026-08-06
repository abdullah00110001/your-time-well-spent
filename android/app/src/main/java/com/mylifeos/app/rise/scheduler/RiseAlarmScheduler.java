package com.mylifeos.app.rise.scheduler;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import com.mylifeos.app.MainActivity;
import com.mylifeos.app.rise.core.AlarmConstants;
import com.mylifeos.app.rise.receiver.RiseAlarmReceiver;

public class RiseAlarmScheduler {

    private static final String TAG = "RiseAlarmScheduler";

    public static void scheduleAlarm(Context context, int id, long timeInMillis,
                                      String title, String body, String uuid,
                                      boolean extraLoud, String soundUri) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                Log.e(TAG, "AlarmManager is null — cannot schedule id=" + id);
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!am.canScheduleExactAlarms()) {
                    Log.e(TAG, "No SCHEDULE_EXACT_ALARM permission — id=" + id);
                    return;
                }
            }

            if (uuid  == null || uuid.isEmpty())  uuid  = String.valueOf(id);
            if (title == null || title.isEmpty()) title = "Rise Alarm";
            if (body  == null || body.isEmpty())  body  = "Wake up!";

            Intent rxIntent = new Intent(context, RiseAlarmReceiver.class);
            rxIntent.putExtra(AlarmConstants.EXTRA_ALARM_ID,    id);
            rxIntent.putExtra(AlarmConstants.EXTRA_ALARM_UUID,  uuid);
            rxIntent.putExtra(AlarmConstants.EXTRA_ALARM_TITLE, title);
            rxIntent.putExtra(AlarmConstants.EXTRA_ALARM_BODY,  body);
            rxIntent.putExtra("EXTRA_LOUD", extraLoud);
            if (soundUri != null && !soundUri.isEmpty()) {
                rxIntent.putExtra("SOUND_URI", soundUri);
            }

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent alarmPi = PendingIntent.getBroadcast(
                context, id, rxIntent, flags
            );

            Intent showIntent = new Intent(context, MainActivity.class);
            showIntent.setAction(Intent.ACTION_VIEW);
            showIntent.setData(Uri.parse(AlarmConstants.DEEP_LINK_BASE + uuid));
            showIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK   |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_CLEAR_TOP
            );

            PendingIntent showPi = PendingIntent.getActivity(
                context, id, showIntent, flags
            );

            boolean scheduled = false;

            try {
                AlarmManager.AlarmClockInfo clockInfo =
                    new AlarmManager.AlarmClockInfo(timeInMillis, showPi);
                am.setAlarmClock(clockInfo, alarmPi);
                scheduled = true;
                Log.d(TAG, "✅ setAlarmClock: id=" + id + " extraLoud=" + extraLoud + " sound=" + soundUri);
            } catch (Exception e) {
                Log.w(TAG, "setAlarmClock failed: " + e.getMessage());
            }

            if (!scheduled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    am.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP, timeInMillis, alarmPi);
                    scheduled = true;
                    Log.d(TAG, "✅ setExactAndAllowWhileIdle: id=" + id);
                } catch (Exception e) {
                    Log.w(TAG, "setExactAndAllowWhileIdle failed: " + e.getMessage());
                }
            }

            if (!scheduled) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                        am.setExact(AlarmManager.RTC_WAKEUP, timeInMillis, alarmPi);
                    } else {
                        am.set(AlarmManager.RTC_WAKEUP, timeInMillis, alarmPi);
                    }
                    scheduled = true;
                    Log.d(TAG, "✅ setExact fallback: id=" + id);
                } catch (Exception e) {
                    Log.e(TAG, "All scheduling methods failed for id=" + id, e);
                }
            }

            if (!scheduled) {
                Log.e(TAG, "❌ CRITICAL: Could not schedule alarm id=" + id);
            }

        } catch (Exception e) {
            Log.e(TAG, "scheduleAlarm crashed for id=" + id, e);
        }
    }

    // Backward-compat overloads
    public static void scheduleAlarm(Context context, int id, long timeInMillis,
                                      String title, String body, String uuid,
                                      boolean extraLoud) {
        scheduleAlarm(context, id, timeInMillis, title, body, uuid, extraLoud, null);
    }

    public static void scheduleAlarm(Context context, int id, long timeInMillis,
                                      String title, String body, String uuid) {
        scheduleAlarm(context, id, timeInMillis, title, body, uuid, false, null);
    }

    public static void cancelAlarm(Context context, int id) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(context, RiseAlarmReceiver.class);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pi = PendingIntent.getBroadcast(context, id, intent, flags);
            am.cancel(pi);
            pi.cancel();

            Log.d(TAG, "Cancelled alarm id=" + id);
        } catch (Exception e) {
            Log.e(TAG, "cancelAlarm failed for id=" + id, e);
        }
    }

    public static boolean isAlarmScheduled(Context context, int id) {
        try {
            Intent intent = new Intent(context, RiseAlarmReceiver.class);

            int flags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pi = PendingIntent.getBroadcast(context, id, intent, flags);
            return pi != null;
        } catch (Exception e) {
            Log.e(TAG, "isAlarmScheduled check failed for id=" + id, e);
            return false;
        }
    }
}
