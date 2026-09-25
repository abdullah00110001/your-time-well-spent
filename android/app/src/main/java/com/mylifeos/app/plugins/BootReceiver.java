package com.mylifeos.app.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.mylifeos.app.rise.core.AlarmTimeMath;
import com.mylifeos.app.rise.scheduler.RiseAlarmScheduler;
import com.mylifeos.app.rise.scheduler.RiseAlarmStore;

import java.util.List;

/**
 * BootReceiver — restores every Rise alarm shot after a reboot or a package
 * replace.
 *
 * The old implementation read a Capacitor localStorage blob that never carried
 * the sound / loudness / weekday of a shot, so reboots either dropped alarms or
 * restored them wrong (and it was fully commented out, so nothing was restored
 * at all). It now replays {@link RiseAlarmStore}, which holds the full payload
 * of every shot that was ever scheduled, rolling weekly shots forward to their
 * next future occurrence.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "RiseBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || context == null) return;

        String action = intent.getAction();
        boolean shouldRestore =
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action);

        if (!shouldRestore) return;

        Log.d(TAG, "Boot/replace detected (" + action + ") → restoring alarms");

        // Blocking must survive reboots too, not just alarms.
        try { com.mylifeos.app.shield.core.ForegroundGuardService.forceSync(context); }
        catch (Throwable t) { Log.w(TAG, "guard sync failed", t); }

        int restored = 0, dropped = 0, failed = 0;
        long now = System.currentTimeMillis();

        try {
            List<RiseAlarmStore.Shot> shots = RiseAlarmStore.all(context);
            for (RiseAlarmStore.Shot shot : shots) {
                if (shot == null || shot.id == 0) continue;

                long when = shot.timeInMillis;

                if (shot.dayOfWeek >= 0) {
                    // Recurring weekly shot — roll forward to the next future
                    // occurrence of the same weekday / local time-of-day.
                    when = AlarmTimeMath.rollForwardWeekly(when, now);
                } else if (when <= now) {
                    // One-shot alarm that already passed while the phone was off.
                    RiseAlarmStore.remove(context, shot.id);
                    dropped++;
                    continue;
                }

                boolean ok = RiseAlarmScheduler.scheduleAlarm(
                    context, shot.id, when, shot.title, shot.body, shot.uuid,
                    shot.extraLoud, shot.soundUri, shot.dayOfWeek
                );

                if (ok) {
                    restored++;
                } else {
                    failed++;
                    Log.e(TAG, "Failed to restore alarm id=" + shot.id);
                }
            }
        } catch (Throwable t) {
            Log.e(TAG, "Alarm restore crashed", t);
        }

        // Re-arm Sleep to Rise enforcement state (window / alarm reference).
        try {
            com.mylifeos.app.nighttorise.NightToRiseManager.onBootRestored(context);
        } catch (Throwable t) {
            Log.w(TAG, "NightToRise boot restore skipped: " + t.getMessage());
        }

        Log.d(TAG, "Restore complete → restored=" + restored
                + " dropped=" + dropped + " failed=" + failed);
    }
}
