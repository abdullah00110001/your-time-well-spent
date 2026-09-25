package com.mylifeos.app.nighttorise;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.mylifeos.app.shield.ShieldAccessibilityService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * NightToRiseBlockActivity — full-screen lock shown by the accessibility
 * service when the user opens a disallowed app inside a Sleep-to-Rise window.
 *
 * Intent extras:
 *   "message" : String
 *   "endMs"   : long
 *   "strict"  : boolean
 *   "package" : String  (the blocked app, re-checked on resume)
 *   "phase"   : String  ("SLEEP_LOCK" | "RISE_LOCK") — selects icon + accent tint
 *
 * [N2R-CARD] The visuals are the shared card from NightToRiseBlockCard (no
 * painted backdrop — only the card is visible; the window itself is
 * transparent). Every safety behaviour below — kill-switch taps, emergency
 * unlock, strict-mode wait, allowed-app chips, re-check on resume, the
 * swallowed back button — is unchanged from before this visual update.
 */
public class NightToRiseBlockActivity extends Activity {

    public static final String EXTRA_MESSAGE = "message";
    public static final String EXTRA_END_MS  = "endMs";
    public static final String EXTRA_STRICT  = "strict";
    public static final String EXTRA_PACKAGE = "package";
    public static final String EXTRA_PHASE   = "phase";

    // [N2R-REBOOT-FIX] Same loop-breaker ShieldBlockActivity already has. Without
    // this, a re-bind triggered from onResume() (e.g. because a stray overlay
    // briefly stole and returned focus) had no ceiling — bind() rebuilds the
    // whole card (fresh gradients, fresh animator) every single call.
    private static final int MAX_REBINDS_IN_WINDOW = 5;
    private static final long REBIND_WINDOW_MS = 10_000;
    private final java.util.ArrayDeque<Long> recentBinds = new java.util.ArrayDeque<>();

    /** Guards against a second instance of this activity stacking on top of itself. */
    private static volatile boolean sInstanceActive = false;
    /** True only for the instance that set sInstanceActive; a rejected duplicate must not clear it. */
    private boolean ownsInstance = false;

    private static final int KILL_TAP_COUNT = 7;
    private static final long KILL_TAP_WINDOW_MS = 5000;
    private final List<Long> killTaps = new ArrayList<>();

    private CountDownTimer timer;
    private CountDownTimer strictTimer;
    private String blockedPackage;
    private boolean broke = false;

    private NightToRiseBlockCard.Handles ui;

    private static final Map<String, String> FRIENDLY_NAMES = new HashMap<>();
    static {
        FRIENDLY_NAMES.put("com.android.dialer", "Phone");
        FRIENDLY_NAMES.put("com.google.android.dialer", "Phone");
        FRIENDLY_NAMES.put("com.samsung.android.dialer", "Phone");
        FRIENDLY_NAMES.put("com.android.phone", "Phone");
        FRIENDLY_NAMES.put("com.android.server.telecom", "Phone");
        FRIENDLY_NAMES.put("com.android.contacts", "Contacts");
        FRIENDLY_NAMES.put("com.android.deskclock", "Clock");
        FRIENDLY_NAMES.put("com.google.android.deskclock", "Clock");
        FRIENDLY_NAMES.put("com.sec.android.app.clockpackage", "Clock");
        FRIENDLY_NAMES.put("com.android.emergency", "Emergency");
        FRIENDLY_NAMES.put("com.android.systemui", "System");
        FRIENDLY_NAMES.put("com.android.settings", "Settings");
        FRIENDLY_NAMES.put("org.telegram.messenger", "Telegram");
        FRIENDLY_NAMES.put("com.google.android.apps.messaging", "Messages");
    }

    private String friendlyName(String pkg) {
        String known = FRIENDLY_NAMES.get(pkg);
        if (known != null) return known;
        int lastDot = pkg.lastIndexOf('.');
        String tail = lastDot >= 0 && lastDot < pkg.length() - 1 ? pkg.substring(lastDot + 1) : pkg;
        return tail.length() <= 1 ? pkg : Character.toUpperCase(tail.charAt(0)) + tail.substring(1);
    }

    private void breakLock(NightToRisePreferences prefs) {
        broke = true;
        prefs.recordPendingBreak();
        prefs.clearStrictUnlockRequest();
        goHome();
    }

    private void goHome() {
        startActivity(new Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_HOME)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }

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
        // [N2R-REBOOT-FIX] Don't stack a second instance on top of an existing one.
        if (sInstanceActive) {
            finish();
            return;
        }
        sInstanceActive = true;
        ownsInstance = true;
        ShieldAccessibilityService.dismissBlockingOverlay();
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
        // [N2R-CARD] card-only: nothing painted behind it, window stays transparent.
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        bind(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        bind(intent);
    }

    private void bind(Intent intent) {
        // [N2R-REBOOT-FIX] Loop breaker: bind() rebuilds the entire card (fresh
        // gradients + animator) every call. If something keeps re-triggering it
        // faster than a person could possibly be reacting, stop rebuilding and
        // just leave — BlockEnforcer's own dedupe/cooldown will re-present
        // cleanly afterwards if the lock is still active.
        long rebindAt = System.currentTimeMillis();
        recentBinds.addLast(rebindAt);
        while (!recentBinds.isEmpty() && rebindAt - recentBinds.peekFirst() > REBIND_WINDOW_MS) {
            recentBinds.pollFirst();
        }
        if (recentBinds.size() > MAX_REBINDS_IN_WINDOW) {
            broke = true;
            goHome();
            return;
        }

        String message = intent != null ? intent.getStringExtra(EXTRA_MESSAGE) : null;
        long   endMs   = intent != null ? intent.getLongExtra(EXTRA_END_MS, 0L) : 0L;
        boolean strict = intent != null && intent.getBooleanExtra(EXTRA_STRICT, false);
        blockedPackage = intent != null ? intent.getStringExtra(EXTRA_PACKAGE) : null;
        String phase = intent != null ? intent.getStringExtra(EXTRA_PHASE) : null;
        boolean isRise = "RISE_LOCK".equals(phase);

        // [N2R-CARD] (re)build the card fresh for this phase — cheap, and keeps the
        // sleep/rise palette switch (and the icon/copy that go with it) simple and safe.
        ui = NightToRiseBlockCard.build(this, isRise);
        setContentView(ui.root);

        ui.title.setText(isRise ? "Rise with intention" : "Rest now");
        ui.message.setText(message != null ? message
            : (isRise ? "Screens stay closed a little longer." : "Time to rest. Put the phone down."));
        ui.message.setOnClickListener(v -> registerKillSwitchTap());

        final NightToRisePreferences prefs = new NightToRisePreferences(this);
        final NightToRiseManager manager = new NightToRiseManager(this);
        Set<String> available = NightToRiseDecider.effectiveAllowedPackages(manager.snapshot());
        populateAllowedChips(available);

        final Button override = ui.override;

        if (strictTimer != null) { strictTimer.cancel(); strictTimer = null; }

        if (!strict) {
            override.setText("Emergency unlock");
            override.setOnClickListener(v -> breakLock(prefs));
        } else {
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

        TextView countdown = ui.countdown;
        long remaining = Math.max(0, endMs - System.currentTimeMillis());
        if (timer != null) timer.cancel();
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
                recheckOrFinish();
            }
        }.start();

        ui.home.setOnClickListener(v -> goHome());
    }

    /** Builds frosted-glass pill chips (3 per row) for the allowed-apps list. */
    private void populateAllowedChips(Set<String> packages) {
        LinearLayout container = ui.allowedContainer;
        container.removeAllViews();

        // Package ids are noise on a lock screen — show de-duplicated, human
        // names and cap the list so the screen stays calm.
        java.util.LinkedHashSet<String> labels = new java.util.LinkedHashSet<>();
        for (String pkg : packages) {
            if (pkg == null || pkg.trim().isEmpty()) continue;
            labels.add(friendlyName(pkg.trim()));
            if (labels.size() >= 6) break;
        }

        LinearLayout row = null;
        int inRow = 0;
        for (String label : labels) {
            if (row == null || inRow >= 3) {
                row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER);
                LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
                rowLp.topMargin = dp(8);
                container.addView(row, rowLp);
                inRow = 0;
            }
            TextView chip = new TextView(this);
            chip.setText(label);
            chip.setTextSize(11);
            chip.setTextColor(Color.WHITE);
            chip.setPadding(dp(14), dp(7), dp(14), dp(7));
            GradientDrawable pill = new GradientDrawable();
            pill.setColor(Color.parseColor("#26FFFFFF"));
            pill.setStroke(dp(1), Color.parseColor("#40FFFFFF"));
            pill.setCornerRadius(dp(20));
            chip.setBackground(pill);
            LinearLayout.LayoutParams chipLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            chipLp.setMargins(dp(4), 0, dp(4), 0);
            row.addView(chip, chipLp);
            inRow++;
        }
    }

    private int dp(int v) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(v * density);
    }

    private void registerKillSwitchTap() {
        long now = System.currentTimeMillis();
        killTaps.add(now);
        while (!killTaps.isEmpty() && now - killTaps.get(0) > KILL_TAP_WINDOW_MS) {
            killTaps.remove(0);
        }
        if (killTaps.size() >= KILL_TAP_COUNT) {
            new NightToRisePreferences(this).emergencyDisable();
            Toast.makeText(this, "Sleep to Rise turned off", Toast.LENGTH_LONG).show();
            killTaps.clear();
            broke = true;
            goHome();
        }
    }

    private void recheckOrFinish() {
        if (broke) { finish(); return; }
        try {
            NightToRiseManager mgr = new NightToRiseManager(this);
            NightToRiseManager.Decision d =
                mgr.decide(System.currentTimeMillis(), blockedPackage);
            if (d.shouldBlock) {
                Intent again = new Intent(getIntent());
                again.putExtra(EXTRA_MESSAGE, d.message);
                again.putExtra(EXTRA_END_MS, d.endTimeMs);
                again.putExtra(EXTRA_STRICT, mgr.prefs().strictMode());
                again.putExtra(EXTRA_PHASE, d.phase.name());
                bind(again);
                return;
            }
        } catch (Throwable ignored) {}
        finish();
    }

    @Override
    protected void onResume() {
        super.onResume();
        recheckOrFinish();
    }

    @Override public void onBackPressed() { /* swallow */ }

    @Override
    protected void onDestroy() {
        if (timer != null) timer.cancel();
        if (strictTimer != null) strictTimer.cancel();
        if (ownsInstance) {
            sInstanceActive = false;
            ownsInstance = false;
        }
        super.onDestroy();
    }
}
