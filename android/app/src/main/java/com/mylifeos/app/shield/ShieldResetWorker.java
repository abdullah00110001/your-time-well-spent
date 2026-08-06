package com.mylifeos.app.shield;

import android.content.Context;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ShieldResetWorker extends Worker {

    public ShieldResetWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        ShieldPreferences preferences = new ShieldPreferences(getApplicationContext());

        // ১. গতকালের তারিখ নেওয়া
        Date yesterday = new Date(System.currentTimeMillis() - 24 * 60 * 60 * 1000);
        String yesterdayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(yesterday);

        // ২. আজকের টোটাল ইউজ হিস্ট্রিতে সেভ করা
        long totalMinutesUsedToday = preferences.getTodayTotalMinutes();
        preferences.saveDailyHistory(yesterdayDate, totalMinutesUsedToday);

        // ৩. নতুন দিনের জন্য কাউন্টার ০ করে দেওয়া
        preferences.setTodayTotalMinutes(0);

        // ৪. নেক্সট ডে'র জন্য তারিখ আপডেট করা
        String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        preferences.setLastResetDate(todayDate);

        Log.d("ShieldReset", "✅ Midnight Reset Complete. Stats saved for " + yesterdayDate);
        return Result.success();
    }
}