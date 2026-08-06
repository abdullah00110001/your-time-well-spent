package com.mylifeos.app.rise.ui;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.WindowManager;

import com.mylifeos.app.MainActivity;
import com.mylifeos.app.rise.core.AlarmConstants;
import com.mylifeos.app.rise.state.AlarmStateManager;

/**
 * RiseRingActivity — Lock screen এর উপরে আসে।
 *
 * এই Activity কেন দরকার?
 * ──────────────────────────────────────────────────────────
 * Capacitor এর MainActivity lock screen dismiss করে না।
 * একটা native Activity দরকার যেটা:
 *   → showWhenLocked flag দিয়ে lock screen এর উপরে আসে
 *   → turnScreenOn দিয়ে screen জাগায়
 *   → FLAG_KEEP_SCREEN_ON দিয়ে screen on রাখে
 *   → Back button block করে
 *
 * এই Activity শুধু bridge হিসেবে কাজ করে।
 * সে React ring screen এ navigate করে দেয়।
 *
 * Dismissal protection:
 * ──────────────────────────────────────────────────────────
 * ✅ Back button block (alarm চলাকালীন)
 * ✅ onPause এ re-bring (5s delay)
 * ✅ onResume এ state check
 * ✅ Accidental finish() prevention
 * ──────────────────────────────────────────────────────────
 */
public class RiseRingActivity extends Activity {

    private static final String TAG = "RiseRingActivity";

    private Handler  reBringHandler  = new Handler(Looper.getMainLooper());
    private Runnable reBringRunnable;
    private boolean  missionComplete = false;

    // ──────────────────────────────────────────
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Lock screen এর উপরে আসো + screen জাগাও
        enableLockscreenFlags();

        Log.d(TAG, "onCreate");

        // UUID বের করো
        String uuid = extractUuid();

        // Alarm active না থাকলে → main এ যাও
        if (!AlarmStateManager.isRinging(this) && !isComingFromAlarm()) {
            Log.w(TAG, "No active alarm — going to MainActivity");
            goToMain(uuid);
            return;
        }

        // React ring screen এ navigate করো
        goToRingScreen(uuid);
    }

    // ──────────────────────────────────────────
    // Lock screen flags
    // ──────────────────────────────────────────
    private void enableLockscreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            //noinspection deprecation
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON   |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
        // Screen off হতে দেবো না
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    // ──────────────────────────────────────────
    // UUID extraction
    // ──────────────────────────────────────────
    private String extractUuid() {
        // Intent data থেকে (deep link)
        if (getIntent() != null && getIntent().getData() != null) {
            String path = getIntent().getData().getPath();
            if (path != null && path.startsWith("/rise/ring/")) {
                return path.replace("/rise/ring/", "");
            }
        }
        // Extra থেকে
        if (getIntent() != null) {
            String extra = getIntent().getStringExtra(AlarmConstants.EXTRA_ALARM_UUID);
            if (extra != null) return extra;
        }
        // State থেকে (most reliable)
        String stateUuid = AlarmStateManager.getActiveUuid(this);
        if (stateUuid != null) return stateUuid;

        return "fallback";
    }

    private boolean isComingFromAlarm() {
        // Intent extras check
        return getIntent() != null &&
               getIntent().getStringExtra(AlarmConstants.EXTRA_ALARM_UUID) != null;
    }

    // ──────────────────────────────────────────
    // Navigation
    // ──────────────────────────────────────────
    private void goToRingScreen(String uuid) {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(AlarmConstants.DEEP_LINK_BASE + uuid));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                            Intent.FLAG_ACTIVITY_SINGLE_TOP |
                            Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(intent);
            // finish() করি না — back stack এ থাকি যাতে return করা যায়
        } catch (Exception e) {
            Log.e(TAG, "goToRingScreen failed", e);
            goToMain(uuid);
        }
    }

    private void goToMain(String uuid) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(AlarmConstants.DEEP_LINK_BASE + uuid));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        finish();
    }

    // ──────────────────────────────────────────
    // Lifecycle — anti-dismiss
    // ──────────────────────────────────────────

    @Override
    public void onBackPressed() {
        if (AlarmStateManager.isRinging(this) && !missionComplete) {
            // Alarm চলছে — back block করো
            Log.d(TAG, "Back button blocked — alarm ringing");
            // কোনো action নেই intentionally
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Resume এ alarm আর নেই = mission complete হয়েছে
        if (!AlarmStateManager.isRinging(this)) {
            Log.d(TAG, "onResume: alarm stopped — finishing");
            missionComplete = true;
            finish();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // User home/back চাপলে alarm চলছে থাকলে 5s এ ফিরিয়ে আনো
        if (AlarmStateManager.isRinging(this) && !missionComplete) {
            Log.d(TAG, "onPause: alarm still ringing — scheduling re-bring");
            reBringRunnable = () -> {
                if (AlarmStateManager.isRinging(this) && !missionComplete) {
                    Log.d(TAG, "Re-bringing ring screen");
                    String uuid = extractUuid();
                    goToRingScreen(uuid);
                }
            };
            reBringHandler.postDelayed(reBringRunnable, 5000);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (reBringRunnable != null) {
            reBringHandler.removeCallbacks(reBringRunnable);
        }
    }

    // Mission complete হলে JS side এ call করার জন্য
    // (optional — JS নিজেই stopNativeRinging call করে)
    public void onMissionComplete() {
        missionComplete = true;
    }
}
