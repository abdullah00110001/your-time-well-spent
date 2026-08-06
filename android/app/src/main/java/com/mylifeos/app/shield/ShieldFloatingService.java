package com.mylifeos.app.shield;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

public class ShieldFloatingService extends Service {

    private WindowManager windowManager;
    private TextView floatingTimerView;
    private WindowManager.LayoutParams params;
    private ShieldPreferences prefs;
    
    private Handler handler = new Handler(Looper.getMainLooper());
    private int secondsElapsed = 0; // ডেমো টাইমার

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new ShieldPreferences(this);
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        // ১. টাইমার ডিজাইন (UI)
        floatingTimerView = new TextView(this);
        floatingTimerView.setText("00:00:00");
        floatingTimerView.setTextColor(Color.WHITE);
        floatingTimerView.setTextSize(prefs.getFloatingTimerSize());
        floatingTimerView.setPadding(30, 15, 30, 15);
        floatingTimerView.setAlpha(prefs.getFloatingTimerOpacity());

        // ২. রাউন্ড ব্যাকগ্রাউন্ড (সবুজ রঙ)
        GradientDrawable shape = new GradientDrawable();
        shape.setShape(GradientDrawable.RECTANGLE);
        shape.setCornerRadius(20f);
        shape.setColor(Color.parseColor("#00BFA5")); // সুন্দর সবুজ
        floatingTimerView.setBackground(shape);

        // ৩. ওভারলে প্যারামিটার
        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);

        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = prefs.getTimerX();
        params.y = prefs.getTimerY();

        windowManager.addView(floatingTimerView, params);

        // ৪. Drag & Drop লজিক (স্ক্রিনে সরানোর জন্য)
        setupDraggable();

        // ৫. টাইমার আপডেট লজিক শুরু
        startTimer();
    }

    private void setupDraggable() {
        floatingTimerView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        params.x = initialX + (int) (event.getRawX() - initialTouchX);
                        params.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(floatingTimerView, params);
                        return true;
                    case MotionEvent.ACTION_UP:
                        // পজিশন সেভ করে রাখা
                        prefs.setTimerPosition(params.x, params.y);
                        return true;
                }
                return false;
            }
        });
    }

    private void startTimer() {
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                secondsElapsed++;
                
                int hours = secondsElapsed / 3600;
                int minutes = (secondsElapsed % 3600) / 60;
                int secs = secondsElapsed % 60;

                String timeString = String.format("%02d:%02d:%02d", hours, minutes, secs);
                
                // Countdown মুড হলে অন্যভাবে দেখাবে (ভবিষ্যতে অ্যাড করা হবে মেইন লজিকের সাথে)
                if(prefs.isCountdownMode()) {
                   // Example: timeString = "- " + timeString;
                }

                floatingTimerView.setText(timeString);
                
                // 🔴 Smart Color Alert: সময় বেশি হয়ে গেলে লাল হয়ে যাবে (উদাহরণস্বরূপ ১০ সেকেন্ড পর)
                if (secondsElapsed > 300) { // ৫ মিনিট
                    GradientDrawable bg = (GradientDrawable) floatingTimerView.getBackground();
                    bg.setColor(Color.parseColor("#E53935")); // লাল
                }

                handler.postDelayed(this, 1000); // ১ সেকেন্ড পর পর আপডেট
            }
        }, 1000);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingTimerView != null) windowManager.removeView(floatingTimerView);
        handler.removeCallbacksAndMessages(null);
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
