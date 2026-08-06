package com.mylifeos.app.plugins;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.mylifeos.app.rise.core.AlarmConstants;
import com.mylifeos.app.rise.receiver.RiseAlarmReceiver;
import com.mylifeos.app.rise.recovery.AlarmRecoveryReceiver;
import com.mylifeos.app.rise.scheduler.RiseAlarmScheduler;
import com.mylifeos.app.rise.service.AlarmSoundService;
import com.mylifeos.app.rise.state.AlarmStateManager;

@CapacitorPlugin(name = "RiseAlarmPlugin")
public class RiseAlarmPlugin extends Plugin {

    private static final String TAG = "RiseAlarmPlugin";
    private AlarmManager alarmManager;

    @Override
    public void load() {
        alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        Log.d(TAG, "Plugin loaded");
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ret.put("granted", alarmManager.canScheduleExactAlarms());
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("openExactAlarmSettings failed", e);
        }
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
                return;
            }
            call.resolve();
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Exception e2) {
                call.reject("openBatterySettings failed", e2);
            }
        }
    }

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.os.PowerManager pm =
                    (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                boolean ignored = pm != null &&
                    pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                ret.put("ignored", ignored);
            } else {
                ret.put("ignored", true);
            }
        } catch (Exception e) {
            ret.put("ignored", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        Integer id        = call.getInt("id");
        Long timeInMillis = call.getLong("timeInMillis");
        String title      = call.getString("title", "Rise Alarm");
        String body       = call.getString("body",  "Wake up!");
        String uuid       = call.getString("uuid");
        String soundUri   = call.getString("soundUri", null);

        boolean extraLoud = Boolean.TRUE.equals(call.getBoolean("extraLoud", false));

        if (id == null || timeInMillis == null) {
            call.reject("Missing required: id, timeInMillis");
            return;
        }
        if (uuid == null || uuid.isEmpty()) uuid = String.valueOf(id);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            !alarmManager.canScheduleExactAlarms()) {
            call.reject("Exact alarm permission not granted");
            return;
        }

        try {
            RiseAlarmScheduler.scheduleAlarm(
                getContext(), id, timeInMillis, title, body, uuid, extraLoud, soundUri
            );
            Log.d(TAG, "Scheduled id=" + id + " uuid=" + uuid + " extraLoud=" + extraLoud + " sound=" + soundUri);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            ret.put("uuid", uuid);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("scheduleAlarm failed", e);
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) { call.reject("Missing id"); return; }
        try {
            RiseAlarmScheduler.cancelAlarm(getContext(), id);
            call.resolve();
        } catch (Exception e) {
            call.reject("cancelAlarm failed", e);
        }
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        try {
            AlarmSoundService.stop(getContext());
            AlarmRecoveryReceiver.cancel(getContext());

            NotificationManager nm =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancelAll();

            AlarmStateManager.clearRinging(getContext());

            Log.d(TAG, "stopRinging complete");
            call.resolve();
        } catch (Exception e) {
            call.reject("stopRinging failed", e);
        }
    }

    @PluginMethod
    public void getRingingAlarmId(PluginCall call) {
        String uuid = AlarmStateManager.getActiveUuid(getContext());
        JSObject ret = new JSObject();
        ret.put("id", uuid != null ? uuid : JSObject.NULL);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearRingingAlarmId(PluginCall call) {
        AlarmStateManager.clearRinging(getContext());
        call.resolve();
    }

    @PluginMethod
    public void isAlarmRinging(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ringing", AlarmStateManager.isRinging(getContext()));
        ret.put("uuid",    AlarmStateManager.getActiveUuid(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void getSnoozeInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("count",     AlarmStateManager.getSnoozeCount(getContext()));
        ret.put("max",       AlarmStateManager.getSnoozeMax(getContext()));
        ret.put("canSnooze", AlarmStateManager.canSnooze(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void getAlarmState(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        ret.put("isRinging",       AlarmStateManager.isRinging(ctx));
        ret.put("activeUuid",      AlarmStateManager.getActiveUuid(ctx));
        ret.put("activeId",        AlarmStateManager.getActiveId(ctx));
        ret.put("missionDone",     AlarmStateManager.isMissionDone(ctx));
        ret.put("snoozeCount",     AlarmStateManager.getSnoozeCount(ctx));
        ret.put("snoozeMax",       AlarmStateManager.getSnoozeMax(ctx));
        ret.put("canSnooze",       AlarmStateManager.canSnooze(ctx));
        ret.put("triggerTime",     AlarmStateManager.getTriggerTime(ctx));
        ret.put("durationMinutes", AlarmStateManager.getRingingDurationMinutes(ctx));
        ret.put("serviceRunning",  AlarmSoundService.isRunning);
        call.resolve(ret);
    }
}
