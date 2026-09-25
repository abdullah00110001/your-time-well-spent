package com.mylifeos.app.rise.nighttorise;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Full-screen interstitial shown in place of a blocked app during an
 * active Sleep/Rise Guard window.
 *
 * Mirrors NightToRiseGuard.tsx's strict-mode behavior (10 minute delayed
 * emergency unlock) natively, since this screen covers OTHER apps and the
 * JS overlay only covers this app's own UI. PIN verification is
 * intentionally NOT done here: the PIN lives in the web app's
 * localStorage ('app_lock_pin'), which native code cannot read. If you
 * want PIN-gated native unlock, add a plugin method that pushes the PIN
 * (or a hash of it) down via setConfig and compare it here.
 *
 * Built with plain views so this file has no layout-resource dependency.
 */
public class NightToRiseBlockActivity extends AppCompatActivity {

    public static final String EXTRA_BLOCKED_PACKAGE = "extra_blocked_package";
    public static final String EXTRA_PHASE = "extra_phase";
    public static final String EXTRA_WINDOW_END_EPOCH = "extra_window_end_epoch";

    private NightToRisePreferences preferences;
    private CountDownTimer countDownTimer;
    private TextView countdownView;
    private TextView unlockStatusView;
    private Button unlockButton;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = new NightToRisePreferences(this);

        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                        | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        setContentView(buildContentView());
        startCountdown();
        refreshUnlockRow();
    }

    private LinearLayout buildContentView() {
        String phaseName = getIntent().getStringExtra(EXTRA_PHASE);
        boolean isRise = NightToRiseDecider.Phase.RISE_LOCK.name().equals(phaseName);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor(isRise ? "#1A1206" : "#0B0F1A"));
        root.setPadding(64, 64, 64, 64);

        TextView title = new TextView(this);
        title.setText(isRise ? "Rise Guard is active" : "Sleep Guard is active");
        title.setTextColor(Color.WHITE);
        title.setTextSize(22f);
        title.setGravity(Gravity.CENTER);

        TextView subtitle = new TextView(this);
        String message = isRise
                ? preferences.getRiseBlockMessage()
                : preferences.getSleepBlockMessage();
        subtitle.setText(message);
        subtitle.setTextColor(Color.parseColor("#AAAAAA"));
        subtitle.setTextSize(14f);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 24, 0, 24);

        countdownView = new TextView(this);
        countdownView.setTextColor(Color.WHITE);
        countdownView.setTextSize(28f);
        countdownView.setGravity(Gravity.CENTER);
        countdownView.setPadding(0, 0, 0, 32);

        unlockStatusView = new TextView(this);
        unlockStatusView.setTextColor(Color.parseColor("#AAAAAA"));
        unlockStatusView.setTextSize(12f);
        unlockStatusView.setGravity(Gravity.CENTER);
        unlockStatusView.setPadding(0, 0, 0, 16);

        unlockButton = new Button(this);
        unlockButton.setOnClickListener(v -> handleUnlockTap());

        Button homeButton = new Button(this);
        homeButton.setText("Go home");
        homeButton.setOnClickListener(v -> goHome());

        root.addView(title);
        root.addView(subtitle);
        root.addView(countdownView);
        root.addView(unlockStatusView);
        root.addView(unlockButton);
        root.addView(homeButton);
        return root;
    }

    private void startCountdown() {
        long windowEndEpoch = getIntent().getLongExtra(EXTRA_WINDOW_END_EPOCH, 0L);
        long millisLeft = windowEndEpoch - System.currentTimeMillis();
        if (millisLeft <= 0) {
            countdownView.setText("");
            finish();
            return;
        }

        countDownTimer = new CountDownTimer(millisLeft, 1_000L) {
            @Override
            public void onTick(long millisUntilFinished) {
                long totalSeconds = millisUntilFinished / 1000;
                long hours = totalSeconds / 3600;
                long minutes = (totalSeconds % 3600) / 60;
                countdownView.setText(String.format(
                        "%02d:%02d until unlocked", hours, minutes));
                refreshUnlockRow();
            }

            @Override
            public void onFinish() {
                finish();
            }
        }.start();
    }

    /** Updates the emergency-unlock button/label based on strict-mode cooldown state. */
    private void refreshUnlockRow() {
        boolean strict = preferences.isStrictMode();
        if (!strict) {
            unlockButton.setText("Emergency unlock");
            unlockStatusView.setText("Phone and emergency calls are always reachable.");
            return;
        }

        long requestedAt = preferences.getStrictUnlockRequestedAtEpoch();
        if (requestedAt <= 0) {
            unlockButton.setText("Request emergency unlock (10 min wait)");
            unlockStatusView.setText("Strict mode is on.");
            return;
        }

        long readyAt = requestedAt + NightToRisePreferences.STRICT_UNLOCK_DELAY_MS;
        long remainingMs = readyAt - System.currentTimeMillis();
        if (remainingMs <= 0) {
            unlockButton.setText("Unlock now");
            unlockStatusView.setText("Unlock available.");
        } else {
            long remMin = remainingMs / 60000;
            long remSec = (remainingMs % 60000) / 1000;
            unlockButton.setText("Waiting...");
            unlockStatusView.setText(String.format(
                    "Unlock available in %d:%02d", remMin, remSec));
        }
    }

    private void handleUnlockTap() {
        boolean strict = preferences.isStrictMode();
        if (!strict) {
            doUnlock();
            return;
        }

        long requestedAt = preferences.getStrictUnlockRequestedAtEpoch();
        if (requestedAt <= 0) {
            preferences.setStrictUnlockRequestedAtEpoch(System.currentTimeMillis());
            refreshUnlockRow();
            return;
        }

        long readyAt = requestedAt + NightToRisePreferences.STRICT_UNLOCK_DELAY_MS;
        if (System.currentTimeMillis() >= readyAt) {
            doUnlock();
        }
        // else: still waiting, tap does nothing (button already reflects this).
    }

    private void doUnlock() {
        preferences.setOverriddenForWindow(true);
        preferences.setPendingBreak(true);
        preferences.setStrictUnlockRequestedAtEpoch(0L);
        finish();
    }

    private void goHome() {
        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(homeIntent);
        finish();
    }

    @Override
    public void onBackPressed() {
        goHome();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (countDownTimer != null) {
            countDownTimer.cancel();
        }
    }
}

