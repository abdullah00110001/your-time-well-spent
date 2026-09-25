package com.mylifeos.app.nighttorise;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.mylifeos.app.MainActivity;
import com.mylifeos.app.R;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * GuardTransitionNotifier — posts a one-shot alert whenever a Sleep to Rise
 * guard turns on, turns off, or its timer finishes.
 *
 * The last announced phase is persisted (not just kept in memory) so a service
 * restart / process death doesn't replay the same announcement, and a
 * transition that happens while the guard service was respawning is still
 * detected on the next pass.
 */
public final class GuardTransitionNotifier {

    private static final String TAG = "GuardTransition";
    private static final String CHANNEL_ID = "sleep_to_rise_transitions";
    private static final int NOTIF_ID = 4712;
    private static final String PREFS = "sleep_to_rise_transitions";
    private static final String KEY_LAST_PHASE = "last_announced_phase";

    /**
     * Hard floor between two announcements. Without it, a decision that
     * oscillates on a millisecond boundary (ARMED ↔ LOCK) could post a
     * notification on every single guard pass, which reads to the user as the
     * phone spamming/looping.
     */
    private static final long MIN_INTERVAL_MS = 30_000L;
    private static volatile long lastPostAt = 0L;

    /** In-memory mirror so the common "no change" case never touches disk. */
    private static volatile String cachedPhase = null;

    private GuardTransitionNotifier() {}

    /** Call on every guard pass with the current decision. */
    public static void onDecision(Context ctx, NightToRiseManager.Decision d) {
        if (ctx == null || d == null) return;
        try {
            String current = d.phase.name();
            // Fast path: nothing changed since the last pass — no disk, no work.
            if (current.equals(cachedPhase)) return;

            SharedPreferences sp = ctx.getApplicationContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String previous = cachedPhase != null ? cachedPhase : sp.getString(KEY_LAST_PHASE, null);
            if (current.equals(previous)) { cachedPhase = current; return; }

            cachedPhase = current;
            // apply() — never commit() — this runs on the guard poll path and a
            // synchronous disk write there is an ANR risk.
            sp.edit().putString(KEY_LAST_PHASE, current).apply();
            if (previous == null) return; // first ever pass — nothing to announce

            long now = System.currentTimeMillis();
            if (now - lastPostAt < MIN_INTERVAL_MS) return; // debounce flapping
            lastPostAt = now;

            String title = null;
            String text = null;
            boolean wasLocking = "SLEEP_LOCK".equals(previous) || "RISE_LOCK".equals(previous);

            switch (current) {
                case "SLEEP_LOCK":
                    title = "🌙 Sleep Guard is on";
                    text = "Only your allowed apps can open" + untilSuffix(d);
                    break;
                case "RISE_LOCK":
                    title = "🌅 Rise Guard is on";
                    text = "Stay up — distractions stay locked" + untilSuffix(d);
                    break;
                case "ARMED":
                    title = wasLocking ? "✅ Guard finished" : "Sleep to Rise is armed";
                    text = wasLocking
                        ? "Your apps are unlocked again."
                        : "Your guards will start on schedule.";
                    break;
                case "PAUSED":
                    title = "⏸️ Sleep to Rise paused";
                    text = "Guards won't run until the pause ends.";
                    break;
                case "INACTIVE_DAY":
                    title = "Sleep to Rise off today";
                    text = "Today isn't part of your schedule.";
                    break;
                case "OFF":
                    title = wasLocking ? "✅ Guard finished" : "Sleep to Rise turned off";
                    text = wasLocking
                        ? "Your apps are unlocked again."
                        : "No guards are scheduled.";
                    break;
                default:
                    return;
            }

            post(ctx, title, text);
        } catch (Throwable t) {
            Log.w(TAG, "transition notify failed", t);
        }
    }

    private static String untilSuffix(NightToRiseManager.Decision d) {
        if (d.endTimeMs <= 0) return "";
        try {
            return " · until "
                + new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date(d.endTimeMs));
        } catch (Throwable t) {
            return "";
        }
    }

    private static void post(Context ctx, String title, String text) {
        NotificationManager nm =
            (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Sleep to Rise alerts", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Tells you when Sleep Guard or Rise Guard starts and ends");
            nm.createNotificationChannel(ch);
        }

        Intent open = new Intent(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            ctx, 12, open,
            PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        Notification n = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pi)
            .build();
        nm.notify(NOTIF_ID, n);
    }
}
