package com.mylifeos.app.rise.nighttorise;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Fires at each known Sleep/Rise Guard boundary purely to reschedule the
 * next boundary alarm and broadcast a local "phase changed" signal for any
 * UI (notification, widget) that wants to refresh without polling. Not a
 * source of truth — NightToRiseAccessibilityService always recomputes the
 * live phase itself.
 */
public class NightToRisePhaseReceiver extends BroadcastReceiver {

    public static final String ACTION_PHASE_CHANGED =
            "com.mylifeos.app.rise.nighttorise.PHASE_CHANGED";

    @Override
    public void onReceive(Context context, Intent intent) {
        NightToRisePreferences prefs = new NightToRisePreferences(context);
        if (!prefs.isEnabled()) {
            return;
        }

        NightToRiseManager.scheduleNextBoundaryAlarm(context);

        Intent phaseChanged = new Intent(ACTION_PHASE_CHANGED);
        phaseChanged.setPackage(context.getPackageName());
        context.sendBroadcast(phaseChanged);
    }
}

