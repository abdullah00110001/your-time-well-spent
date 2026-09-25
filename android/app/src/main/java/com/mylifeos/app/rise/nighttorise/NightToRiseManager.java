package com.mylifeos.app.rise.nighttorise;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityManager;

import java.util.List;

/**
 * Static helpers: accessibility-permission check for
 * NightToRiseAccessibilityService specifically, boundary-alarm scheduling,
 * and the alarm-dismiss hook that starts Rise Guard.
 */
public final class NightToRiseManager {

    private static final int REQUEST_CODE_BOUNDARY_ALARM = 9421;

    private NightToRiseManager() {
    }

    /**
     * Checks specifically for NightToRiseAccessibilityService (not
     * ShieldAccessibilityService). See the note in
     * NightToRiseAccessibilityService about NightToRisePermissions.tsx
     * currently checking a different service via the Shield plugin.
     */
    public static boolean isAccessibilityServiceEnabled(Context context) {
        AccessibilityManager am =
                (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (am == null) {
            return false;
        }
        List<AccessibilityServiceInfo> enabledServices =
                am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);

        ComponentName target = new ComponentName(context, NightToRiseAccessibilityService.class);
        for (AccessibilityServiceInfo info : enabledServices) {
            String id = info.getId();
            if (!TextUtils.isEmpty(id) && id.contains(target.getClassName())) {
                return true;
            }
        }
        return false;
    }

    public static void openAccessibilitySettings(Context context) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    /**
     * Call from AlarmStateManager#clearRinging — the exact moment the rise
     * alarm is dismissed (mission complete or manual stop). Starts Rise
     * Guard for riseLockMinutesAfter minutes from right now, independent
     * of what the scheduled alarm time was (so snoozing delays Rise Guard,
     * an early manual stop starts it early).
     */
    public static void onAlarmDismissed(Context context) {
        NightToRisePreferences prefs = new NightToRisePreferences(context);
        if (!prefs.isEnabled() || !prefs.isConfigured()) {
            return;
        }
        long now = System.currentTimeMillis();
        long until = now + (prefs.getRiseLockMinutesAfter() * 60_000L);
        prefs.setRiseGuardActiveUntilEpoch(until);
        // Fresh window — any override from the sleep-lock half of the night
        // does not carry over into Rise Guard.
        prefs.setOverriddenForWindow(false);
        prefs.setStrictUnlockRequestedAtEpoch(0L);

        scheduleNextBoundaryAlarm(context);
    }

    /**
     * Schedules a single alarm for whichever known boundary comes next
     * (sleep-window start or rise-guard end), purely so anything listening
     * for NightToRisePhaseReceiver can refresh promptly. The
     * AccessibilityService itself never depends on this alarm — it always
     * recomputes the live phase on its own.
     */
    public static void scheduleNextBoundaryAlarm(Context context) {
        NightToRisePreferences prefs = new NightToRisePreferences(context);
        if (!prefs.isEnabled() || !prefs.isConfigured()) {
            cancelBoundaryAlarm(context);
            return;
        }

        long now = System.currentTimeMillis();
        long riseGuardUntil = prefs.getRiseGuardActiveUntilEpoch();
        long candidate;

        if (riseGuardUntil > now) {
            candidate = riseGuardUntil;
        } else {
            int sleepStartMinutes = ((prefs.getSleepTimeMinutes() - prefs.getSleepLockMinutesBefore())
                    % 1440 + 1440) % 1440;
            long nextSleepStart = NightToRiseDecider.epochOfPriorOrEqualTimeOfDay(now, sleepStartMinutes);
            if (nextSleepStart <= now) {
                nextSleepStart += 24L * 60 * 60 * 1000;
            }
            long riseAlarmEpoch = prefs.getRiseAlarmEpochMillis();
            candidate = (riseAlarmEpoch > now) ? Math.min(nextSleepStart, riseAlarmEpoch) : nextSleepStart;
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }

        Intent intent = new Intent(context, NightToRisePhaseReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, REQUEST_CODE_BOUNDARY_ALARM, intent, flags);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, candidate, pendingIntent);
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, candidate, pendingIntent);
        }
    }

    public static void cancelBoundaryAlarm(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }
        Intent intent = new Intent(context, NightToRisePhaseReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, REQUEST_CODE_BOUNDARY_ALARM, intent, flags);
        alarmManager.cancel(pendingIntent);
    }
}

