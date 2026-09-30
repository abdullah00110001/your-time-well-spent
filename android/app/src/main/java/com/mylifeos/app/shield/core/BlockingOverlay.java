package com.mylifeos.app.shield.core;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

// [N2R-CARD] card-only Sleep/Rise block, shared with the Activity fallback.
import com.mylifeos.app.nighttorise.NightToRiseBlockCard;

/**
 * Reliable full-screen block surface.
 *
 * Two independent render paths, because they fail for different reasons:
 *  - {@link #show} uses TYPE_ACCESSIBILITY_OVERLAY and needs the accessibility
 *    service to be connected.
 *  - {@link #showSystem} uses TYPE_APPLICATION_OVERLAY and needs only
 *    "Display over other apps". This is the last-resort tier used when
 *    accessibility itself is the thing that is down, which is exactly the case
 *    where every other delivery path silently no-ops on Android 14/15.
 */
public final class BlockingOverlay {
    private static View activeView;
    private static WindowManager activeWindowManager;

    private BlockingOverlay() {}

    public static synchronized boolean show(
        AccessibilityService service,
        boolean sleepToRise,
        boolean rise,
        String title,
        String message,
        Runnable onHome
    ) {
        if (service == null) return false;
        return render(service, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            sleepToRise, rise, title, message, onHome);
    }

    /** Accessibility-independent tier. Requires SYSTEM_ALERT_WINDOW only. */
    public static synchronized boolean showSystem(
        Context ctx,
        boolean sleepToRise,
        boolean rise,
        String title,
        String message,
        Runnable onHome
    ) {
        if (ctx == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
                return false;
            }
        } catch (Throwable ignored) {
            return false;
        }
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        return render(ctx.getApplicationContext(), type, sleepToRise, rise, title, message, onHome);
    }

    private static boolean render(
        Context ctx,
        int windowType,
        boolean sleepToRise,
        boolean rise,
        String title,
        String message,
        Runnable onHome
    ) {
        if (!sleepToRise) {
            // [SHIELD-CARD] Shield blocks always use the shared card (Sleep/Rise path below is untouched).
            return renderCard(ctx, windowType, ShieldBlockCard.Spec.generic(title, message), onHome);
        }
        hide();
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return false;

            // [N2R-CARD] Sleep/Rise: card-only, nothing painted behind it. The old
            // full-screen gradient path below is left in place, untouched, as the
            // fallback for a Shield-only app block (sleepToRise == false).
            if (sleepToRise) {
                return renderNightCard(ctx, windowType, rise, title, message, onHome);
            }

            LinearLayout root = new LinearLayout(ctx);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setGravity(Gravity.CENTER);
            root.setClickable(true);
            root.setFocusable(true);
            root.setPadding(dp(ctx, 32), dp(ctx, 56), dp(ctx, 32), dp(ctx, 40));
            int[] colors = sleepToRise
                ? (rise ? new int[]{0xff321d43, 0xffb95658, 0xfff09a48}
                        : new int[]{0xff090f24, 0xff18173f, 0xff302267})
                : new int[]{0xff111827, 0xff1f2937, 0xff0b0f16};
            root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors));

            TextView icon = text(ctx, sleepToRise ? (rise ? "☀" : "☾") : "◆", 48, Color.WHITE);
            icon.setGravity(Gravity.CENTER);
            root.addView(icon, matchWrap());

            TextView heading = text(ctx, title, 30, Color.WHITE);
            heading.setTypeface(null, Typeface.BOLD);
            heading.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams headingLp = matchWrap();
            headingLp.topMargin = dp(ctx, 24);
            root.addView(heading, headingLp);

            TextView body = text(ctx, message, 16, 0xddffffff);
            body.setGravity(Gravity.CENTER);
            body.setLineSpacing(0, 1.25f);
            LinearLayout.LayoutParams bodyLp = matchWrap();
            bodyLp.topMargin = dp(ctx, 14);
            bodyLp.bottomMargin = dp(ctx, 42);
            root.addView(body, bodyLp);

            Button home = new Button(ctx);
            home.setText(sleepToRise ? "Return to Home" : "Go Back Home");
            home.setTextSize(16);
            home.setTextColor(0xff172033);
            home.setAllCaps(false);
            home.setTypeface(null, Typeface.BOLD);
            GradientDrawable buttonBg = new GradientDrawable();
            buttonBg.setColor(Color.WHITE);
            buttonBg.setCornerRadius(dp(ctx, 28));
            home.setBackground(buttonBg);
            home.setOnClickListener(v -> {
                hide();
                if (onHome != null) onHome.run();
            });
            LinearLayout.LayoutParams buttonLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(ctx, 56));
            root.addView(home, buttonLp);

            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                windowType,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
            lp.gravity = Gravity.TOP | Gravity.START;
            wm.addView(root, lp);
            activeView = root;
            activeWindowManager = wm;
            return true;
        } catch (Throwable ignored) {
            hide();
            return false;
        }
    }

    // [SHIELD-CARD] ---------------------------------------------------------------
    // Shield block card. Overlay tier 1 (accessibility) and tier 2 (system overlay).
    // ---------------------------------------------------------------------------
    private static final long CARD_FAILSAFE_MS = 30_000L;
    private static final Handler cardHandler = new Handler(Looper.getMainLooper());

    public static synchronized boolean showCard(
        AccessibilityService service, ShieldBlockCard.Spec spec, Runnable onHome
    ) {
        if (service == null || spec == null) return false;
        return renderCard(service, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, spec, onHome);
    }

    public static synchronized boolean showCardSystem(
        Context ctx, ShieldBlockCard.Spec spec, Runnable onHome
    ) {
        if (ctx == null || spec == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
                return false;
            }
        } catch (Throwable ignored) {
            return false;
        }
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        return renderCard(ctx.getApplicationContext(), type, spec, onHome);
    }

    private static boolean renderCard(
        Context ctx, int windowType, ShieldBlockCard.Spec spec, Runnable onHome
    ) {
        hide();
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return false;

            final ShieldBlockCard.Callbacks cb = new ShieldBlockCard.Callbacks() {
                @Override public void onHome() {
                    hide();
                    if (onHome != null) onHome.run();
                }
                @Override public void onGhost() { onHome(); }
            };

            View root;
            try {
                root = ShieldBlockCard.build(ctx, spec, cb);
            } catch (Throwable t) {
                root = ShieldBlockCard.fallback(ctx, spec.title, spec.sub, cb);
            }
            root.setFocusableInTouchMode(true);
            root.setOnKeyListener((v, keyCode, event) -> {
                if (keyCode == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
                    cb.onHome();
                    return true;
                }
                return false;
            });

            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                windowType,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
            lp.gravity = Gravity.TOP | Gravity.START;
            wm.addView(root, lp);
            activeView = root;
            activeWindowManager = wm;
            try { root.requestFocus(); } catch (Throwable ignored) {}

            // Safety valve: the card can never stay on screen forever.
            final View shown = root;
            cardHandler.postDelayed(() -> {
                synchronized (BlockingOverlay.class) {
                    if (activeView == shown) hide();
                }
            }, CARD_FAILSAFE_MS);
            return true;
        } catch (Throwable ignored) {
            hide();
            return false;
        }
    }

    // [N2R-CARD] -----------------------------------------------------------------
    private static boolean renderNightCard(
        Context ctx, int windowType, boolean rise, String title, String message, Runnable onHome
    ) {
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return false;

            android.widget.FrameLayout outer = new android.widget.FrameLayout(ctx);
            outer.setClickable(true);
            outer.setFocusable(true);

            NightToRiseBlockCard.Handles ui = NightToRiseBlockCard.build(ctx, rise);
            if (title != null && !title.isEmpty()) ui.title.setText(title);
            if (message != null && !message.isEmpty()) ui.message.setText(message);
            ui.countdown.setText("");
            ui.countdownBox.setVisibility(View.GONE);
            ui.override.setVisibility(View.GONE);
            ui.home.setOnClickListener(v -> {
                hide();
                if (onHome != null) onHome.run();
            });
            outer.addView(ui.root, new android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT));

            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                windowType,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
            lp.gravity = Gravity.TOP | Gravity.START;
            wm.addView(outer, lp);
            activeView = outer;
            activeWindowManager = wm;

            // [N2R-REBOOT-FIX] Same safety valve Shield's card already has: this
            // surface can never stay on screen forever, no matter what triggered it.
            final View shown = outer;
            cardHandler.postDelayed(() -> {
                synchronized (BlockingOverlay.class) {
                    if (activeView == shown) hide();
                }
            }, CARD_FAILSAFE_MS);
            return true;
        } catch (Throwable ignored) {
            hide();
            return false;
        }
    }

    public static synchronized void hide() {
        if (activeView != null && activeWindowManager != null) {
            try { activeWindowManager.removeViewImmediate(activeView); }
            catch (Throwable ignored) {}
        }
        activeView = null;
        activeWindowManager = null;
    }

    private static TextView text(Context ctx, String value, int size, int color) {
        TextView view = new TextView(ctx);
        view.setText(value == null ? "" : value);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }

    private static LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private static int dp(Context ctx, int value) {
        return Math.round(value * ctx.getResources().getDisplayMetrics().density);
    }
}
