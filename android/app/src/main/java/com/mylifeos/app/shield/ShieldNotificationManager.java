package com.mylifeos.app.shield;

import android.content.Context;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.os.Build;
import android.media.RingtoneManager;
import android.net.Uri;
import android.media.Ringtone;

public class ShieldNotificationManager {
    private Context context;
    private ShieldPreferences prefs;

    public ShieldNotificationManager(Context context) {
        this.context = context;
        this.prefs = new ShieldPreferences(context);
    }

    public void triggerAlert() {
        // ১. ভাইব্রেশন (যদি সেটিংসে অন থাকে)
        if (prefs.isVibrationEnabled()) {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(200);
                }
            }
        }

        // ২. সাউন্ড ইফেক্ট (যদি সেটিংসে অন থাকে)
        if (prefs.isSoundEnabled()) {
            try {
                Uri notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                Ringtone r = RingtoneManager.getRingtone(context, notification);
                r.play();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}