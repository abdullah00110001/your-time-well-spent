package com.mylifeos.app;

import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.mylifeos.app.plugins.PureShieldPlugin;
import com.mylifeos.app.plugins.ShieldPlugin;
import com.mylifeos.app.plugins.RiseAlarmPlugin;
import com.mylifeos.app.plugins.BarcodeScannerPlugin;
import com.mylifeos.app.plugins.NativeRingtonePickerPlugin;
import com.mylifeos.app.rise.state.AlarmStateManager;

import com.mylifeos.app.plugins.AppUpdatePlugin;
import com.mylifeos.app.plugins.PhotoPickerPlugin;
public class MainActivity extends BridgeActivity {
  private static MainActivity instance;

  /** True whenever MainActivity is actually visible/resumed. */
  public static volatile boolean isForeground = false;

  private final Handler reBringHandler = new Handler(Looper.getMainLooper());
  private Runnable reBringRunnable;
  private static final long RE_BRING_DELAY_MS = 3000;

  @Override
  public void onUserLeaveHint() {
    super.onUserLeaveHint();
    if (!AlarmStateManager.isRinging(this)) return;

    if (reBringRunnable != null) reBringHandler.removeCallbacks(reBringRunnable);
    reBringRunnable = () -> {
      if (!AlarmStateManager.isRinging(this)) return;
      try {
        Intent bring = new Intent(this, MainActivity.class);
        bring.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(bring);
      } catch (Throwable t) {
        Log.e("MainActivity", "re-bring failed", t);
      }
    };
    reBringHandler.postDelayed(reBringRunnable, RE_BRING_DELAY_MS);
  }

  private void cancelReBring() {
    if (reBringRunnable != null) {
      reBringHandler.removeCallbacks(reBringRunnable);
      reBringRunnable = null;
    }
  }

  private static boolean isAlarmLaunch(Intent intent) {
    if (intent == null) return false;
    if (intent.getBooleanExtra("RISE_ALARM_RING", false)) return true;
    if (intent.hasExtra("ALARM_ID")) return true;
    Uri d = intent.getData();
    return d != null && d.toString().contains("/rise/ring/");
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    boolean alarmLaunch = isAlarmLaunch(getIntent());
    if (alarmLaunch) {
      try { setTheme(R.style.AppTheme_AlarmLaunch); } catch (Throwable ignored) {}
    }
    try { registerPlugin(ShieldPlugin.class); } catch (Throwable t) { Log.e("MainActivity", "ShieldPlugin register failed", t); }
    try { registerPlugin(RiseAlarmPlugin.class); } catch (Throwable t) { Log.e("MainActivity", "RiseAlarmPlugin register failed", t); }
    try { registerPlugin(PureShieldPlugin.class); } catch (Throwable t) { Log.e("MainActivity", "PureShieldPlugin register failed", t); }
    try { registerPlugin(BarcodeScannerPlugin.class); } catch (Throwable t) { Log.e("MainActivity", "BarcodeScannerPlugin register failed", t); }
    try { registerPlugin(NativeRingtonePickerPlugin.class); } catch (Throwable t) { Log.e("MainActivity", "NativeRingtonePickerPlugin register failed", t); }
    try { registerPlugin(com.mylifeos.app.nighttorise.NightToRisePlugin.class); } catch (Throwable t) { Log.e("MainActivity", "NightToRisePlugin register failed", t); }
    try { registerPlugin(PhotoPickerPlugin.class); } catch (Throwable t) { Log.e("MainActivity", "PhotoPickerPlugin register failed", t); }
    try { registerPlugin(AppUpdatePlugin.class); } catch (Throwable t) { Log.e("MainActivity", "AppUpdatePlugin register failed", t); }
    super.onCreate(savedInstanceState);
    instance = this;

    // Do not start the polling foreground service from the activity's cold-start
    // path. MainActivity is opened by notifications, deep links, and the system
    // launcher; forcing a service start here made every launch perform an
    // ActivityManager transaction while the WebView and accessibility stack were
    // still initializing. BootReceiver and the settings plugins already start
    // the guard when protection is enabled. This keeps opening the app passive.
    try { ensureWakeUpChannel(); } catch (Throwable t) { Log.e("MainActivity", "ensureWakeUpChannel failed", t); }
    if (alarmLaunch) {
      try {
        int bg = 0xFF120C10;
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(bg));
        if (getBridge() != null && getBridge().getWebView() != null) {
          getBridge().getWebView().setBackgroundColor(bg);
        }
      } catch (Throwable t) { Log.e("MainActivity", "alarm surface tint failed", t); }
    }
    try { handleAlarmIntent(getIntent()); } catch (Throwable t) { Log.e("MainActivity", "handleAlarmIntent failed", t); }
  }

  private void ensureWakeUpChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    // Notification channels are persistent. Deleting/recreating this channel on
    // every app launch caused unnecessary system_server churn and reset user
    // notification settings. Creation is idempotent; leave an existing channel
    // untouched so the user's settings remain authoritative.
    if (nm.getNotificationChannel("wakeup_channel") != null) return;
    NotificationChannel ch = new NotificationChannel(
      "wakeup_channel", "Wake-up calls", NotificationManager.IMPORTANCE_HIGH);
    ch.setDescription("Wake-up requests from your group — rings like an alarm");
    ch.enableVibration(true);
    ch.setVibrationPattern(new long[]{0, 600, 300, 600, 300, 600});
    ch.enableLights(true);
    ch.setBypassDnd(true);
    ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
    AudioAttributes attrs = new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build();
    android.net.Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
    if (alarmUri == null) alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
    ch.setSound(alarmUri, attrs);
    ch.setShowBadge(true);
    nm.createNotificationChannel(ch);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleAlarmIntent(intent);
  }

  private void handleAlarmIntent(Intent intent) {
    if (intent == null) return;
    Uri data = intent.getData();
    if (data != null && "capacitor".equals(data.getScheme())) {
      enableLockScreenTakeover();
      Log.d("RiseAlarm", "Deep link received: " + data.toString());
      return;
    }
    if (intent.hasExtra("ALARM_ID")) {
      enableLockScreenTakeover();
      String alarmId = intent.getStringExtra("ALARM_ID");
      if (alarmId == null) alarmId = String.valueOf(intent.getIntExtra("ALARM_ID", -1));
      getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
          .edit().putString("ringing_alarm_id", alarmId).apply();
      Log.d("RiseAlarm", "Alarm via extra ID: " + alarmId);
    }
  }

  private void enableLockScreenTakeover() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
      KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
      if (km != null) km.requestDismissKeyguard(this, null);
    } else {
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
  }

  public static void disableLockScreenTakeover() {
    if (instance != null) instance.runOnUiThread(() -> {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        instance.setShowWhenLocked(false); instance.setTurnScreenOn(false);
      }
      instance.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    });
  }

  @Override public void onResume() { super.onResume(); isForeground = true; cancelReBring(); }
  @Override public void onPause() { super.onPause(); isForeground = false; }
  @Override public void onDestroy() { isForeground = false; cancelReBring(); super.onDestroy(); }
}
