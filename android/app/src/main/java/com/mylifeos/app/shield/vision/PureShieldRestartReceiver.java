package com.mylifeos.app.shield.vision;

import android.content.*;
import android.os.Build;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * PureShieldRestartReceiver
 * Receives AlarmManager broadcast to restart PureShieldService after it's killed.
 */
public class PureShieldRestartReceiver extends BroadcastReceiver {

    private static final String TAG = "PureShield.Restart";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "Restart triggered");
        Intent serviceIntent = new Intent(context, PureShieldService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
