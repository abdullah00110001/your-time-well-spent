package com.mylifeos.app.shield;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.mylifeos.app.MainActivity;
import com.mylifeos.app.R;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Sleep to Rise status notifications. Edit the texts freely.
 *
 *  - armed()   : schedule saved — "next Sleep Guard at 22:30"
 *  - started() : a guard started (ongoing, shows which guard + end time)
 *  - switched(): Sleep Guard handed over to Rise Guard
 *  - ended()   : lock finished, apps unblocked
 *  - cleared() : Sleep to Rise turned off
 */
public final class SleepToRiseNotifier {
    private static final String CHANNEL_STATUS = "sleep_to_rise_status_v1";
    private static final String CHANNEL_EVENTS = "sleep_to_rise_events_v1";
    private static final int ID_ONGOING = 4820;
    private static final int ID_EVENT = 4821;

    private SleepToRiseNotifier() {}

    public static String guardName(String kind) {
        return "rise".equals(kind) ? "Rise Guard" : "Sleep Guard";
    }

    private static String clock(long ms) {
        return new SimpleDateFormat("h:mm a", Locale.US).format(new Date(ms));
    }

    private static String day(long ms) {
        return new SimpleDateFormat("EEE h:mm a", Locale.US).format(new Date(ms));
    }

    public static void armed(Context ctx, String nextKind, long nextStartMs) {
        if (nextStartMs <= 0) return;
        event(ctx, "Sleep to Rise armed",
            guardName(nextKind) + " starts " + day(nextStartMs));
    }

    public static void started(Context ctx, String kind, long endMs, int apps) {
        cancelEvent(ctx);
        String title = guardName(kind) + " is on";
        String body = ("rise".equals(kind) ? "Ease into the day." : "Time to rest.")
            + " Ends " + clock(endMs) + " · " + apps + " apps locked";
        ongoing(ctx, title, body);
    }

    public static void switched(Context ctx, String kind, long endMs, int apps) {
        started(ctx, kind, endMs, apps);
    }

    public static void ended(Context ctx, String nextKind, long nextStartMs) {
        cancelOngoing(ctx);
        String body = "All apps unlocked.";
        if (nextStartMs > 0) body += " Next: " + guardName(nextKind) + " " + day(nextStartMs);
        event(ctx, "Sleep to Rise finished", body);
    }

    public static void cleared(Context ctx) {
        cancelOngoing(ctx);
        event(ctx, "Sleep to Rise turned off", "Apps are no longer locked at night.");
    }

    // ---------------------------------------------------------------

    private static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_STATUS) == null) {
            NotificationChannel c = new NotificationChannel(CHANNEL_STATUS,
                "Sleep to Rise — active guard", NotificationManager.IMPORTANCE_LOW);
            c.setShowBadge(false);
            nm.createNotificationChannel(c);
        }
        if (nm.getNotificationChannel(CHANNEL_EVENTS) == null) {
            NotificationChannel c = new NotificationChannel(CHANNEL_EVENTS,
                "Sleep to Rise — updates", NotificationManager.IMPORTANCE_DEFAULT);
            nm.createNotificationChannel(c);
        }
    }

    private static PendingIntent openApp(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getActivity(ctx, 4822, i, flags);
    }

    private static void ongoing(Context ctx, String title, String body) {
        post(ctx, ID_ONGOING, new NotificationCompat.Builder(ctx, CHANNEL_STATUS)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openApp(ctx))
            .setPriority(NotificationCompat.PRIORITY_LOW));
    }

    private static void event(Context ctx, String title, String body) {
        post(ctx, ID_EVENT, new NotificationCompat.Builder(ctx, CHANNEL_EVENTS)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(openApp(ctx))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT));
    }

    private static void post(Context ctx, int id, NotificationCompat.Builder b) {
        try {
            ensureChannels(ctx);
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(id, b.build());
            com.mylifeos.app.LifeLog.i("N2RNotify", "notify " + id);
        } catch (Throwable t) {
            com.mylifeos.app.LifeLog.e("N2RNotify", "notify failed", t);
        }
    }

    private static void cancelOngoing(Context ctx) { cancel(ctx, ID_ONGOING); }
    private static void cancelEvent(Context ctx) { cancel(ctx, ID_EVENT); }

    private static void cancel(Context ctx, int id) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(id);
        } catch (Throwable ignored) {}
    }
}
