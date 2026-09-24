package com.mylifeos.app.nighttorise;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import com.mylifeos.app.R;

/**
 * NightToRiseBlockActivity — full-screen lock shown by the accessibility
 * service when the user opens a disallowed app inside a Night-to-Rise window.
 *
 * Intent extras:
 *   "message" : String
 *   "endMs"   : long
 *   "strict"  : boolean
 *
 * FIX (v2): tapping "Emergency unlock" now writes a pending-break flag to
 * NightToRisePreferences so the JS layer can pick it up next time it resumes
 * and correctly reset the streak (previously this was silently lost).
 */
public class NightToRiseBlockActivity extends Activity {

    public static final String EXTRA_MESSAGE = "message";
    public static final String EXTRA_END_MS  = "endMs";
    public static final String EXTRA_STRICT  = "strict";

    private CountDownTimer timer;
    private CountDownTimer strictTimer;

    /** Records the break for JS streak sync and sends the user home. */
    private void breakLock(NightToRisePreferences prefs) {
        prefs.recordPendingBreak();
        prefs.clearStrictUnlockRequest();
        startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }

    /** Updates the strict-mode override button label / enabled state. */
    private void refreshStrictOverride(NightToRisePreferences prefs, Button override) {
        long req = prefs.strictUnlockRequestedAt();
        if (req <= 0L) {
            override.setEnabled(true);
            override.setText("Request emergency unlock (10 min wait)");
            return;
        }
        long left = NightToRisePreferences.STRICT_UNLOCK_DELAY_MS - (System.currentTimeMillis() - req);
        if (left <= 0L) {
            override.setEnabled(true);
            override.setText("Emergency unlock");
        } else {
            override.setEnabled(false);
            long s = left / 1000;
            override.setText(String.format("Unlock available in %d:%02d", s / 60, s % 60));
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        setContentView(R.layout.activity_night_to_rise_block);

        String message = getIntent().getStringExtra(EXTRA_MESSAGE);
        long   endMs   = getIntent().getLongExtra(EXTRA_END_MS, 0L);
        boolean strict = getIntent().getBooleanExtra(EXTRA_STRICT, false);

        ((TextView) findViewById(R.id.n2r_message)).setText(message != null ? message : "Locked.");

        final NightToRisePreferences prefs = new NightToRisePreferences(this);
        final Button override = findViewById(R.id.n2r_override);
        override.setVisibility(android.view.View.VISIBLE);

        if (!strict) {
            override.setText("Emergency unlock");
            override.setOnClickListener(v -> breakLock(prefs));
        } else {
            // PHASE 2 — strict mode: the override is never hidden (real
            // emergencies happen), but it costs a 10 minute wait.
            refreshStrictOverride(prefs, override);
            override.setOnClickListener(v -> {
                long req = prefs.strictUnlockRequestedAt();
                long now = System.currentTimeMillis();
                if (req <= 0L) {
                    prefs.requestStrictUnlock();
                    refreshStrictOverride(prefs, override);
                } else if (now - req >= NightToRisePreferences.STRICT_UNLOCK_DELAY_MS) {
                    breakLock(prefs);
                }
            });
            strictTimer = new CountDownTimer(NightToRisePreferences.STRICT_UNLOCK_DELAY_MS + 1000, 1000) {
                @Override public void onTick(long ms) { refreshStrictOverride(prefs, override); }
                @Override public void onFinish() { refreshStrictOverride(prefs, override); }
            }.start();
        }

        TextView countdown = findViewById(R.id.n2r_countdown);
        long remaining = Math.max(0, endMs - System.currentTimeMillis());
        timer = new CountDownTimer(remaining, 1000) {
            @Override public void onTick(long ms) {
                long s = ms / 1000;
                long h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
                countdown.setText(h > 0
                    ? String.format("%d:%02d:%02d", h, m, sec)
                    : String.format("%02d:%02d", m, sec));
            }
            @Override public void onFinish() {
                countdown.setText("00:00");
                finish();
            }
        }.start();

        findViewById(R.id.n2r_home).setOnClickListener(v -> {
            startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            finish();
        });
    }

    /** singleTask: re-launches reuse this instance instead of stacking new windows. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String message = intent.getStringExtra(EXTRA_MESSAGE);
        if (message != null) ((TextView) findViewById(R.id.n2r_message)).setText(message);
    }

    @Override public void onBackPressed() { /* swallow */ }

    @Override
    protected void onDestroy() {
        if (timer != null) timer.cancel();
        if (strictTimer != null) strictTimer.cancel();
        super.onDestroy();
    }
}
