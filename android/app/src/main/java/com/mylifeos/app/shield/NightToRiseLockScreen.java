package com.mylifeos.app.shield;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.mylifeos.app.nighttorise.NightToRiseBlockCard;

/**
 * Sleep to Rise block screen — shown when an app locked by the Sleep to Rise
 * schedule is opened. UI comes from the shared NightToRiseBlockCard (same
 * card used elsewhere), built in Java — no XML.
 *
 * Extras: EXTRA_KIND ("sleep" | "rise"), EXTRA_END_MS, EXTRA_PACKAGE, EXTRA_MESSAGE.
 * NOTE: the class name must keep "NightToRise" in it — the blocker uses that to
 * recognise its own screen and never block it.
 *
 * [CARD-SWAP] This screen does not yet have emergency-unlock, a kill-switch,
 * or a duplicate-instance guard — NightToRiseBlockCard's override button is
 * hidden here for that reason. The only way out right now is "Go home" or
 * the lock ending on its own. Say the word if any of that should be added.
 */
public class NightToRiseLockScreen extends Activity {
    public static final String EXTRA_KIND = "kind";
    public static final String EXTRA_END_MS = "end_ms";
    public static final String EXTRA_PACKAGE = "package";
    public static final String EXTRA_MESSAGE = "message";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private static final long CARD_DISPLAY_MS = 10_000L;
    private final Runnable autoHome = this::goHome;
    private NightToRiseBlockCard.Handles ui;
    private long endMs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); }
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // [CARD-SWAP] card-only: nothing painted behind it, window stays transparent.
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        ShieldAccessibilityService.dismissBlockingOverlay();
        render(getIntent());
        com.mylifeos.app.LifeLog.i("N2RLockScreen", "shown for " + getIntent().getStringExtra(EXTRA_PACKAGE));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        render(intent);
    }

    private void render(Intent in) {
        String kind = in.getStringExtra(EXTRA_KIND);
        boolean rise = "rise".equals(kind);
        endMs = in.getLongExtra(EXTRA_END_MS, 0L);
        String msg = in.getStringExtra(EXTRA_MESSAGE);
        if (msg == null || msg.isEmpty()) {
            msg = rise ? "Screens stay closed a little longer." : "Time to rest. Put the phone down.";
        }

        handler.removeCallbacks(tick);
        handler.removeCallbacks(autoHome);
        ui = NightToRiseBlockCard.build(this, rise);
        setContentView(ui.root);

        ui.title.setText(rise ? "Rise with intention" : "Rest now");
        ui.message.setText(msg);
        if (endMs > 0) ui.setEndTime(endMs);
        // [CARD-SWAP] no emergency-unlock wired here yet — keep it out of sight
        // rather than show a button that does nothing.
        ui.override.setVisibility(android.view.View.GONE);
        ui.home.setOnClickListener(v -> goHome());

        tick.run();
        handler.postDelayed(autoHome, CARD_DISPLAY_MS);
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            handler.removeCallbacks(this);
            if (ui == null) return;
            long left = Math.max(0, endMs - System.currentTimeMillis());
            if (endMs > 0 && left == 0) { finish(); return; }
            long s = left / 1000, h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
            ui.countdown.setText(h > 0
                ? String.format(java.util.Locale.US, "%d:%02d:%02d", h, m, sec)
                : String.format(java.util.Locale.US, "%02d:%02d", m, sec));
            handler.postDelayed(this, 1000);
        }
    };

    private void goHome() {
        Intent h = new Intent(Intent.ACTION_MAIN);
        h.addCategory(Intent.CATEGORY_HOME);
        h.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(h); } catch (Throwable ignored) {}
        finish();
    }

    @Override
    public void onBackPressed() { goHome(); }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(tick);
        handler.removeCallbacks(autoHome);
        super.onDestroy();
    }
}
