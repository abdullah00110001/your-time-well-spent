package com.mylifeos.app.shield;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import com.mylifeos.app.shield.core.BlockLoopGuard;
import com.mylifeos.app.shield.core.ShieldBlockCard;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * [SHIELD-CARD] Fallback host for the Shield block card.
 *
 * The card is normally drawn as an overlay (see BlockEnforcer.presentShield).
 * This activity is only used when no overlay could be drawn. The UI is the
 * exact same {@link ShieldBlockCard}; all launch-loop protection is unchanged.
 */
public class ShieldBlockActivity extends Activity {

    private static final String TAG = "ShieldBlockActivity";

    /** Max times this activity may be (re)launched inside the rolling window before it's a loop. */
    private static final int MAX_LAUNCHES_IN_WINDOW = 3;

    /** Rolling window used to detect relaunch loops. */
    private static final long LAUNCH_WINDOW_MS = 20_000;

    /** Number of synthetic triggers registered against BlockLoopGuard to force it into its
     *  built-in global backoff state (it enters backoff once its internal cap, currently 6,
     *  is exceeded inside its own 15s window). Using a margin above that keeps this resilient
     *  to internal tuning without needing BlockLoopGuard to expose new API. */
    private static final int LOOP_GUARD_DISARM_TRIGGER_COUNT = 8;

    /** Process-wide record of recent launch timestamps for THIS activity — used purely for the
     *  hard loop-breaker below (independent of, but complementary to, BlockLoopGuard). */
    private static final Deque<Long> recentLaunchTimestamps = new ArrayDeque<>();

    /** Shared BlockLoopGuard instance so state (cooldowns/backoff) persists across re-launches
     *  of this activity instead of being reset every time a fresh instance is created. */
    private static volatile BlockLoopGuard sSharedLoopGuard;

    /** Guards against more than one live instance of this activity stacking on top of itself. */
    private static volatile boolean sInstanceActive = false;

    private boolean finishHandled = false;
    /** True only for the instance that set sInstanceActive; a rejected duplicate must not clear it. */
    private boolean ownsInstance = false;
    private String blockedPackage;

    private static synchronized BlockLoopGuard getSharedLoopGuard(Context context) {
        if (sSharedLoopGuard == null) {
            sSharedLoopGuard = new BlockLoopGuard(context.getApplicationContext());
        }
        return sSharedLoopGuard;
    }

    /** True while a block activity is on screen. */
    public static boolean isActive() {
        return sInstanceActive;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ShieldAccessibilityService.dismissBlockingOverlay();

        blockedPackage = getIntent().getStringExtra("BLOCKED_PACKAGE");

        // ============================================================
        // Double-launch guard: if another instance of this activity
        // is already showing, don't stack a second one on top.
        // ============================================================
        if (sInstanceActive) {
            Log.w(TAG, "ShieldBlockActivity already active — ignoring duplicate launch for pkg=" + blockedPackage);
            safeFinish();
            return;
        }

        // ============================================================
        // HARD LOOP-BREAKER
        // If this activity has been launched too many times in a short
        // rolling window (e.g. forceUserToHome() -> onUserLeaveHint() ->
        // accessibility service re-triggers it), stop showing the block
        // screen and disarm blocking for a cooldown period instead.
        // ============================================================
        if (isRelaunchLoop()) {
            Log.w(TAG, "Loop-breaker tripped: ShieldBlockActivity relaunched " + MAX_LAUNCHES_IN_WINDOW
                + "+ times within " + LAUNCH_WINDOW_MS + "ms (pkg=" + blockedPackage
                + "). Skipping block screen and disarming blocking via BlockLoopGuard cooldown.");
            disarmLoopGuardCooldown(blockedPackage);
            safeFinish();
            return;
        }

        sInstanceActive = true;
        ownsInstance = true;

        // Vibration
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(200);
                }
            }
        } catch (Exception ignored) {}

        try {
            Window w = getWindow();
            w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
            // [SHIELD-CARD] card-only: no painted backdrop behind it, even in this fallback host.
            w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        } catch (Throwable ignored) {}

        final ShieldBlockCard.Callbacks callbacks = new ShieldBlockCard.Callbacks() {
            @Override public void onHome() { forceUserToHome(); }
            @Override public void onGhost() { dismissAsAccidentalTrigger(); }
        };

        View content;
        try {
            ShieldBlockCard.Spec spec = ShieldBlockCard.Spec.fromIntent(this, getIntent(), true);
            content = ShieldBlockCard.build(this, spec, callbacks);
        } catch (Throwable t) {
            // Never leave the person without a way out because of a rendering bug.
            Log.e(TAG, "Block card failed, using plain fallback", t);
            content = ShieldBlockCard.fallback(this, "Stay focused",
                "This app is blocked right now.", callbacks);
        }
        setContentView(content);
    }

    // ==========================================
    // Loop detection / disarm helpers
    // ==========================================

    private static synchronized boolean isRelaunchLoop() {
        long now = System.currentTimeMillis();
        while (!recentLaunchTimestamps.isEmpty()
            && now - recentLaunchTimestamps.peekFirst() > LAUNCH_WINDOW_MS) {
            recentLaunchTimestamps.pollFirst();
        }
        recentLaunchTimestamps.addLast(now);
        return recentLaunchTimestamps.size() > MAX_LAUNCHES_IN_WINDOW;
    }

    /**
     * Uses BlockLoopGuard's own public API (rather than any new/duplicated cooldown logic) to
     * push it into its built-in global backoff state, effectively disarming further block
     * actions for its BACKOFF_COOLDOWN_MS window.
     */
    private void disarmLoopGuardCooldown(String packageName) {
        try {
            BlockLoopGuard guard = getSharedLoopGuard(this);
            String pkg = packageName != null ? packageName : "unknown";
            for (int i = 0; i < LOOP_GUARD_DISARM_TRIGGER_COUNT; i++) {
                guard.registerTrigger(pkg);
            }
            // Evaluating any of the should*Block methods after exceeding the internal cap causes
            // BlockLoopGuard to enter its own backoff state as a side effect.
            guard.shouldForceHardBlock(pkg);
            Log.w(TAG, "BlockLoopGuard disarmed for cooldown after relaunch-loop detection (pkg=" + pkg + ")");
        } catch (Exception e) {
            Log.e(TAG, "Failed to disarm BlockLoopGuard after loop detection", e);
        }
    }

    private void dismissAsAccidentalTrigger() {
        try {
            if (blockedPackage != null) {
                // Clear escalation state so the user gets a short grace period before this
                // package can trip a hard block again — no offense/trigger is registered.
                getSharedLoopGuard(this).reset(blockedPackage);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to register grace period with BlockLoopGuard", e);
        }
        Log.d(TAG, "User dismissed block screen as accidental trigger (pkg=" + blockedPackage + ")");
        forceUserToHome();
    }

    private void forceUserToHome() {
        try {
            Intent startMain = new Intent(Intent.ACTION_MAIN);
            startMain.addCategory(Intent.CATEGORY_HOME);
            startMain.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(startMain);
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch home screen", e);
        }
        safeFinish();
    }

    /**
     * Idempotent finish — forceUserToHome(), onUserLeaveHint() and onBackPressed() can all race
     * to finish this activity; make sure we only ever act on the first one.
     */
    private void safeFinish() {
        if (finishHandled) return;
        finishHandled = true;
        if (!isFinishing()) {
            finish();
        }
    }

    @Override
    public void onBackPressed() {
        forceUserToHome();
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        safeFinish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (ownsInstance) {
            sInstanceActive = false;
            ownsInstance = false;
        }
    }
}
