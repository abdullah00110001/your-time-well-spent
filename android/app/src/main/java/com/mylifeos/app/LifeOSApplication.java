package com.mylifeos.app;

import android.app.Application;

/**
 * Starts the file logger for EVERY process entry point — not only when the
 * user opens the app. Accessibility service, boot receiver, Shield guard and
 * the Sleep to Rise lock alarms all run without MainActivity; before this,
 * their log lines were silently dropped because LifeLog was never initialised.
 */
public class LifeOSApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        try {
            LifeLog.init(this);
            LifeLog.i("App", "Application.onCreate");
        } catch (Throwable ignored) {}
    }
}
