package com.mylifeos.app.rise.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.mylifeos.app.MainActivity;
import com.mylifeos.app.rise.core.AlarmConstants;
import com.mylifeos.app.rise.core.AlarmSettingsPreferences;
import com.mylifeos.app.rise.recovery.AlarmRecoveryReceiver;
import com.mylifeos.app.rise.state.AlarmStateManager;

public class AlarmSoundService extends Service {

    private static final String TAG = "AlarmSoundService";

    // ✅ Recovery keys — extraLoud + soundUri কে state এ save করার জন্য
    private static final String KEY_EXTRA_LOUD = "rise_extra_loud";
    private static final String KEY_SOUND_URI  = "rise_sound_uri";

    public static volatile boolean isRunning = false;

    private MediaPlayer           mediaPlayer;
    private PowerManager.WakeLock wakeLock;
    private AudioManager          audioManager;
    private Vibrator              vibrator;
    private Handler               recoveryHandler;
    private Runnable              recoveryRunnable;
    private Handler               autoStopHandler;
    private Handler               crescendoHandler;

    private AudioFocusRequest audioFocusRequest;

    private int     currentAlarmId;
    private String  currentUuid;
    private String  currentTitle;
    private String  currentBody;
    private String  currentSoundUri;
    private boolean extraLoud = false;

    // ──────────────────────────────────────────
    @Override
    public void onCreate() {
        super.onCreate();
        audioManager     = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        vibrator         = (Vibrator)     getSystemService(Context.VIBRATOR_SERVICE);
        recoveryHandler  = new Handler(Looper.getMainLooper());
        autoStopHandler  = new Handler(Looper.getMainLooper());
        crescendoHandler = new Handler(Looper.getMainLooper());
        Log.d(TAG, "Service created");
    }

    // ──────────────────────────────────────────
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            Log.w(TAG, "Null intent — recovering from state");
            recoverFromState();
            return START_STICKY;
        }

        currentAlarmId  = intent.getIntExtra(AlarmConstants.EXTRA_ALARM_ID, 0);
        currentUuid     = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_UUID);
        currentTitle    = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_TITLE);
        currentBody     = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_BODY);
        extraLoud       = intent.getBooleanExtra("EXTRA_LOUD", false);
        currentSoundUri = intent.getStringExtra("SOUND_URI");

        if (currentUuid  == null) currentUuid  = String.valueOf(currentAlarmId);
        if (currentTitle == null) currentTitle = "Rise Alarm";
        if (currentBody  == null) currentBody  = "Time to wake up!";

        Log.d(TAG, "Starting: id=" + currentAlarmId
                + " uuid=" + currentUuid + " extraLoud=" + extraLoud
                + " sound=" + currentSoundUri);

        // ✅ Fix: extraLoud + soundUri SharedPreferences এ save করো
        // যাতে service kill/restart হলে recovery তে ব্যবহার করা যায়
        saveSoundPrefsToState();

        startForeground(AlarmConstants.NOTIF_ID_SOUND_SERVICE,
                        buildNotification(currentTitle, currentBody, currentUuid, currentAlarmId));

        acquireWakeLock();
        requestAudioFocus();
        forceMaxVolume();
        startSound();
        startVibration();
        scheduleAutoStop();

        AlarmRecoveryReceiver.schedule(this);

        isRunning = true;
        Log.d(TAG, "✅ Service fully started");
        return START_STICKY;
    }

    // ──────────────────────────────────────────
    // ✅ Fix: extraLoud + soundUri state এ save করো
    // ──────────────────────────────────────────
    private void saveSoundPrefsToState() {
        try {
            SharedPreferences prefs = getSharedPreferences(
                AlarmConstants.PREFS_RISE_STATE, Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean(KEY_EXTRA_LOUD, extraLoud)
                .putString(KEY_SOUND_URI, currentSoundUri != null ? currentSoundUri : "")
                .apply();
            Log.d(TAG, "Sound prefs saved: extraLoud=" + extraLoud + " uri=" + currentSoundUri);
        } catch (Exception e) {
            Log.w(TAG, "Failed to save sound prefs", e);
        }
    }

    // ──────────────────────────────────────────
    // ✅ Fix: recovery তে extraLoud + soundUri পড়ো
    // ──────────────────────────────────────────
    private void loadSoundPrefsFromState() {
        try {
            SharedPreferences prefs = getSharedPreferences(
                AlarmConstants.PREFS_RISE_STATE, Context.MODE_PRIVATE);
            extraLoud = prefs.getBoolean(KEY_EXTRA_LOUD, false);
            String savedUri = prefs.getString(KEY_SOUND_URI, "");
            currentSoundUri = (savedUri == null || savedUri.isEmpty()) ? null : savedUri;
            Log.d(TAG, "Sound prefs loaded: extraLoud=" + extraLoud + " uri=" + currentSoundUri);
        } catch (Exception e) {
            Log.w(TAG, "Failed to load sound prefs — using defaults", e);
            extraLoud       = false;
            currentSoundUri = null;
        }
    }

    // ──────────────────────────────────────────
    private void recoverFromState() {
        if (!AlarmStateManager.isRinging(this)) {
            Log.d(TAG, "No active alarm — stopping");
            stopSelf();
            return;
        }
        if (AlarmStateManager.shouldAutoStop(this)) {
            Log.w(TAG, "Auto-stop on recovery");
            AlarmStateManager.clearRinging(this);
            stopSelf();
            return;
        }

        currentAlarmId = AlarmStateManager.getActiveId(this);
        currentUuid    = AlarmStateManager.getActiveUuid(this);
        currentTitle   = AlarmStateManager.getAlarmTitle(this);
        currentBody    = AlarmStateManager.getAlarmBody(this);

        // ✅ Fix: state থেকে extraLoud + soundUri পড়ো (আগে hardcoded false ছিল)
        loadSoundPrefsFromState();

        Log.d(TAG, "Recovered: id=" + currentAlarmId + " uuid=" + currentUuid
                + " extraLoud=" + extraLoud + " sound=" + currentSoundUri);

        startForeground(AlarmConstants.NOTIF_ID_SOUND_SERVICE,
                        buildNotification(currentTitle, currentBody, currentUuid, currentAlarmId));
        acquireWakeLock();
        requestAudioFocus();
        forceMaxVolume();
        startSound();
        startVibration();
        scheduleAutoStop();

        isRunning = true;
    }

    // ──────────────────────────────────────────
    // 🔊 AUDIO FOCUS
    // ──────────────────────────────────────────
    private void requestAudioFocus() {
        if (audioManager == null) return;
        try {
            AudioManager.OnAudioFocusChangeListener focusListener = focusChange -> {
                if (focusChange == AudioManager.AUDIOFOCUS_LOSS ||
                    focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                    Log.w(TAG, "Audio focus lost — re-acquiring in 1s");
                    recoveryHandler.postDelayed(this::requestAudioFocus, 1000);
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(false)
                    .setOnAudioFocusChangeListener(focusListener)
                    .build();
                audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                //noinspection deprecation
                audioManager.requestAudioFocus(focusListener,
                    AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN);
            }
            Log.d(TAG, "Audio focus acquired");
        } catch (Exception e) {
            Log.e(TAG, "requestAudioFocus failed", e);
        }
    }

    // ──────────────────────────────────────────
    // 🔊 FORCE MAX VOLUME
    // ──────────────────────────────────────────
    private void forceMaxVolume() {
        if (audioManager == null) return;
        try {
            int userPct     = AlarmSettingsPreferences.getVolumePct(this);
            int maxAlarm    = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int targetAlarm = Math.max(1, Math.round(maxAlarm * (userPct / 100f)));
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, targetAlarm, 0);

            int maxRing    = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
            int targetRing = Math.max(1, Math.round(maxRing * (userPct / 100f)));
            audioManager.setStreamVolume(AudioManager.STREAM_RING, targetRing, 0);

            try {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            } catch (SecurityException e) {
                Log.w(TAG, "Cannot change ringer mode (DND policy)");
            }
            Log.d(TAG, "Volume set to " + userPct + "% (alarm=" + targetAlarm + "/" + maxAlarm + ")");
        } catch (Exception e) {
            Log.e(TAG, "forceMaxVolume failed", e);
        }
    }

    // ──────────────────────────────────────────
    // 🎵 SOUND
    // ──────────────────────────────────────────
    private void startSound() {
        try {
            releaseMediaPlayer();

            Uri sound = null;
            if (currentSoundUri != null && !currentSoundUri.isEmpty()) {
                try {
                    sound = Uri.parse(currentSoundUri);
                } catch (Exception e) {
                    Log.w(TAG, "Bad SOUND_URI, falling back: " + currentSoundUri);
                    sound = null;
                }
            }
            if (sound == null) {
                String userUri = AlarmSettingsPreferences.getRingtoneUri(this);
                if (userUri != null && !userUri.isEmpty()) {
                    try { sound = Uri.parse(userUri); } catch (Exception ignored) { sound = null; }
                }
            }
            if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                .build());

            try {
                mediaPlayer.setDataSource(this, sound);
            } catch (Exception e) {
                Log.w(TAG, "setDataSource failed for " + sound + ", falling back", e);
                Uri fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (fallback == null) fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                mediaPlayer.reset();
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                mediaPlayer.setDataSource(this, fallback);
            }

            mediaPlayer.setLooping(true);
            mediaPlayer.setOnPreparedListener(mp -> {
                boolean userCrescendo = AlarmSettingsPreferences.isCrescendoEnabled(this);
                if (extraLoud || userCrescendo) {
                    mp.setVolume(0f, 0f);
                    mp.start();
                    startCrescendo(mp);
                    Log.d(TAG, "🔊 Sound playing — CRESCENDO mode");
                } else {
                    mp.setVolume(1.0f, 1.0f);
                    mp.start();
                    Log.d(TAG, "🔊 Sound playing — normal");
                }
            });
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "MediaPlayer error what=" + what + " extra=" + extra);
                scheduleMediaPlayerRecovery();
                return true;
            });
            mediaPlayer.setOnCompletionListener(mp -> {
                Log.w(TAG, "MediaPlayer completed unexpectedly — restarting");
                scheduleMediaPlayerRecovery();
            });
            mediaPlayer.prepareAsync();

        } catch (Exception e) {
            Log.e(TAG, "startSound failed", e);
            scheduleMediaPlayerRecovery();
        }
    }

    private void startCrescendo(MediaPlayer mp) {
        if (crescendoHandler != null) crescendoHandler.removeCallbacksAndMessages(null);
        final int   STEPS     = 60;
        final long  INTERVAL  = 500L;
        final float INCREMENT = 1.0f / STEPS;
        final float[] vol     = {0f};
        Runnable ramp = new Runnable() {
            @Override
            public void run() {
                if (mp == null || !isRunning) return;
                vol[0] = Math.min(1.0f, vol[0] + INCREMENT);
                try { mp.setVolume(vol[0], vol[0]); } catch (Exception ignored) {}
                if (vol[0] < 1.0f) {
                    crescendoHandler.postDelayed(this, INTERVAL);
                } else {
                    Log.d(TAG, "🔊 Crescendo complete — max volume");
                }
            }
        };
        crescendoHandler.postDelayed(ramp, INTERVAL);
        Log.d(TAG, "Crescendo started (30s ramp)");
    }

    private void scheduleMediaPlayerRecovery() {
        if (recoveryRunnable != null) recoveryHandler.removeCallbacks(recoveryRunnable);
        recoveryRunnable = () -> {
            if (isRunning && AlarmStateManager.isRinging(this)) {
                Log.d(TAG, "🔄 Recovering MediaPlayer");
                forceMaxVolume();
                startSound();
            }
        };
        recoveryHandler.postDelayed(recoveryRunnable, AlarmConstants.MEDIA_RECOVERY_DELAY_MS);
    }

    private void releaseMediaPlayer() {
        if (crescendoHandler != null) crescendoHandler.removeCallbacksAndMessages(null);
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.reset();
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "releaseMediaPlayer error", e);
        }
    }

    // ──────────────────────────────────────────
    // 📳 VIBRATION
    // ──────────────────────────────────────────
    private void startVibration() {
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (!AlarmSettingsPreferences.isVibrateEnabled(this)) {
            Log.d(TAG, "Vibration disabled by user pref");
            return;
        }
        try {
            long[] pattern = {0, 600, 400, 600, 600};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                //noinspection deprecation
                vibrator.vibrate(pattern, 0);
            }
            Log.d(TAG, "Vibration started");
        } catch (Exception e) {
            Log.e(TAG, "startVibration failed", e);
        }
    }

    // ──────────────────────────────────────────
    // 💡 WAKE LOCK
    // ──────────────────────────────────────────
    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            wakeLock = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK       |
                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                PowerManager.ON_AFTER_RELEASE,
                AlarmConstants.WAKELOCK_SERVICE
            );
            wakeLock.acquire(AlarmConstants.MAX_ALARM_DURATION_MS);
            Log.d(TAG, "WakeLock acquired");
        } catch (Exception e) {
            Log.e(TAG, "acquireWakeLock failed", e);
        }
    }

    // ──────────────────────────────────────────
    // ⏰ AUTO-STOP
    // ──────────────────────────────────────────
    private void scheduleAutoStop() {
        autoStopHandler.postDelayed(() -> {
            Log.w(TAG, "⏰ Auto-stop after 30 min");
            AlarmStateManager.clearRinging(this);
            AlarmRecoveryReceiver.cancel(this);
            stopSelf();
        }, AlarmConstants.MAX_ALARM_DURATION_MS);
    }

    // ──────────────────────────────────────────
    // 📢 NOTIFICATION
    // ──────────────────────────────────────────
    private Notification buildNotification(String title, String body,
                                            String uuid, int alarmId) {
        createSoundChannel();

        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.setAction(Intent.ACTION_VIEW);
        tapIntent.setData(android.net.Uri.parse(AlarmConstants.DEEP_LINK_BASE + uuid));
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                           Intent.FLAG_ACTIVITY_SINGLE_TOP |
                           Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT |
                      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ?
                       PendingIntent.FLAG_IMMUTABLE : 0);

        PendingIntent tapPi = PendingIntent.getActivity(this, alarmId, tapIntent, piFlags);

        return new NotificationCompat.Builder(this, AlarmConstants.CHANNEL_ALARM_SOUND)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("⏰ " + title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(tapPi, true)
            .setContentIntent(tapPi)
            .build();
    }

    private void createSoundChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
            AlarmConstants.CHANNEL_ALARM_SOUND,
            "Rise Alarm Sound",
            NotificationManager.IMPORTANCE_HIGH
        );
        ch.setBypassDnd(true);
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    // ──────────────────────────────────────────
    // 🛑 STATIC STOP
    // ──────────────────────────────────────────
    public static void stop(Context context) {
        context.stopService(new Intent(context, AlarmSoundService.class));
        Log.d(TAG, "Static stop called");
    }

    // ──────────────────────────────────────────
    // 🧹 CLEANUP
    // ──────────────────────────────────────────
    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        Log.d(TAG, "onDestroy — cleaning up");

        if (recoveryRunnable != null) recoveryHandler.removeCallbacks(recoveryRunnable);
        autoStopHandler.removeCallbacksAndMessages(null);
        if (crescendoHandler != null) crescendoHandler.removeCallbacksAndMessages(null);

        releaseMediaPlayer();

        try { if (vibrator != null) vibrator.cancel(); } catch (Exception ignored) {}
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception ignored) {}
        try {
            if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
