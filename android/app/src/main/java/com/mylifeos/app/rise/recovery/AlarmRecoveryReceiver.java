package com.mylifeos.app.rise.recovery;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.mylifeos.app.rise.core.AlarmConstants;
import com.mylifeos.app.rise.service.AlarmSoundService;
import com.mylifeos.app.rise.state.AlarmStateManager;

/**
 * AlarmRecoveryReceiver — Rise System এর watchdog।
 *
 * কেন দরকার?
 * ─────────────────────────────────────────────────────────────────
 * Android এ foreground service ও system kill করতে পারে।
 * START_STICKY মানে restart হবে কিন্তু delay হতে পারে।
 * এই receiver 15 min পরপর check করে:
 *   → Alarm রিং হওয়ার কথা কিন্তু service চলছে না?
 *   → Service restart করে দাও।
 *   → 30 min পার হয়ে গেলে auto-stop করো।
 *
 * Schedule করার উপায়:
 *   AlarmRecoveryReceiver.schedule(context) → কল করো alarm trigger এর পরে।
 *   AlarmRecoveryReceiver.cancel(context)   → কল করো alarm stop এর পরে।
 * ─────────────────────────────────────────────────────────────────
 */
public class AlarmRecoveryReceiver extends BroadcastReceiver {

    private static final String TAG           = "AlarmRecovery";
    private static final int    REQUEST_CODE  = 77777;
    private static final String ACTION_RECOVER = "com.mylifeos.app.RISE_RECOVERY_CHECK";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        Log.d(TAG, "🔍 Recovery check triggered");

        // 1. Auto-stop check (30 min)
        if (AlarmStateManager.shouldAutoStop(context)) {
            Log.w(TAG, "⏰ Auto-stop: alarm running > 30 min");
            AlarmStateManager.clearRinging(context);
            AlarmSoundService.stop(context);
            cancel(context);
            return;
        }

        // 2. Alarm should be ringing but service is dead?
        if (AlarmStateManager.isRinging(context)) {
            if (!AlarmSoundService.isRunning) {
                Log.w(TAG, "💀 Service dead but alarm ringing — restarting!");
                restartService(context);
            } else {
                Log.d(TAG, "✅ Service OK — alarm still ringing");
            }
            // Force the ring screen back to foreground every cycle (Alarmy-style)
            forceRingScreenForeground(context);
            // Re-arm a quick recovery so the user can't escape for long
            scheduleQuick(context);
        } else {
            Log.d(TAG, "✅ No active alarm — cancelling recovery schedule");
            cancel(context);
        }
    }

    private void forceRingScreenForeground(Context ctx) {
        try {
            String uuid = AlarmStateManager.getActiveUuid(ctx);
            if (uuid == null) return;
            Intent show = new Intent(ctx, com.mylifeos.app.MainActivity.class);
            show.setAction(Intent.ACTION_VIEW);
            show.setData(android.net.Uri.parse(AlarmConstants.DEEP_LINK_BASE + uuid));
            show.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            );
            ctx.startActivity(show);
            Log.d(TAG, "🔝 Forced ring screen to foreground for uuid=" + uuid);
        } catch (Exception e) {
            Log.e(TAG, "forceRingScreenForeground failed", e);
        }
    }

    // ──────────────────────────────────────────────
    // Service restart
    // ──────────────────────────────────────────────
    private void restartService(Context context) {
        try {
            String uuid  = AlarmStateManager.getActiveUuid(context);
            int    id    = AlarmStateManager.getActiveId(context);
            String title = AlarmStateManager.getAlarmTitle(context);
            String body  = AlarmStateManager.getAlarmBody(context);

            if (uuid == null) {
                Log.e(TAG, "Cannot restart — no UUID in state");
                return;
            }

            Intent svcIntent = new Intent(context, AlarmSoundService.class);
            svcIntent.putExtra(AlarmConstants.EXTRA_ALARM_ID,    id);
            svcIntent.putExtra(AlarmConstants.EXTRA_ALARM_UUID,  uuid);
            svcIntent.putExtra(AlarmConstants.EXTRA_ALARM_TITLE, title);
            svcIntent.putExtra(AlarmConstants.EXTRA_ALARM_BODY,  body);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svcIntent);
            } else {
                context.startService(svcIntent);
            }

            Log.d(TAG, "🔄 Service restarted for uuid=" + uuid);

            // Recovery notification — user কে জানাও
            showRecoveryNotification(context, title);

        } catch (Exception e) {
            Log.e(TAG, "restartService failed", e);
        }
    }

    // ──────────────────────────────────────────────
    // Recovery notification
    // ──────────────────────────────────────────────
    private void showRecoveryNotification(Context ctx, String alarmTitle) {
        try {
            NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            String chId = "rise_recovery_ch";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(
                    chId, "Rise Recovery", NotificationManager.IMPORTANCE_HIGH);
                ch.setBypassDnd(true);
                nm.createNotificationChannel(ch);
            }

            nm.notify(AlarmConstants.NOTIF_ID_RECOVERY,
                new NotificationCompat.Builder(ctx, chId)
                    .setSmallIcon(ctx.getApplicationInfo().icon)
                    .setContentTitle("⏰ " + alarmTitle)
                    .setContentText("Alarm restarted — complete your mission!")
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(false)
                    .setOngoing(true)
                    .build());
        } catch (Exception e) {
            Log.e(TAG, "showRecoveryNotification failed", e);
        }
    }

    // ──────────────────────────────────────────────
    // STATIC: Schedule repeating recovery check
    // ──────────────────────────────────────────────

    /**
     * Alarm trigger হওয়ার পরে call করো।
     * 15 min পরপর health check করবে।
     */
    public static void schedule(Context context) {
        scheduleQuick(context);
    }

    /** Re-arm a fast (~6s) recovery check so the user cannot escape the ring screen. */
    public static void scheduleQuick(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = getPendingIntent(context);
            long next = System.currentTimeMillis() + 6_000L;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, next, pi);
            }
            Log.d(TAG, "📅 Quick recovery check armed (+6s)");
        } catch (Exception e) {
            Log.e(TAG, "scheduleQuick failed", e);
        }
    }

    /**
     * Alarm stop হওয়ার পরে call করো।
     */
    public static void cancel(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            am.cancel(getPendingIntent(context));
            Log.d(TAG, "❌ Recovery schedule cancelled");
        } catch (Exception e) {
            Log.e(TAG, "cancel failed", e);
        }
    }

    private static PendingIntent getPendingIntent(Context context) {
        Intent intent = new Intent(context, AlarmRecoveryReceiver.class);
        intent.setAction(ACTION_RECOVER);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT |
                    (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ?
                     PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags);
    }
}
