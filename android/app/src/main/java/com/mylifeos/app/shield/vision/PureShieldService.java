package com.mylifeos.app.shield.vision;

import android.app.*;
import android.content.*;
import android.content.res.AssetFileDescriptor;
import android.graphics.*;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.*;
import android.util.*;
import android.view.*;

import androidx.core.app.NotificationCompat;

import com.mylifeos.app.R;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.face.Face;
import com.google.mlkit.vision.face.FaceDetection;
import com.google.mlkit.vision.face.FaceDetectorOptions;

import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.DataType;
import org.tensorflow.lite.gpu.GpuDelegate;

import java.io.*;
import java.nio.*;
import java.nio.channels.FileChannel;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public class PureShieldService extends Service {

    private static final String TAG = "PureShieldService";
    private static final String CHANNEL_ID = "PureShield_channel";
    private static final int NOTIF_ID = 9901;

    private int screenWidth, screenHeight, screenDensity;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;

    private Interpreter faceDetector;
    private com.google.mlkit.vision.face.FaceDetector mlKitFaceDetector;
    private Interpreter genderClassifier;
    private GpuDelegate gpuDelegate;
    private int genderInputWidth = 64;
    private int genderInputHeight = 64;
    private DataType genderInputDataType = DataType.FLOAT32;
    private DataType genderOutputDataType = DataType.FLOAT32;
    private float genderInputScale = 1f;
    private int genderInputZeroPoint = 0;
    private float genderOutputScale = 1f;
    private int genderOutputZeroPoint = 0;

    private WindowManager windowManager;
    private final List<View> blurOverlays = new CopyOnWriteArrayList<>();

    private PureShieldAdaptiveEngine adaptiveEngine;
    private PureShieldModelManager modelManager;

    private ExecutorService inferenceExecutor;
    private ScheduledExecutorService samplerExecutor;
    private ScheduledFuture<?> samplerTask;
    private final AtomicBoolean isProcessing = new AtomicBoolean(false);
    private final AtomicBoolean isRunning    = new AtomicBoolean(false);

    private PureShieldConfig config;
    private Set<String> targetPackages = new HashSet<>();
    private String currentForegroundPackage = "";
    private long lastForegroundSignalAtMs = 0L;
    private boolean restartOnDestroy = true;

    // ✅ Debug Counters
    public static final AtomicInteger totalFramesProcessed = new AtomicInteger(0);
    public static final AtomicInteger totalFacesDetected   = new AtomicInteger(0);
    public static final AtomicInteger totalFacesBlurred    = new AtomicInteger(0);
    public static final AtomicLong    lastInferenceMs      = new AtomicLong(0);
    public static volatile String     lastDebugMessage     = "Not started yet";
    public static volatile String     lastForegroundApp    = "";
    public static volatile float      lastBlazeMaxScore    = 0f;
    public static volatile int        lastBlazeAboveCount   = 0;
    public static volatile int        lastBlazeKeptCount    = 0;
    public static volatile int        lastOverlayCount      = 0;
    public static volatile boolean    lastGenderModelLoaded = false;

    public static PureShieldService instance;
    public static volatile String lastModelStatus       = "UNKNOWN";
    public static volatile String lastModelStatusReason = null;

    // ✅ Anti-flicker / temporal smoothing
    private static final int   MISS_GRACE_FRAMES = 4;
    private static final long  STICKY_TTL_MS     = 900;
    private static final float SMOOTH_LERP       = 0.45f;
    private static final float MATCH_IOU         = 0.20f;
    private int missFrameCount = 0;
    private long lastFaceFrameAtMs = 0L;
    private List<RectF> lastBlurRegions = new ArrayList<>();

    // ✅ Detection tuning — high precision (fewer false positives)
    private static final float DETECT_THRESHOLD  = 0.60f;
    private static final float NMS_IOU_THRESHOLD = 0.30f;
    private static final float DEFAULT_MIN_FACE_FRAC = 0.02f;  // 2% lets small grid/feed faces be detected
    private static final float MAX_FACE_FRAC     = 0.85f;
    private static final int   DEFAULT_MAX_FACE_OVERLAYS = 100;

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;

        windowManager  = (WindowManager) getSystemService(WINDOW_SERVICE);
        adaptiveEngine = new PureShieldAdaptiveEngine(this);
        modelManager   = new PureShieldModelManager(this);
        config         = PureShieldPreferences.loadConfig(this);
        targetPackages = PureShieldPreferences.loadTargetPackages(this);

        DisplayMetrics metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getRealMetrics(metrics);
        screenWidth   = metrics.widthPixels;
        screenHeight  = metrics.heightPixels;
        screenDensity = metrics.densityDpi;

        inferenceExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "PureShield-Inference");
            t.setPriority(Thread.NORM_PRIORITY - 1);
            return t;
        });
        samplerExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "PureShield-Sampler");
            t.setPriority(Thread.MIN_PRIORITY);
            return t;
        });

        createNotificationChannel();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, buildNotification(),
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIF_ID, buildNotification());
            }
        } catch (Throwable e) {
            Log.e(TAG, "❌ startForeground failed: " + e.getMessage(), e);
            stopSelf();
            return;
        }

        lastDebugMessage = "Service created. Tier: " + modelManager.getSelectedTier();
        Log.i(TAG, "✅ PureShieldService created — tier: " + modelManager.getSelectedTier());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        String action = intent.getAction();
        if (action == null) return START_STICKY;

        switch (action) {
            case Actions.START_PROJECTION:
                restartOnDestroy = true;
                int resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED);
                Intent data = intent.getParcelableExtra("data");
                startProjection(resultCode, data);
                break;

            case Actions.STOP:
                restartOnDestroy = false;
                isRunning.set(false);
                clearAllOverlays();
                cancelNotification();
                stopSelf();
                break;

            case Actions.UPDATE_CONFIG:
                config = PureShieldPreferences.loadConfig(this);
                targetPackages = PureShieldPreferences.loadTargetPackages(this);
                adaptiveEngine.onConfigChanged(config);
                Log.d(TAG, "⚙️ Config updated — targets: " + targetPackages);
                break;

            case Actions.FOREGROUND_APP_CHANGED:
                String pkg = intent.getStringExtra("package");
                Log.d(TAG, "📱 Foreground app: " + pkg + " | targets: " + targetPackages);
                onForegroundAppChanged(pkg);
                break;

            case Actions.SWITCH_MODEL_TIER:
                switchModelTier(intent.getStringExtra("tier"));
                break;
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (adaptiveEngine != null) adaptiveEngine.destroy();
        isRunning.set(false);
        stopSampler();
        releaseProjection();
        releaseModels();
        clearAllOverlays();
        if (inferenceExecutor != null) inferenceExecutor.shutdownNow();
        if (samplerExecutor   != null) samplerExecutor.shutdownNow();
        if (!restartOnDestroy) cancelNotification();
        instance = null;
        super.onDestroy();
        // MediaProjection tokens are one-shot; auto-restarting without a fresh
        // permission token creates a dead service/notification loop.
        Log.i(TAG, "⚠️ onDestroy (restart=" + restartOnDestroy + ")");
    }

    private void cancelNotification() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Throwable ignored) {}
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) { nm.cancel(NOTIF_ID); nm.cancelAll(); }
        } catch (Throwable ignored) {}
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    public boolean isPureShieldRunning() { return isRunning.get(); }

    public PureShieldAdaptiveEngine.AdaptiveStatus getAdaptiveStatus() {
        return adaptiveEngine != null
            ? adaptiveEngine.getStatus()
            : new PureShieldAdaptiveEngine.AdaptiveStatus("MID", 700, 100, -1, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MediaProjection
    // ─────────────────────────────────────────────────────────────────────────

    private void startProjection(int resultCode, Intent data) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, buildNotification(),
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            }
        } catch (Throwable t) {
            Log.e(TAG, "❌ FG upgrade failed: " + t.getMessage(), t);
            broadcastModelStatus("MODEL_FAILED", "Foreground upgrade failed");
            stopSelf(); return;
        }

        MediaProjectionManager mpm =
            (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        try {
            mediaProjection = mpm.getMediaProjection(resultCode, data);
        } catch (Throwable t) {
            Log.e(TAG, "❌ getMediaProjection failed: " + t.getMessage(), t);
            broadcastModelStatus("MODEL_FAILED", "Screen capture unavailable");
            stopSelf(); return;
        }

        if (mediaProjection == null) {
            broadcastModelStatus("MODEL_FAILED", "MediaProjection null");
            stopSelf(); return;
        }

        mediaProjection.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() {
                releaseProjection();
                restartOnDestroy = false;
                isRunning.set(false);
                clearAllOverlays();
                lastDebugMessage = "Screen capture stopped — start PureShield again";
            }
        }, new Handler(Looper.getMainLooper()));

        int captureW = adaptiveEngine.getCaptureWidth(screenWidth);
        int captureH = adaptiveEngine.getCaptureHeight(screenHeight);

        imageReader = ImageReader.newInstance(captureW, captureH, PixelFormat.RGBA_8888, 2);
        virtualDisplay = mediaProjection.createVirtualDisplay(
            "PureShieldCapture", captureW, captureH, screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(), null, null
        );

        if (!loadModels()) {
            restartOnDestroy = false;
            isRunning.set(false);
            clearAllOverlays();
            releaseProjection();
            stopSelf();
            return;
        }
        isRunning.set(true);
        startSampler();
        lastDebugMessage = "Projection started: " + captureW + "x" + captureH;
        Log.i(TAG, "📱 " + lastDebugMessage);
    }

    private void releaseProjection() {
        if (virtualDisplay  != null) { virtualDisplay.release();  virtualDisplay  = null; }
        if (imageReader     != null) { imageReader.close();       imageReader     = null; }
        if (mediaProjection != null) { mediaProjection.stop();    mediaProjection = null; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Model Loading
    // ─────────────────────────────────────────────────────────────────────────

    private boolean loadModels() {
        Interpreter.Options options = null;
        try {
            options = buildInterpreterOptions();
        } catch (Throwable t) {
            Log.w(TAG, "⚠️ TFLite init failed, ML Kit fallback will be used: " + t.getMessage());
        }

        String faceModel = modelManager.getFaceDetectorModel();

        if (!assetExists(faceModel)) {
            Log.w(TAG, "⚠️ " + faceModel + " missing, trying blaze_face_short_range");
            faceModel = "blaze_face_short_range.tflite";
        }
        if (!assetExists(faceModel)) {
            Log.w(TAG, "⚠️ blaze_face_short_range missing, trying blazeface");
            faceModel = "blazeface.tflite";
        }
        if (!assetExists(faceModel)) {
            if (ensureMlKitFaceDetector()) {
                faceDetector = null;
                broadcastModelStatus("OK", "ML Kit face fallback");
                lastDebugMessage = "ML Kit face fallback ready (no BlazeFace asset)";
                return true;
            }
            broadcastModelStatus("MODEL_EMPTY", "No usable face detector available");
            return false;
        }

        try {
            Log.i(TAG, "📂 Loading face model: " + faceModel);
            try {
                faceDetector = new Interpreter(loadModelFile(faceModel), options != null ? options : buildCpuInterpreterOptions());
                int[] s = faceDetector.getInputTensor(0).shape();
                float[][][][] dummy = new float[1][s[1]][s[2]][3];
                int nOut = faceDetector.getOutputTensorCount();
                Map<Integer, Object> dummyOuts = new HashMap<>();
                for (int i = 0; i < nOut; i++) {
                    int[] os = faceDetector.getOutputTensor(i).shape();
                    if (os.length == 3) dummyOuts.put(i, new float[os[0]][os[1]][os[2]]);
                    else if (os.length == 2) dummyOuts.put(i, new float[os[0]][os[1]]);
                    else dummyOuts.put(i, new float[1][1]);
                }
                faceDetector.runForMultipleInputsOutputs(new Object[]{dummy}, dummyOuts);
            } catch (Throwable gpuFail) {
                Log.w(TAG, "⚠️ GPU/face init failed, retrying CPU-only: " + gpuFail.getMessage());
                if (faceDetector != null) { try { faceDetector.close(); } catch (Throwable ignored) {} faceDetector = null; }
                if (gpuDelegate != null) { try { gpuDelegate.close(); } catch (Throwable ignored) {} gpuDelegate = null; }
                faceDetector = new Interpreter(loadModelFile(faceModel), buildCpuInterpreterOptions());
            }

            int[] inputShape = faceDetector.getInputTensor(0).shape();
            Log.i(TAG, "✅ Model input shape: " + Arrays.toString(inputShape));

            String genderModelFile = modelManager.getGenderClassifierModel();
            if (genderModelFile != null && assetExists(genderModelFile)) {
                try {
                    Log.i(TAG, "📂 Loading gender model: " + genderModelFile);
                    genderClassifier = new Interpreter(loadModelFile(genderModelFile), buildCpuInterpreterOptions());
                    int[] genderShape = genderClassifier.getInputTensor(0).shape();
                    if (genderShape.length >= 4) {
                        genderInputHeight = genderShape[1];
                        genderInputWidth = genderShape[2];
                    }
                    genderInputDataType = genderClassifier.getInputTensor(0).dataType();
                    genderOutputDataType = genderClassifier.getOutputTensor(0).dataType();
                    genderInputScale = genderClassifier.getInputTensor(0).quantizationParams().getScale();
                    genderInputZeroPoint = genderClassifier.getInputTensor(0).quantizationParams().getZeroPoint();
                    genderOutputScale = genderClassifier.getOutputTensor(0).quantizationParams().getScale();
                    genderOutputZeroPoint = genderClassifier.getOutputTensor(0).quantizationParams().getZeroPoint();
                    Log.i(TAG, "✅ Gender model loaded — input=" + genderInputWidth + "x" + genderInputHeight);
                } catch (Throwable gt) {
                    genderClassifier = null;
                    Log.w(TAG, "⚠️ Gender model load failed — blur-all-faces fallback: " + gt.getMessage());
                }
            } else {
                Log.w(TAG, "⚠️ No gender model found — blur-all-faces fallback active");
            }
            lastGenderModelLoaded = genderClassifier != null;

            ensureMlKitFaceDetector();

            broadcastModelStatus("OK", faceModel);
            lastDebugMessage = "Model loaded: " + faceModel + " input=" + inputShape[1] + "x" + inputShape[2];
            Log.i(TAG, "✅ " + lastDebugMessage);
            return true;
        } catch (Throwable e) {
            Log.e(TAG, "❌ Load failed: " + e.getMessage(), e);
            if (ensureMlKitFaceDetector()) {
                faceDetector = null;
                broadcastModelStatus("OK", "ML Kit fallback after TFLite failure");
                lastDebugMessage = "ML Kit fallback active: " + e.getMessage();
                return true;
            }
            broadcastModelStatus("MODEL_FAILED", e.getMessage());
            return false;
        }
    }

    private boolean ensureMlKitFaceDetector() {
        if (mlKitFaceDetector != null) return true;
        try {
            FaceDetectorOptions detectorOptions = new FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setMinFaceSize(Math.max(0.01f, (config != null ? config.getMinFaceSizePct() : 2) / 100f))
                .enableTracking()
                .build();
            mlKitFaceDetector = FaceDetection.getClient(detectorOptions);
            Log.i(TAG, "✅ ML Kit face fallback ready");
            return true;
        } catch (Throwable mt) {
            mlKitFaceDetector = null;
            Log.w(TAG, "⚠️ ML Kit fallback unavailable: " + mt.getMessage());
            return false;
        }
    }

    private boolean assetExists(String name) {
        if (name == null) return false;
        try {
            AssetFileDescriptor fd = getAssets().openFd(name);
            long size = fd.getDeclaredLength();
            fd.close();
            return size > 10000;
        } catch (Throwable t) { return false; }
    }

    private void broadcastModelStatus(String status, String reason) {
        lastModelStatus = status;
        lastModelStatusReason = reason;
        try {
            Intent i = new Intent("com.mylifeos.app.PURESHIELD_STATUS");
            i.putExtra("status", status);
            if (reason != null) i.putExtra("reason", reason);
            sendBroadcast(i);
        } catch (Throwable ignored) {}
    }

    private Interpreter.Options buildInterpreterOptions() {
        Interpreter.Options options = new Interpreter.Options();
        options.setNumThreads(adaptiveEngine.getInferenceThreadCount());
        try {
            gpuDelegate = new GpuDelegate();
            options.addDelegate(gpuDelegate);
            Log.i(TAG, "🎮 GPU delegate enabled");
        } catch (Throwable e) {
            gpuDelegate = null;
            Log.w(TAG, "⚠️ GPU unavailable, using CPU");
        }
        return options;
    }

    private Interpreter.Options buildCpuInterpreterOptions() {
        Interpreter.Options options = new Interpreter.Options();
        options.setNumThreads(Math.max(1, adaptiveEngine.getInferenceThreadCount()));
        return options;
    }

    private MappedByteBuffer loadModelFile(String filename) throws IOException {
        AssetFileDescriptor fd = getAssets().openFd(filename);
        FileInputStream fis    = new FileInputStream(fd.getFileDescriptor());
        FileChannel fc         = fis.getChannel();
        MappedByteBuffer buf   = fc.map(FileChannel.MapMode.READ_ONLY, fd.getStartOffset(), fd.getDeclaredLength());
        fis.close();
        Log.d(TAG, "✅ Loaded: " + filename + " (" + (buf.capacity()/1024) + "KB)");
        return buf;
    }

    private void releaseModels() {
        if (faceDetector    != null) { faceDetector.close();     faceDetector    = null; }
        if (mlKitFaceDetector != null) { try { mlKitFaceDetector.close(); } catch (Throwable ignored) {} mlKitFaceDetector = null; }
        if (genderClassifier!= null) { genderClassifier.close(); genderClassifier= null; }
        if (gpuDelegate     != null) { gpuDelegate.close();      gpuDelegate     = null; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Frame Sampling
    // ─────────────────────────────────────────────────────────────────────────

    private void startSampler() {
        long intervalMs = adaptiveEngine.getSampleIntervalMs();
        samplerTask = samplerExecutor.scheduleAtFixedRate(
            this::captureAndProcess, 500, intervalMs, TimeUnit.MILLISECONDS);
        Log.i(TAG, "▶️ Sampler started: " + intervalMs + "ms interval");
    }

    private void stopSampler() {
        if (samplerTask != null) { samplerTask.cancel(true); samplerTask = null; }
    }

    private void rescheduleSampler() {
        stopSampler();
        if (isRunning.get()) startSampler();
    }

    private void captureAndProcess() {
        if (!isRunning.get() || isProcessing.get()) return;

        // ✅ HARD GATE — only process when a target app is confirmed in foreground.
        // No targets configured, OR signal stale (>5s), OR not our target → STOP
        // and wipe any sticky overlays. Prevents blur appearing on home screen.
        boolean noTargets   = targetPackages.isEmpty();
        boolean noFgSignal  = currentForegroundPackage == null || currentForegroundPackage.isEmpty()
            || SystemClock.elapsedRealtime() - lastForegroundSignalAtMs > 5000;
        boolean isOurTarget = isTargetAppInForeground();

        if (noTargets || noFgSignal || !isOurTarget) {
            if (!lastBlurRegions.isEmpty() || !blurOverlays.isEmpty()) {
                lastBlurRegions = new ArrayList<>();
                missFrameCount = 0;
                clearAllOverlays();
            }
            return;
        }

        if (adaptiveEngine.shouldSkipFrame()) return;

        Image image = null;
        try {
            image = imageReader.acquireLatestImage();
            if (image == null) return;

            isProcessing.set(true);
            Bitmap bitmap = imageToBitmap(image);
            image.close(); image = null;

            if (bitmap == null) { isProcessing.set(false); return; }

            totalFramesProcessed.incrementAndGet();

            inferenceExecutor.submit(() -> {
                try { processFrame(bitmap); }
                catch (Exception e) { Log.e(TAG, "❌ Inference error: " + e.getMessage()); }
                finally { bitmap.recycle(); isProcessing.set(false); }
            });
        } catch (Exception e) {
            Log.e(TAG, "❌ Capture error: " + e.getMessage());
            if (image != null) image.close();
            isProcessing.set(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inference
    // ─────────────────────────────────────────────────────────────────────────

    private void processFrame(Bitmap bitmap) {
        if (faceDetector == null && mlKitFaceDetector == null) {
            lastDebugMessage = "❌ No face detector is ready";
            return;
        }

        long startMs = System.currentTimeMillis();

        int inputH = 128;
        int inputW = 128;
        if (faceDetector != null) {
            int[] inputShape = faceDetector.getInputTensor(0).shape();
            inputH = inputShape[1];
            inputW = inputShape[2];
        }

        List<RectF> faces = detectFaces(bitmap, inputW, inputH);

        long inferMs = System.currentTimeMillis() - startMs;
        lastInferenceMs.set(inferMs);
        if (adaptiveEngine != null) adaptiveEngine.recordInferenceTime(inferMs);

        int faceCount = faces.size();
        totalFacesDetected.addAndGet(faceCount);

        // ✅ FIX 2: Debug log — multiple face count দেখাবে
        Log.d(TAG, "🔍 Frame #" + totalFramesProcessed.get()
            + " | Faces detected: " + faceCount
            + " | Time: " + inferMs + "ms"
            + " | App: " + currentForegroundPackage);

        if (faceCount == 0) {
            missFrameCount++;
            boolean expired = (System.currentTimeMillis() - lastFaceFrameAtMs) > STICKY_TTL_MS;
            if (missFrameCount >= MISS_GRACE_FRAMES || expired || lastBlurRegions.isEmpty()) {
                lastBlurRegions = new ArrayList<>();
                lastDebugMessage = "Frame #" + totalFramesProcessed.get() + ": No faces";
                clearAllOverlays();
            } else {
                lastDebugMessage = "Frame #" + totalFramesProcessed.get() + ": holding ("
                    + missFrameCount + "/" + MISS_GRACE_FRAMES + ")";
            }
            return;
        }

        missFrameCount = 0;
        lastFaceFrameAtMs = System.currentTimeMillis();

        // ✅ Multi-face: keep normalized box too, so we can crop the source bitmap
        // and pass true pixels to each overlay for real blur (not painted oval).
        List<RectF> rawBlur     = new ArrayList<>();
        List<RectF> normalized  = new ArrayList<>();
        int maxFaces = config != null ? config.getMaxFaces() : DEFAULT_MAX_FACE_OVERLAYS;
        for (RectF face : faces) {
            if (rawBlur.size() >= maxFaces) break;
            GenderResult result = estimateGender(bitmap, face);
            boolean blur = shouldBlur(result);

            Log.d(TAG, "👤 Face " + (rawBlur.size() + 1) + "/" + faceCount
                + " | female=" + String.format("%.2f", result.femaleProbability)
                + " male=" + String.format("%.2f", result.maleProbability)
                + " → blur=" + blur);

            if (blur) {
                RectF screenRect = scaleToScreenCoords(face, bitmap.getWidth(), bitmap.getHeight());
                rawBlur.add(screenRect);
                normalized.add(new RectF(face));
                totalFacesBlurred.incrementAndGet();
            }
        }

        Log.d(TAG, "🎯 Faces to blur: " + rawBlur.size() + " / " + faceCount);

        List<RectF> toBlur = smoothRegions(rawBlur);
        lastBlurRegions = toBlur;

        // ✅ Crop each face region from the captured bitmap BEFORE inference thread
        // recycles it — these are what produces the real-pixel blur.
        final List<Bitmap> crops = new ArrayList<>(toBlur.size());
        int bw = bitmap.getWidth(), bh = bitmap.getHeight();
        for (int i = 0; i < toBlur.size(); i++) {
            RectF r = toBlur.get(i);
            int cx = Math.max(0, Math.round((r.left / Math.max(1f, screenWidth)) * bw));
            int cy = Math.max(0, Math.round((r.top / Math.max(1f, screenHeight)) * bh));
            int cw = Math.min(bw - cx, Math.round((r.width() / Math.max(1f, screenWidth)) * bw));
            int ch = Math.min(bh - cy, Math.round((r.height() / Math.max(1f, screenHeight)) * bh));
            try {
                crops.add((cw > 4 && ch > 4)
                    ? Bitmap.createBitmap(bitmap, cx, cy, cw, ch)
                    : null);
            } catch (Throwable t) {
                crops.add(null);
            }
        }

        // ✅ Stats summary every 30 frames
        int fc = totalFramesProcessed.get();
        if (fc % 30 == 0) {
            Log.i(TAG, "[STATS] frames=" + fc
                + " detected=" + totalFacesDetected.get()
                + " blurred=" + totalFacesBlurred.get()
                + " inferMs=" + inferMs
                + " app=" + currentForegroundPackage);
        }

        lastDebugMessage = "Frame #" + fc
            + " | Detected: " + faceCount
            + " | Blurred: " + toBlur.size()
            + " | Total: " + totalFacesBlurred.get();

        updateNotificationStats();

        new Handler(Looper.getMainLooper()).post(() -> updateOverlays(toBlur, crops));
    }

    private List<RectF> smoothRegions(List<RectF> incoming) {
        if (lastBlurRegions.isEmpty() || incoming.isEmpty()) return incoming;
        List<RectF> out = new ArrayList<>(incoming.size());
        boolean[] usedPrev = new boolean[lastBlurRegions.size()];
        for (RectF cur : incoming) {
            int bestIdx = -1; float bestIou = MATCH_IOU;
            for (int i = 0; i < lastBlurRegions.size(); i++) {
                if (usedPrev[i]) continue;
                float v = iou(cur, lastBlurRegions.get(i));
                if (v > bestIou) { bestIou = v; bestIdx = i; }
            }
            if (bestIdx >= 0) {
                usedPrev[bestIdx] = true;
                RectF prev = lastBlurRegions.get(bestIdx);
                out.add(new RectF(
                    lerp(prev.left,   cur.left),
                    lerp(prev.top,    cur.top),
                    lerp(prev.right,  cur.right),
                    lerp(prev.bottom, cur.bottom)));
            } else {
                out.add(cur); // নতুন face — সরাসরি যোগ করো
            }
        }
        return out;
    }

    private float lerp(float a, float b) { return a + (b - a) * SMOOTH_LERP; }

    // ─────────────────────────────────────────────────────────────────────────
    // Face detection
    // ─────────────────────────────────────────────────────────────────────────

    private List<RectF> detectFaces(Bitmap src, int inputW, int inputH) {
        if (faceDetector == null) {
            return detectFacesWithMlKit(src, "tflite-null");
        }

        Bitmap resized = Bitmap.createScaledBitmap(src, inputW, inputH, false);

        float[][][][] input = new float[1][inputH][inputW][3];
        int[] pixels = new int[inputW * inputH];
        resized.getPixels(pixels, 0, inputW, 0, 0, inputW, inputH);
        resized.recycle();

        // MediaPipe/BlazeFace normalization: [-1, 1]
        for (int i = 0; i < pixels.length; i++) {
            int p = pixels[i];
            int y = i / inputW, x = i % inputW;
            input[0][y][x][0] = (((p >> 16) & 0xFF) / 127.5f) - 1f;
            input[0][y][x][1] = (((p >> 8)  & 0xFF) / 127.5f) - 1f;
            input[0][y][x][2] = ((p & 0xFF)          / 127.5f) - 1f;
        }

        // ✅ Auto-detect which output is regressors vs classifiers based on tensor shape.
        // BlazeFace standard: regressors=[1,896,16], classifiers=[1,896,1].
        int regIdx = 0, clsIdx = 1;
        int regCount = 896, clsCount = 896, regCoordCount = 16;
        int nOut = faceDetector.getOutputTensorCount();
        for (int i = 0; i < nOut; i++) {
            int[] os = faceDetector.getOutputTensor(i).shape();
            if (os.length == 3 && os[2] >= 4) { regIdx = i; regCount = os[1]; regCoordCount = os[2]; }
            else if (os.length == 3 && os[2] == 1) { clsIdx = i; clsCount = os[1]; }
        }

        try {
            int anchorCount = Math.min(Math.min(regCount, clsCount), PureShieldAnchors.X_CENTER.length);
            float[][][] regressors  = new float[1][regCount][regCoordCount];
            float[][][] classifiers = new float[1][clsCount][1];
            Map<Integer, Object> outputs = new HashMap<>();
            outputs.put(regIdx, regressors);
            outputs.put(clsIdx, classifiers);

            faceDetector.runForMultipleInputsOutputs(new Object[]{input}, outputs);
            List<RectF> decoded = decodeBlazeFace(regressors, classifiers, inputW, inputH, DETECT_THRESHOLD, anchorCount);
            return decoded.isEmpty() ? detectFacesWithMlKit(src, "blazeface-empty") : decoded;
        } catch (Throwable t) {
            Log.w(TAG, "⚠️ Multi-output failed: " + t.getMessage());
        }

        // Fallback: single output
        try {
            float[][][] single = new float[1][896][16];
            faceDetector.run(input, single);
            List<RectF> decoded = decodeSingleOutput(single);
            return decoded.isEmpty() ? detectFacesWithMlKit(src, "single-empty") : decoded;
        } catch (Throwable t2) {
            Log.e(TAG, "❌ All detection failed: " + t2.getMessage());
            lastDebugMessage = "❌ Detection error: " + t2.getMessage();
            return detectFacesWithMlKit(src, "tflite-error");
        }
    }

    private List<RectF> detectFacesWithMlKit(Bitmap src, String reason) {
        if (mlKitFaceDetector == null || src == null || src.isRecycled()) return Collections.emptyList();
        try {
            List<Face> faces = Tasks.await(
                mlKitFaceDetector.process(InputImage.fromBitmap(src, 0)),
                650, TimeUnit.MILLISECONDS);
            List<RectF> boxes = new ArrayList<>();
            int bw = Math.max(1, src.getWidth());
            int bh = Math.max(1, src.getHeight());
            float minFaceFrac = Math.max(DEFAULT_MIN_FACE_FRAC,
                (config != null ? config.getMinFaceSizePct() : 2) / 100f);
            int maxFaces = config != null ? config.getMaxFaces() : DEFAULT_MAX_FACE_OVERLAYS;
            for (Face face : faces) {
                if (boxes.size() >= maxFaces) break;
                Rect b = face.getBoundingBox();
                float left = Math.max(0f, b.left / (float) bw);
                float top = Math.max(0f, b.top / (float) bh);
                float right = Math.min(1f, b.right / (float) bw);
                float bottom = Math.min(1f, b.bottom / (float) bh);
                float w = right - left;
                float h = bottom - top;
                if (w < minFaceFrac || h < minFaceFrac || w <= 0f || h <= 0f) continue;
                boxes.add(new RectF(left, top, right, bottom));
            }
            lastBlazeAboveCount = faces.size();
            lastBlazeKeptCount = boxes.size();
            lastDebugMessage = "MLKit fallback (" + reason + "): " + boxes.size() + " faces";
            Log.i(TAG, "🧯 MLKit fallback reason=" + reason + " raw=" + faces.size() + " kept=" + boxes.size());
            return boxes;
        } catch (Throwable t) {
            Log.w(TAG, "⚠️ MLKit fallback failed (" + reason + "): " + t.getMessage());
            return Collections.emptyList();
        }
    }

    private List<RectF> decodeBlazeFace(float[][][] regressors, float[][][] classifiers,
                                         int inputW, int inputH, float threshold, int anchorCount) {
        List<RectF> boxes  = new ArrayList<>();
        List<Float> scores = new ArrayList<>();
        float[] anchorX = PureShieldAnchors.X_CENTER;
        float[] anchorY = PureShieldAnchors.Y_CENTER;
        int count = Math.min(anchorCount, Math.min(anchorX.length, Math.min(regressors[0].length, classifiers[0].length)));
        float minFaceFrac = Math.max(DEFAULT_MIN_FACE_FRAC,
            (config != null ? config.getMinFaceSizePct() : 2) / 100f);

        float maxScore = 0f;
        int   above    = 0;

        for (int i = 0; i < count; i++) {
            float score = sigmoid(classifiers[0][i][0]);
            if (score > maxScore) maxScore = score;
            if (score < threshold) continue;
            above++;

            // BlazeFace regressor: dx, dy, w, h are in INPUT-pixel space.
            // Anchors are normalized [0,1]. Convert: cx = dx/inputW + anchorX.
            float cx = regressors[0][i][0] / inputW + anchorX[i];
            float cy = regressors[0][i][1] / inputH + anchorY[i];
            float w  = regressors[0][i][2] / inputW;
            float h  = regressors[0][i][3] / inputH;

            if (w < minFaceFrac || h < minFaceFrac) continue;
            if (w > MAX_FACE_FRAC || h > MAX_FACE_FRAC) continue;
            // Real faces are roughly square (~0.7–1.4). Tight guard rejects banners/logos.
            float ar = (h > 0) ? w / h : 1f;
            if (ar < 0.55f || ar > 1.8f) continue;

            boxes.add(new RectF(
                Math.max(0f, cx - w/2),
                Math.max(0f, cy - h/2),
                Math.min(1f, cx + w/2),
                Math.min(1f, cy + h/2)
            ));
            scores.add(score);
        }

        lastBlazeMaxScore = maxScore;
        lastBlazeAboveCount = above;
        lastBlazeKeptCount = boxes.size();
        Log.d(TAG, "📊 BlazeFace maxScore=" + String.format("%.3f", maxScore)
            + " above=" + above + " kept=" + boxes.size()
            + " minFace=" + String.format("%.2f", minFaceFrac));

        List<RectF> kept = nmsWithScores(boxes, scores, NMS_IOU_THRESHOLD);
        int maxFaces = config != null ? config.getMaxFaces() : DEFAULT_MAX_FACE_OVERLAYS;
        return kept.size() > maxFaces ? new ArrayList<>(kept.subList(0, maxFaces)) : kept;
    }

    /** ✅ Score-sorted NMS — highest-confidence box wins over biggest. */
    private List<RectF> nmsWithScores(List<RectF> boxes, List<Float> scores, float iouThreshold) {
        if (boxes.isEmpty()) return boxes;
        Integer[] order = new Integer[boxes.size()];
        for (int i = 0; i < order.length; i++) order[i] = i;
        Arrays.sort(order, (a, b) -> Float.compare(scores.get(b), scores.get(a)));
        boolean[] suppressed = new boolean[boxes.size()];
        List<RectF> result = new ArrayList<>();
        for (int idx : order) {
            if (suppressed[idx]) continue;
            result.add(boxes.get(idx));
            for (int j : order) {
                if (j == idx || suppressed[j]) continue;
                if (iou(boxes.get(idx), boxes.get(j)) > iouThreshold) suppressed[j] = true;
            }
        }
        return result;
    }

    private List<RectF> decodeSingleOutput(float[][][] output) {
        List<RectF> boxes = new ArrayList<>();
        for (int i = 0; i < output[0].length; i++) {
            if (output[0][i].length < 5) continue;
            float conf = sigmoid(output[0][i][4]);
            if (conf < 0.5f) continue;
            float cx = output[0][i][0], cy = output[0][i][1];
            float w  = output[0][i][2], h  = output[0][i][3];
            boxes.add(new RectF(
                Math.max(0f, cx - w/2), Math.max(0f, cy - h/2),
                Math.min(1f, cx + w/2), Math.min(1f, cy + h/2)));
        }
        return nonMaxSuppression(boxes, 0.5f);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gender
    // ─────────────────────────────────────────────────────────────────────────

    private GenderResult estimateGender(Bitmap src, RectF faceBox) {
        // BOTH mode: blur every face regardless — return matching probs.
        if (config.getBlurGender() == PureShieldConfig.BlurGender.BOTH) {
            return new GenderResult(0.9f, 0.9f);
        }
        if (genderClassifier != null) {
            return classifyGenderReal(src, faceBox);
        }
        return new GenderResult(0.5f, 0.5f);
    }

    private GenderResult classifyGenderReal(Bitmap src, RectF faceBox) {
        int inputW = Math.max(1, genderInputWidth);
        int inputH = Math.max(1, genderInputHeight);
        int bw = src.getWidth(), bh = src.getHeight();

        float padX = faceBox.width()  * bw * 0.25f;
        float padY = faceBox.height() * bh * 0.25f;

        int left   = (int) Math.max(0,  faceBox.left   * bw - padX);
        int top    = (int) Math.max(0,  faceBox.top    * bh - padY);
        int right  = (int) Math.min(bw, faceBox.right  * bw + padX);
        int bottom = (int) Math.min(bh, faceBox.bottom * bh + padY);

        if (right <= left || bottom <= top) return new GenderResult(0.5f, 0.5f);

        Bitmap face    = Bitmap.createBitmap(src, left, top, right-left, bottom-top);
        Bitmap resized = Bitmap.createScaledBitmap(face, inputW, inputH, true);
        face.recycle();

        try {
            int[] pixels = new int[inputW * inputH];
            resized.getPixels(pixels, 0, inputW, 0, 0, inputW, inputH);
            resized.recycle();

            float femaleProbability;
            float maleProbability;

            if (genderInputDataType == DataType.UINT8 || genderInputDataType == DataType.INT8) {
                byte[][][][] input = new byte[1][inputH][inputW][3];
                for (int i = 0; i < pixels.length; i++) {
                    int p = pixels[i];
                    int y = i / inputW, x = i % inputW;
                    input[0][y][x][0] = quantizePixel((p >> 16) & 0xFF);
                    input[0][y][x][1] = quantizePixel((p >> 8) & 0xFF);
                    input[0][y][x][2] = quantizePixel(p & 0xFF);
                }
                if (genderOutputDataType == DataType.UINT8 || genderOutputDataType == DataType.INT8) {
                    byte[][] output = new byte[1][2];
                    genderClassifier.run(input, output);
                    femaleProbability = dequantizeOutput(output[0][0]);
                    maleProbability = dequantizeOutput(output[0][1]);
                } else {
                    float[][] output = new float[1][2];
                    genderClassifier.run(input, output);
                    femaleProbability = output[0][0];
                    maleProbability = output[0][1];
                }
            } else {
                float[][][][] input = new float[1][inputH][inputW][3];
                for (int i = 0; i < pixels.length; i++) {
                    int p = pixels[i];
                    int y = i / inputW, x = i % inputW;
                    input[0][y][x][0] = ((p >> 16) & 0xFF) / 255f;
                    input[0][y][x][1] = ((p >> 8) & 0xFF) / 255f;
                    input[0][y][x][2] = (p & 0xFF) / 255f;
                }
                float[][] output = new float[1][2];
                genderClassifier.run(input, output);
                femaleProbability = output[0][0];
                maleProbability = output[0][1];
            }

            float sum = femaleProbability + maleProbability;
            if (sum > 0.01f) {
                femaleProbability /= sum;
                maleProbability /= sum;
            }

            boolean nan = Float.isNaN(femaleProbability) || Float.isNaN(maleProbability);
            boolean tooLow = (femaleProbability < 0.1f && maleProbability < 0.1f);
            if (nan || tooLow) {
                // ✅ Unreliable → neutral 0.5/0.5. Anything below user threshold
                // (default 0.40 female) will NOT trigger blur — prevents male
                // faces being blurred just because gender model returned junk.
                Log.w(TAG, "⚠️ Gender output unreliable — returning neutral");
                return new GenderResult(0.5f, 0.5f);
            }

            Log.d(TAG, "👤 Gender: female=" + String.format("%.2f", femaleProbability)
                + " male=" + String.format("%.2f", maleProbability));
            return new GenderResult(femaleProbability, maleProbability);
        } catch (Throwable t) {
            Log.w(TAG, "⚠️ Gender classification failed: " + t.getMessage());
            return new GenderResult(0.5f, 0.5f);
        }
    }

    private boolean shouldBlur(GenderResult result) {
        float threshold = config.getConfidenceThreshold();
        switch (config.getBlurGender()) {
            case FEMALE: return result.femaleProbability > threshold;
            case MALE:   return result.maleProbability   > threshold;
            case BOTH:   return true;
            default:     return false;
        }
    }

    private byte quantizePixel(int pixelValue) {
        if (genderInputDataType == DataType.INT8 && (genderInputScale == 0f || genderInputScale == 1f)) {
            return (byte) (pixelValue - 128);
        }
        if (genderInputScale > 0f) {
            int quantized = Math.round((pixelValue / 255f) / genderInputScale) + genderInputZeroPoint;
            if (genderInputDataType == DataType.UINT8) quantized = Math.max(0, Math.min(255, quantized));
            else quantized = Math.max(-128, Math.min(127, quantized));
            return (byte) quantized;
        }
        return (byte) pixelValue;
    }

    private float dequantizeOutput(byte value) {
        int raw = genderOutputDataType == DataType.UINT8 ? (value & 0xFF) : value;
        float scale = genderOutputScale > 0f ? genderOutputScale : 1f;
        return (raw - genderOutputZeroPoint) * scale;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Overlay — ✅ FIX 4: Multiple face overlay ঠিকমতো manage করা হচ্ছে
    // ─────────────────────────────────────────────────────────────────────────

    private void updateOverlays(List<RectF> regions, List<Bitmap> crops) {
        // remove excess
        while (blurOverlays.size() > regions.size()) {
            View v = blurOverlays.remove(blurOverlays.size() - 1);
            try { windowManager.removeView(v); } catch (Exception ignored) {}
        }
        // add missing
        while (blurOverlays.size() < regions.size()) {
            blurOverlays.add(createBlurOverlayView());
        }
        // update positions + push real-pixel crop to each overlay
        for (int i = 0; i < regions.size(); i++) {
            View v = blurOverlays.get(i);
            positionOverlay(v, regions.get(i));
            if (v instanceof PureShieldBlurView && crops != null && i < crops.size()) {
                PureShieldBlurView bv = (PureShieldBlurView) v;
                bv.setBlurStyle(config.getBlurStyle());
                bv.setOverlayOpacity(config.getBlurOpacity());
                bv.setDebugOverlay(config.isDebugOverlay());
                bv.setSourceBitmap(crops.get(i));
            }
        }
        lastOverlayCount = blurOverlays.size();
        Log.d(TAG, "🖼️ Overlay count: " + blurOverlays.size() + " for " + regions.size() + " faces");
    }

    private View createBlurOverlayView() {
        PureShieldBlurView view = new PureShieldBlurView(this);
        view.setBlurStyle(config.getBlurStyle());

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            1, 1, // ✅ শুরুতে 1x1 রাখো, positionOverlay এ update হবে
            0, 0, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT // ✅ TRANSLUCENT — oval এর বাইরে transparent থাকবে
        );
        params.gravity = Gravity.TOP | Gravity.LEFT;
        // ✅ প্রতিটা overlay এর আলাদা title দাও — WindowManager bug এড়াতে
        params.setTitle("PureShieldFace_" + System.currentTimeMillis() + "_" + blurOverlays.size());

        try {
            windowManager.addView(view, params);
        } catch (Exception e) {
            Log.e(TAG, "❌ addView failed: " + e.getMessage());
        }
        return view;
    }

    private void positionOverlay(View view, RectF rect) {
        if (rect.width() <= 0 || rect.height() <= 0) return;
        WindowManager.LayoutParams p = (WindowManager.LayoutParams) view.getLayoutParams();
        if (p == null) return;
        p.x = (int) rect.left;
        p.y = (int) rect.top;
        p.width  = (int) rect.width();
        p.height = (int) rect.height();
        try {
            windowManager.updateViewLayout(view, p);
        } catch (Exception e) {
            Log.w(TAG, "Overlay update failed: " + e.getMessage());
        }
    }

    private void clearAllOverlays() {
        new Handler(Looper.getMainLooper()).post(() -> {
            for (View v : blurOverlays) {
                try { windowManager.removeView(v); } catch (Exception ignored) {}
            }
            blurOverlays.clear();
            lastOverlayCount = 0;
            Log.d(TAG, "🗑️ All overlays cleared");
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Screen coordinates — ✅ FIX 5: padding একটু কমানো হয়েছে
    // বেশি padding দিলে face এর বাইরে blur যায়
    // ─────────────────────────────────────────────────────────────────────────

    private RectF scaleToScreenCoords(RectF box, int captureW, int captureH) {
        // ✅ BlazeFace normalized [0,1] → screen pixels directly
        float left   = box.left   * screenWidth;
        float top    = box.top    * screenHeight;
        float right  = box.right  * screenWidth;
        float bottom = box.bottom * screenHeight;

        // ✅ Tight padding — face shape ধরে রাখতে
        float w = right - left;
        float h = bottom - top;
        float padPct = (config != null ? config.getBlurPaddingPct() : 15) / 100f;
        float padX = w * padPct;
        float padY = h * padPct;

        return new RectF(
            Math.max(0,            left   - padX),
            Math.max(0,            top    - padY),
            Math.min(screenWidth,  right  + padX),
            Math.min(screenHeight, bottom + padY)
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Foreground tracking
    // ─────────────────────────────────────────────────────────────────────────

    public void onForegroundAppChanged(String packageName) {
        currentForegroundPackage = packageName != null ? packageName : "";
        lastForegroundApp = currentForegroundPackage;
        lastForegroundSignalAtMs = SystemClock.elapsedRealtime();
        boolean isTarget = isTargetAppInForeground();
        Log.d(TAG, "📱 App changed: " + currentForegroundPackage
            + " | isTarget: " + isTarget
            + " | targets: " + targetPackages);

        if (!isTarget) {
            clearAllOverlays();
        } else {
            Log.i(TAG, "✅ Target app in foreground: " + currentForegroundPackage);
            adaptiveEngine.onTargetAppResumed();
            rescheduleSampler();
        }
    }

    private boolean isTargetAppInForeground() {
        return targetPackages.contains(currentForegroundPackage);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Model switching
    // ─────────────────────────────────────────────────────────────────────────

    private void switchModelTier(String tierStr) {
        try {
            modelManager.setSelectedTier(PureShieldModelManager.ModelTier.valueOf(tierStr));
            releaseModels();
            loadModels();
            Log.i(TAG, "🔄 Tier switched to: " + tierStr);
        } catch (Exception e) {
            Log.e(TAG, "❌ Switch failed: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Notification
    // ─────────────────────────────────────────────────────────────────────────

    private void updateNotificationStats() {
        if (totalFramesProcessed.get() % 10 != 0) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIF_ID, buildNotification());
        } catch (Throwable ignored) {}
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "PureShield Active", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Filtering visual content in background");
            ch.setShowBadge(false);
            ch.setSound(null, null);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        Intent stopIntent = new Intent(this, PureShieldService.class);
        stopIntent.setAction(Actions.STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stopIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        String stats = "Frames: " + totalFramesProcessed.get()
            + " | Faces: " + totalFacesDetected.get()
            + " | Blurred: " + totalFacesBlurred.get();

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛡️ PureShield Active")
            .setContentText(stats)
            .setSmallIcon(R.drawable.ic_shield)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .addAction(R.drawable.ic_shield, "Stop", stopPi)
            .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Restart
    // ─────────────────────────────────────────────────────────────────────────

    private void scheduleRestart() {
        Intent ri = new Intent(this, PureShieldRestartReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(this, 0, ri,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (am != null) am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 3000, pi);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bitmap conversion
    // ─────────────────────────────────────────────────────────────────────────

    private Bitmap imageToBitmap(Image image) {
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer buffer  = planes[0].getBuffer();
        int pixelStride    = planes[0].getPixelStride();
        int rowStride      = planes[0].getRowStride();
        int captureW       = imageReader.getWidth();
        int captureH       = imageReader.getHeight();
        int rowPadding     = rowStride - pixelStride * captureW;

        Bitmap raw = Bitmap.createBitmap(
            captureW + rowPadding / pixelStride,
            captureH, Bitmap.Config.ARGB_8888);
        raw.copyPixelsFromBuffer(buffer);

        // ✅ ALWAYS trim to exact capture size — downstream code assumes
        // bitmap.getWidth() == captureW so coordinates line up with screen.
        if (raw.getWidth() != captureW || raw.getHeight() != captureH) {
            Bitmap trimmed = Bitmap.createBitmap(raw, 0, 0, captureW, captureH);
            raw.recycle();
            return trimmed;
        }
        return raw;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Math utilities
    // ─────────────────────────────────────────────────────────────────────────

    private float sigmoid(float x) { return 1f / (1f + (float) Math.exp(-x)); }

    private List<RectF> nonMaxSuppression(List<RectF> boxes, float iouThreshold) {
        if (boxes.isEmpty()) return boxes;
        List<RectF> result = new ArrayList<>();
        List<RectF> sorted = new ArrayList<>(boxes);
        // ✅ Score নেই তাই area দিয়ে sort — বড় face আগে
        sorted.sort((a, b) -> Float.compare(b.width() * b.height(), a.width() * a.height()));
        boolean[] suppressed = new boolean[sorted.size()];
        for (int i = 0; i < sorted.size(); i++) {
            if (suppressed[i]) continue;
            result.add(sorted.get(i));
            for (int j = i+1; j < sorted.size(); j++) {
                if (!suppressed[j] && iou(sorted.get(i), sorted.get(j)) > iouThreshold)
                    suppressed[j] = true;
            }
        }
        return result;
    }

    private float iou(RectF a, RectF b) {
        float il = Math.max(a.left, b.left), it = Math.max(a.top,  b.top);
        float ir = Math.min(a.right,b.right), ib = Math.min(a.bottom,b.bottom);
        if (ir <= il || ib <= it) return 0f;
        float inter = (ir-il)*(ib-it);
        return inter / (a.width()*a.height() + b.width()*b.height() - inter);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants & inner classes
    // ─────────────────────────────────────────────────────────────────────────

    public static final class Actions {
        public static final String START_PROJECTION       = "PureShield.START_PROJECTION";
        public static final String STOP                   = "PureShield.STOP";
        public static final String UPDATE_CONFIG          = "PureShield.UPDATE_CONFIG";
        public static final String FOREGROUND_APP_CHANGED = "PureShield.FOREGROUND_APP_CHANGED";
        public static final String SWITCH_MODEL_TIER      = "PureShield.SWITCH_MODEL_TIER";
    }

    public static class GenderResult {
        public final float femaleProbability;
        public final float maleProbability;
        GenderResult(float f, float m) {
            this.femaleProbability = f;
            this.maleProbability   = m;
        }
    }
}
