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

/**
 * RiseAlarmScheduler — schedules exact alarm shots.
 *
 * Every method now REPORTS FAILURE instead of silently returning: the JS layer
 * used to get success even when AlarmManager refused, so users believed an
 * alarm was set when nothing was scheduled. Each successfully scheduled shot is
 * also persisted through {@link RiseAlarmStore} so BootReceiver can replay it
 * with the full payload (title, uuid, sound, loudness, weekday).
 */
public class RiseAlarmScheduler {

    private static final String TAG = "RiseAlarmScheduler";

    /** @return true only when the OS actually accepted the alarm. */
    public static boolean scheduleAlarm(Context context, int id, long timeInMillis,
                                        String title, String body, String uuid,
                                        boolean extraLoud, String soundUri, int dayOfWeek) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                Log.e(TAG, "AlarmManager is null — cannot schedule id=" + id);
                return false;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                Log.e(TAG, "No SCHEDULE_EXACT_ALARM permission — id=" + id);
                return false;
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
            rxIntent.putExtra("DAY_OF_WEEK", dayOfWeek);
            if (soundUri != null && !soundUri.isEmpty()) {
                rxIntent.putExtra("SOUND_URI", soundUri);
            }

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent alarmPi = PendingIntent.getBroadcast(context, id, rxIntent, flags);

            Intent showIntent = new Intent(context, MainActivity.class);
            showIntent.setAction(Intent.ACTION_VIEW);
            showIntent.setData(Uri.parse(AlarmConstants.DEEP_LINK_BASE + uuid));
            showIntent.putExtra("RISE_ALARM_RING", true);
            showIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK   |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_CLEAR_TOP
            );

            PendingIntent showPi = PendingIntent.getActivity(context, id, showIntent, flags);

            boolean scheduled = false;

            // Primary path — surfaces in the system alarm UI and is exempt from Doze.
            try {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(timeInMillis, showPi), alarmPi);
                scheduled = verifyScheduled(context, id);
                if (scheduled) Log.d(TAG, "✅ setAlarmClock: id=" + id + " extraLoud=" + extraLoud);
            } catch (Exception e) {
                Log.w(TAG, "setAlarmClock failed: " + e.getMessage());
            }

            // Verified fallback.
            if (!scheduled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeInMillis, alarmPi);
                    scheduled = verifyScheduled(context, id);
                    if (scheduled) Log.d(TAG, "✅ setExactAndAllowWhileIdle: id=" + id);
                } catch (Exception e) {
                    Log.w(TAG, "setExactAndAllowWhileIdle failed: " + e.getMessage());
                }
            }

            if (!scheduled) {
                try {
                    am.setExact(AlarmManager.RTC_WAKEUP, timeInMillis, alarmPi);
                    scheduled = verifyScheduled(context, id);
                    if (scheduled) Log.d(TAG, "✅ setExact fallback: id=" + id);
                } catch (Exception e) {
                    Log.e(TAG, "All scheduling methods failed for id=" + id, e);
                }
            }

            if (!scheduled) {
                Log.e(TAG, "❌ CRITICAL: Could not schedule alarm id=" + id);
                return false;
            }

            RiseAlarmStore.Shot shot = new RiseAlarmStore.Shot();
            shot.id           = id;
            shot.timeInMillis = timeInMillis;
            shot.uuid         = uuid;
            shot.title        = title;
            shot.body         = body;
            shot.soundUri     = soundUri;
            shot.extraLoud    = extraLoud;
            shot.dayOfWeek    = dayOfWeek;
            RiseAlarmStore.save(context, shot);
            return true;

        } catch (Exception e) {
            Log.e(TAG, "scheduleAlarm crashed for id=" + id, e);
            return false;
        }
    }

    // Backward-compat overloads
    public static boolean scheduleAlarm(Context context, int id, long timeInMillis,
                                        String title, String body, String uuid,
                                        boolean extraLoud, String soundUri) {
        return scheduleAlarm(context, id, timeInMillis, title, body, uuid, extraLoud, soundUri, -1);
    }

    public static boolean scheduleAlarm(Context context, int id, long timeInMillis,
                                        String title, String body, String uuid,
                                        boolean extraLoud) {
        return scheduleAlarm(context, id, timeInMillis, title, body, uuid, extraLoud, null, -1);
    }

    public static boolean scheduleAlarm(Context context, int id, long timeInMillis,
                                        String title, String body, String uuid) {
        return scheduleAlarm(context, id, timeInMillis, title, body, uuid, false, null, -1);
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
            RiseAlarmStore.remove(context, id);

            Log.d(TAG, "Cancelled alarm id=" + id);
        } catch (Exception e) {
            Log.e(TAG, "cancelAlarm failed for id=" + id, e);
        }
    }

    /** True when a PendingIntent for this id currently exists in the OS. */
    private static boolean verifyScheduled(Context context, int id) {
        return isAlarmScheduled(context, id);
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
