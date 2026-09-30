package com.mylifeos.app;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * LifeLog — detailed on-device file log.
 * Files: Android/data/<appId>/files/logs/lifeos-YYYY-MM-DD.log
 * Every line is written + flushed on a background thread within milliseconds.
 * Crashes are written synchronously before the process dies.
 * Also detects phone restarts (boot time change) on every process start.
 */
public final class LifeLog {
    private static final String TAG = "LifeLog";
    private static final long MAX_FILE_BYTES = 2L * 1024 * 1024;
    private static final int KEEP_DAYS = 7;
    private static volatile Context app;
    private static HandlerThread thread;
    private static Handler handler;

    private LifeLog() {}

    public static synchronized void init(Context ctx) {
        if (app != null) return;
        app = ctx.getApplicationContext();
        thread = new HandlerThread("LifeLog");
        thread.start();
        handler = new Handler(thread.getLooper());
        installCrashHandler();
        handler.post(LifeLog::prune);
        detectRestart();
    }

    public static void i(String src, String msg) { write("INFO", src, msg, null); }
    public static void w(String src, String msg) { write("WARN", src, msg, null); }
    public static void e(String src, String msg, Throwable t) { write("ERROR", src, msg, t); }

    /** Drop-in for android.util.Log.w that also writes to the log file. */
    public static int w2(String tag, String msg) { write("WARN", tag, msg, null); return 0; }
    public static int w2(String tag, String msg, Throwable t) { write("ERROR", tag, msg, t); return 0; }
    public static int i2(String tag, String msg) { write("INFO", tag, msg, null); return 0; }

    public static void write(String level, String src, String msg, Throwable t) {
        final String line = format(level, src, msg, t);
        try { Log.println(level.equals("ERROR") ? Log.ERROR : level.equals("WARN") ? Log.WARN : Log.INFO, "LifeOS/" + src, msg); } catch (Throwable ignored) {}
        Handler h = handler;
        if (h == null) return;
        h.post(() -> append(line));
    }

    private static String format(String level, String src, String msg, Throwable t) {
        String ts = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(new Date());
        StringBuilder sb = new StringBuilder();
        sb.append('[').append(ts).append("] [").append(level).append("] [").append(src).append("] ").append(msg);
        if (t != null) {
            StringWriter sw = new StringWriter();
            t.printStackTrace(new PrintWriter(sw));
            sb.append('\n').append(sw);
        }
        return sb.append('\n').toString();
    }

    public static File dir() {
        Context c = app;
        if (c == null) return null;
        File base = c.getExternalFilesDir(null);
        if (base == null) base = c.getFilesDir();
        File d = new File(base, "logs");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    public static File todayFile() {
        File d = dir();
        if (d == null) return null;
        String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        return new File(d, "lifeos-" + day + ".log");
    }

    private static synchronized void append(String line) {
        try {
            File f = todayFile();
            if (f == null) return;
            if (f.length() > MAX_FILE_BYTES) {
                File old = new File(f.getParentFile(), f.getName() + ".1");
                old.delete();
                f.renameTo(old);
            }
            try (FileOutputStream out = new FileOutputStream(f, true)) {
                out.write(line.getBytes(StandardCharsets.UTF_8));
                out.flush();
                try { out.getFD().sync(); } catch (Throwable ignored) {}
            }
        } catch (Throwable t) {
            Log.w(TAG, "append failed", t);
        }
    }

    private static void prune() {
        try {
            File d = dir();
            File[] files = d == null ? null : d.listFiles();
            if (files == null) return;
            long cutoff = System.currentTimeMillis() - KEEP_DAYS * 86_400_000L;
            for (File f : files) if (f.lastModified() < cutoff) f.delete();
        } catch (Throwable ignored) {}
    }

    private static void installCrashHandler() {
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((th, ex) -> {
            try { append(format("CRASH", "Native", "Uncaught on thread " + th.getName(), ex)); } catch (Throwable ignored) {}
            if (prev != null) prev.uncaughtException(th, ex);
        });
    }

    /** Logs a PHONE RESTART line when the device boot time changed since last process start. */
    private static void detectRestart() {
        try {
            android.content.SharedPreferences p = app.getSharedPreferences("lifelog", Context.MODE_PRIVATE);
            long bootAt = System.currentTimeMillis() - SystemClock.elapsedRealtime();
            long lastBoot = p.getLong("boot_at", 0L);
            long lastAlive = p.getLong("last_alive", 0L);
            String device = Build.MANUFACTURER + " " + Build.MODEL + " / Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")";
            i("Process", "Process started on " + device);
            if (lastBoot > 0 && Math.abs(bootAt - lastBoot) > 60_000L) {
                String fmt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date(bootAt));
                String alive = lastAlive > 0 ? new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date(lastAlive)) : "unknown";
                w("PhoneRestart", "PHONE RESTARTED — booted at " + fmt + ", app last alive at " + alive
                    + ", seconds from last activity to boot: " + ((bootAt - lastAlive) / 1000));
            }
            p.edit().putLong("boot_at", bootAt).apply();
            handler.post(new Runnable() {
                @Override public void run() {
                    try { p.edit().putLong("last_alive", System.currentTimeMillis()).apply(); } catch (Throwable ignored) {}
                    handler.postDelayed(this, 2000);
                }
            });
        } catch (Throwable t) {
            Log.w(TAG, "detectRestart failed", t);
        }
    }

    public static String readToday(int maxChars) {
        try {
            File f = todayFile();
            if (f == null || !f.exists()) return "";
            byte[] b = java.nio.file.Files.readAllBytes(f.toPath());
            String s = new String(b, StandardCharsets.UTF_8);
            return s.length() > maxChars ? s.substring(s.length() - maxChars) : s;
        } catch (Throwable t) {
            return "";
        }
    }
}
