package com.mylifeos.app.rise.nighttorise;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * Enforces Sleep-to-Rise by watching foreground-app changes and launching
 * the block screen when a blocked package surfaces during an active
 * window.
 *
 * This is a STANDALONE accessibility service (not merged into
 * ShieldAccessibilityService), per an explicit decision to keep Sleep to
 * Rise independent of the content-blocking Shield system. All enforcement
 * lives directly inside this service — there is no companion foreground
 * service to start/stop, so there is nothing that can loop or fail to
 * turn off.
 *
 * NOTE: src/components/rise/night-to-rise/NightToRisePermissions.tsx
 * currently checks accessibility status via the existing `Shield`
 * plugin (ShieldPlugin.checkPermissions), which most likely only reports
 * on ShieldAccessibilityService. Until that's wired to also check this
 * service, the "Accessibility" permission row may show granted/missing
 * incorrectly for Sleep to Rise specifically. See NightToRiseManager
 * #isAccessibilityServiceEnabled for the correct check for THIS service.
 */
public class NightToRiseAccessibilityService extends AccessibilityService {

    private static final String TAG = "NightToRiseA11y";
    private static final long MIN_RECHECK_INTERVAL_MS = 400L;

    private NightToRisePreferences preferences;

    private String lastCheckedPackage = null;
    private long lastCheckedAtMs = 0L;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        preferences = new NightToRisePreferences(this);

        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.DEFAULT;
        info.notificationTimeout = 100;
        setServiceInfo(info);

        Log.i(TAG, "NightToRise accessibility service connected");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }
        CharSequence pkg = event.getPackageName();
        if (pkg == null) {
            return;
        }
        String packageName = pkg.toString();

        if (packageName.equals(getPackageName())) {
            return;
        }

        long now = System.currentTimeMillis();
        boolean samePackageRecently = packageName.equals(lastCheckedPackage)
                && (now - lastCheckedAtMs) < MIN_RECHECK_INTERVAL_MS;
        if (samePackageRecently) {
            return;
        }
        lastCheckedPackage = packageName;
        lastCheckedAtMs = now;

        evaluate(packageName, now);
    }

    private void evaluate(String foregroundPackage, long now) {
        if (preferences == null) {
            return;
        }

        NightToRiseDecider.Result result = NightToRiseDecider.computePhase(preferences, now);

        boolean locked = result.phase == NightToRiseDecider.Phase.SLEEP_LOCK
                || result.phase == NightToRiseDecider.Phase.RISE_LOCK;

        if (!locked) {
            // Not in a window — clear any leftover override from a previous window.
            if (preferences.isOverriddenForWindow()) {
                preferences.setOverriddenForWindow(false);
            }
            return;
        }

        if (preferences.isOverriddenForWindow()) {
            // User already used emergency unlock for this window instance.
            return;
        }

        boolean blocked = NightToRiseDecider.shouldBlockPackage(
                preferences, result.phase, getPackageName(), foregroundPackage);
        if (!blocked) {
            return;
        }

        launchBlockScreen(foregroundPackage, result.phase, result.windowEndEpochMillis);
    }

    private void launchBlockScreen(String blockedPackage, NightToRiseDecider.Phase phase,
                                    long windowEndEpochMillis) {
        Intent intent = new Intent(this, NightToRiseBlockActivity.class);
        intent.putExtra(NightToRiseBlockActivity.EXTRA_BLOCKED_PACKAGE, blockedPackage);
        intent.putExtra(NightToRiseBlockActivity.EXTRA_PHASE, phase.name());
        intent.putExtra(NightToRiseBlockActivity.EXTRA_WINDOW_END_EPOCH, windowEndEpochMillis);
        intent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
        );
        startActivity(intent);
    }

    @Override
    public void onInterrupt() {
        // No-op: nothing to tear down, there is no companion service.
    }
}

