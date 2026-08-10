package com.mylifeos.app.shield;

import android.animation.ValueAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * ✨ Light Orb Timer — a real, session-driven floating countdown.
 *
 * This is a FOREGROUND service so it keeps running while the user is in other
 * apps (Android kills plain background services holding overlays).
 *
 * The countdown is NOT an in-memory counter: it is derived from a wall-clock
 * end timestamp persisted in {@link ShieldPreferences}. That means the orb shows
 * the correct remaining time after a process death / service restart, and it can
 * never drift away from the real session length.
 *
 * Interaction:
 *   - drag anywhere (position persisted)
 *   - tap to expand → Pause / Stop / +5 min
 *   - subtle pulse under 5 minutes remaining
 */
public class ShieldFloatingService extends Service {

    private static final String TAG = "ShieldOrb";

    public static final String ACTION_START   = "com.mylifeos.app.shield.ORB_START";
    public static final String ACTION_STOP    = "com.mylifeos.app.shield.ORB_STOP";
    public static final String ACTION_PAUSE   = "com.mylifeos.app.shield.ORB_PAUSE";
    public static final String ACTION_RESUME  = "com.mylifeos.app.shield.ORB_RESUME";
    public static final String ACTION_ADD     = "com.mylifeos.app.shield.ORB_ADD";
    public static final String ACTION_REFRESH = "com.mylifeos.app.shield.ORB_REFRESH_STYLE";

    public static final String EXTRA_MINUTES = "minutes";

    private static final String CHANNEL_ID = "shield_orb_timer";
    private static final int NOTIF_ID = 4711;

    /** Golden accent — Focus Shield V2 palette. No blue. */
    private static final int GOLD  = Color.parseColor("#FFD166");
    private static final int EMBER = Color.parseColor("#FF8C42");
    private static final int SOIL  = Color.parseColor("#1A1410");

    private WindowManager windowManager;
    private WindowManager.LayoutParams params;
    private ShieldPreferences prefs;

    private LinearLayout root;
    private TextView orb;
    private LinearLayout controls;
    private ValueAnimator pulse;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean expanded = false;
    private boolean viewAttached = false;

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            render();
            handler.postDelayed(this, 1000);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new ShieldPreferences(this);
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        startInForeground();
        buildOverlay();
        handler.post(tick);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (action != null) {
            switch (action) {
                case ACTION_START: {
                    int minutes = intent.getIntExtra(EXTRA_MINUTES, 0);
                    if (minutes > 0) prefs.startFocusSession(minutes);
                    break;
                }
                case ACTION_PAUSE:
                    prefs.pauseFocusSession();
                    break;
                case ACTION_RESUME:
                    prefs.resumeFocusSession();
                    break;
                case ACTION_ADD:
                    prefs.addFocusMinutes(intent.getIntExtra(EXTRA_MINUTES, 5));
                    break;
                case ACTION_STOP:
                    prefs.stopFocusSession();
                    stopSelf();
                    return START_NOT_STICKY;
                case ACTION_REFRESH:
                    applyStyle();
                    break;
                default:
                    break;
            }
        }
        render();
        // STICKY so Android restores the orb after a low-memory kill — remaining
        // time is recomputed from the persisted end timestamp, so nothing is lost.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        stopPulse();
        detachOverlay();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    // ─────────────────────────────────────────────────────────────
    // Foreground notification
    // ─────────────────────────────────────────────────────────────

    private void startInForeground() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Focus Timer", NotificationManager.IMPORTANCE_MIN);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }

            Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
            PendingIntent pi = open == null ? null : PendingIntent.getActivity(
                this, 0, open,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                    : PendingIntent.FLAG_UPDATE_CURRENT);

            Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

            b.setContentTitle("Focus session running")
             .setContentText("Your light orb timer is active")
             .setSmallIcon(getApplicationInfo().icon)
             .setOngoing(true);
            if (pi != null) b.setContentIntent(pi);

            startForeground(NOTIF_ID, b.build());
        } catch (Throwable t) {
            Log.w(TAG, "startForeground failed", t);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Overlay construction
    // ─────────────────────────────────────────────────────────────

    private int dp(float v) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private void buildOverlay() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);

        orb = new TextView(this);
        orb.setGravity(Gravity.CENTER);
        orb.setTextColor(SOIL);
        orb.setText("--:--");

        controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setVisibility(View.GONE);
        controls.setPadding(dp(6), dp(6), dp(6), dp(6));
        GradientDrawable panel = new GradientDrawable();
        panel.setCornerRadius(dp(18));
        panel.setColor(Color.parseColor("#E61A1410"));
        panel.setStroke(dp(1), Color.parseColor("#55FFD166"));
        controls.setBackground(panel);

        controls.addView(controlButton("Pause", v -> {
            if (prefs.isFocusSessionPaused()) prefs.resumeFocusSession();
            else prefs.pauseFocusSession();
            render();
        }));
        controls.addView(controlButton("Stop", v -> {
            prefs.stopFocusSession();
            stopSelf();
        }));
        controls.addView(controlButton("+5m", v -> {
            prefs.addFocusMinutes(5);
            render();
        }));

        root.addView(orb);
        LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        clp.topMargin = dp(8);
        root.addView(controls, clp);

        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = prefs.getTimerX();
        params.y = prefs.getTimerY();

        applyStyle();
        setupTouch();

        try {
            windowManager.addView(root, params);
            viewAttached = true;
        } catch (Throwable t) {
            // Overlay permission missing/revoked — fail quietly instead of crashing
            // the whole Shield process.
            Log.e(TAG, "Cannot attach orb overlay (missing overlay permission?)", t);
            stopSelf();
        }
    }

    private TextView controlButton(String label, View.OnClickListener onClick) {
        TextView t = new TextView(this);
        t.setText(label);
        t.setTextColor(GOLD);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        t.setPadding(dp(12), dp(6), dp(12), dp(6));
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(14));
        bg.setColor(Color.parseColor("#22FFD166"));
        t.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.leftMargin = dp(4);
        lp.rightMargin = dp(4);
        t.setLayoutParams(lp);
        t.setOnClickListener(onClick);
        return t;
    }

    /** Applies user style prefs (size / opacity) to the orb. */
    private void applyStyle() {
        if (orb == null) return;
        int sizePx = dp(Math.max(44, Math.min(112, prefs.getOrbSize())));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(sizePx, sizePx);
        orb.setLayoutParams(lp);
        orb.setTextSize(TypedValue.COMPLEX_UNIT_PX, sizePx * 0.26f);
        orb.setAlpha(Math.max(0.3f, Math.min(1f, prefs.getFloatingTimerOpacity())));
        orb.setBackground(orbBackground(GOLD));
        if (viewAttached && root != null) {
            try { windowManager.updateViewLayout(root, params); } catch (Throwable ignored) {}
        }
    }

    private GradientDrawable orbBackground(int centerColor) {
        GradientDrawable g = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR, new int[]{ centerColor, EMBER });
        g.setShape(GradientDrawable.OVAL);
        g.setStroke(dp(2), Color.parseColor("#66FFFFFF"));
        return g;
    }

    // ─────────────────────────────────────────────────────────────
    // Touch: drag + tap-to-expand
    // ─────────────────────────────────────────────────────────────

    private void setupTouch() {
        orb.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float downX, downY;
            private long downAt;
            private boolean dragged;

            @Override public boolean onTouch(View v, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        downX = event.getRawX();
                        downY = event.getRawY();
                        downAt = System.currentTimeMillis();
                        dragged = false;
                        return true;
                    case MotionEvent.ACTION_MOVE: {
                        int dx = (int) (event.getRawX() - downX);
                        int dy = (int) (event.getRawY() - downY);
                        if (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6)) dragged = true;
                        params.x = initialX + dx;
                        params.y = initialY + dy;
                        try { windowManager.updateViewLayout(root, params); } catch (Throwable ignored) {}
                        return true;
                    }
                    case MotionEvent.ACTION_UP:
                        if (!dragged && System.currentTimeMillis() - downAt < 400) {
                            toggleExpanded();
                        } else {
                            prefs.setTimerPosition(params.x, params.y);
                        }
                        return true;
                    default:
                        return false;
                }
            }
        });
    }

    private void toggleExpanded() {
        expanded = !expanded;
        controls.setVisibility(expanded ? View.VISIBLE : View.GONE);
        // Auto-collapse so the panel never gets stuck open over another app.
        handler.removeCallbacks(collapse);
        if (expanded) handler.postDelayed(collapse, 6000);
        render();
    }

    private final Runnable collapse = () -> {
        expanded = false;
        if (controls != null) controls.setVisibility(View.GONE);
    };

    // ─────────────────────────────────────────────────────────────
    // Rendering
    // ─────────────────────────────────────────────────────────────

    private void render() {
        if (orb == null) return;

        long remainingMs = prefs.getFocusRemainingMs();
        boolean paused = prefs.isFocusSessionPaused();

        if (!prefs.hasFocusSession()) {
            orb.setText("--:--");
            stopPulse();
            return;
        }

        if (remainingMs <= 0) {
            // Session finished — clear state and retire the orb cleanly.
            prefs.stopFocusSession();
            orb.setText("Done");
            handler.postDelayed(this::stopSelf, 1200);
            return;
        }

        long totalSec = remainingMs / 1000;
        long h = totalSec / 3600;
        long m = (totalSec % 3600) / 60;
        long s = totalSec % 60;

        String text;
        if (prefs.isOrbShowSeconds()) {
            text = h > 0 ? String.format("%d:%02d:%02d", h, m, s) : String.format("%02d:%02d", m, s);
        } else {
            text = h > 0 ? String.format("%dh%02d", h, m) : String.format("%dm", Math.max(1, m));
        }
        orb.setText(paused ? "❚❚" : text);

        boolean nearEnd = remainingMs <= 5 * 60_000L && !paused;
        if (nearEnd && prefs.isOrbPulseEnabled()) startPulse(); else stopPulse();
    }

    // ─────────────────────────────────────────────────────────────
    // Pulse animation (subtle, ≤300ms per half cycle feel)
    // ─────────────────────────────────────────────────────────────

    private void startPulse() {
        if (pulse != null && pulse.isRunning()) return;
        pulse = ValueAnimator.ofFloat(1f, 1.07f);
        pulse.setDuration(900);
        pulse.setRepeatMode(ValueAnimator.REVERSE);
        pulse.setRepeatCount(ValueAnimator.INFINITE);
        pulse.addUpdateListener(a -> {
            float f = (float) a.getAnimatedValue();
            orb.setScaleX(f);
            orb.setScaleY(f);
        });
        pulse.start();
    }

    private void stopPulse() {
        if (pulse != null) {
            pulse.cancel();
            pulse = null;
        }
        if (orb != null) {
            orb.setScaleX(1f);
            orb.setScaleY(1f);
        }
    }

    private void detachOverlay() {
        if (viewAttached && root != null) {
            try { windowManager.removeView(root); } catch (Throwable ignored) {}
            viewAttached = false;
        }
    }
}
