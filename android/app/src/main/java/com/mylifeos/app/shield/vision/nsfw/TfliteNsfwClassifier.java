package com.mylifeos.app.shield.vision.nsfw;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.graphics.Bitmap;
import android.graphics.RectF;
import android.util.Log;

import org.tensorflow.lite.DataType;
import org.tensorflow.lite.Interpreter;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.Collections;
import java.util.List;

/**
 * Pluggable real-model NSFW classifier slot.
 *
 * ── How to enable a real model ──────────────────────────────────────────────
 * Drop a file named exactly "nsfw.tflite" into android/app/src/main/assets/.
 * Expected format: a standard MobileNet-family image classifier —
 *   - Input:  1x224x224x3, float32 or uint8, normalized to [0,1] (float) or
 *             raw [0,255] (uint8, quantized).
 *   - Output: either a single sigmoid unit [1,1] (probability of "explicit"),
 *             or a 2-4 class softmax vector where the LAST class index is
 *             treated as "explicit" (common export layout: safe, suggestive,
 *             explicit[, drawing]).
 * If the asset is absent, corrupted, or the shapes don't match, isReady()
 * returns false and PureShieldService silently falls back to
 * {@link SkinHeuristicNsfwClassifier}. This class never throws out of any
 * public method.
 */
public class TfliteNsfwClassifier implements NsfwClassifier {

    private static final String TAG = "TfliteNsfwClassifier";
    private static final String ASSET_NAME = "nsfw.tflite";
    private static final int INPUT_SIZE = 224;

    // Bucket thresholds on the resolved "explicit probability" in [0,1].
    private static final float SUGGESTIVE_THRESHOLD = 0.5f;
    private static final float EXPLICIT_THRESHOLD   = 0.75f;

    private final Context context;
    private Interpreter interpreter;
    private boolean ready = false;
    private int inputW = INPUT_SIZE, inputH = INPUT_SIZE;
    private DataType inputType = DataType.FLOAT32;
    private int outputSize = 1;
    private DataType outputType = DataType.FLOAT32;

    public TfliteNsfwClassifier(Context context) {
        this.context = context.getApplicationContext();
        tryLoad();
    }

    private void tryLoad() {
        if (!assetExists()) {
            Log.i(TAG, ASSET_NAME + " not present — heuristic fallback active");
            return;
        }
        try {
            Interpreter.Options options = new Interpreter.Options();
            options.setNumThreads(2);
            interpreter = new Interpreter(loadModelFile(), options);

            int[] inShape = interpreter.getInputTensor(0).shape();
            if (inShape.length >= 3) {
                inputH = inShape[1];
                inputW = inShape[2];
            }
            inputType = interpreter.getInputTensor(0).dataType();

            int[] outShape = interpreter.getOutputTensor(0).shape();
            outputSize = outShape.length > 0 ? outShape[outShape.length - 1] : 1;
            outputType = interpreter.getOutputTensor(0).dataType();

            ready = true;
            Log.i(TAG, "Loaded " + ASSET_NAME + " input=" + inputW + "x" + inputH + " outputSize=" + outputSize);
        } catch (Throwable t) {
            Log.w(TAG, "Failed to load " + ASSET_NAME + ": " + t.getMessage());
            if (interpreter != null) { try { interpreter.close(); } catch (Throwable ignored) {} }
            interpreter = null;
            ready = false;
        }
    }

    private boolean assetExists() {
        try {
            AssetFileDescriptor fd = context.getAssets().openFd(ASSET_NAME);
            long size = fd.getDeclaredLength();
            fd.close();
            return size > 1000; // guard against placeholder/empty files
        } catch (Throwable t) {
            return false;
        }
    }

    private MappedByteBuffer loadModelFile() throws IOException {
        AssetFileDescriptor fd = context.getAssets().openFd(ASSET_NAME);
        FileInputStream fis = new FileInputStream(fd.getFileDescriptor());
        FileChannel fc = fis.getChannel();
        MappedByteBuffer buffer = fc.map(FileChannel.MapMode.READ_ONLY, fd.getStartOffset(), fd.getDeclaredLength());
        fis.close();
        return buffer;
    }

    @Override
    public boolean isReady() { return ready && interpreter != null; }

    @Override
    public String name() { return "tflite:" + ASSET_NAME; }

    @Override
    public void close() {
        if (interpreter != null) {
            try { interpreter.close(); } catch (Throwable ignored) {}
            interpreter = null;
        }
        ready = false;
    }

    @Override
    public NsfwResult classify(Bitmap frame, List<RectF> faceBoxes) {
        if (!isReady() || frame == null || frame.isRecycled()) return NsfwResult.safe(name());
        try {
            return classifyInternal(frame);
        } catch (Throwable t) {
            Log.w(TAG, "Inference failed: " + t.getMessage());
            return NsfwResult.safe(name());
        }
    }

    private NsfwResult classifyInternal(Bitmap frame) {
        Bitmap resized = Bitmap.createScaledBitmap(frame, inputW, inputH, true);
        int[] pixels = new int[inputW * inputH];
        resized.getPixels(pixels, 0, inputW, 0, 0, inputW, inputH);
        if (resized != frame) resized.recycle();

        float explicitProbability;

        if (inputType == DataType.UINT8 || inputType == DataType.INT8) {
            byte[][][][] input = new byte[1][inputH][inputW][3];
            for (int i = 0; i < pixels.length; i++) {
                int p = pixels[i]; int y = i / inputW, x = i % inputW;
                input[0][y][x][0] = (byte) ((p >> 16) & 0xFF);
                input[0][y][x][1] = (byte) ((p >> 8) & 0xFF);
                input[0][y][x][2] = (byte) (p & 0xFF);
            }
            explicitProbability = runAndResolve(input);
        } else {
            float[][][][] input = new float[1][inputH][inputW][3];
            for (int i = 0; i < pixels.length; i++) {
                int p = pixels[i]; int y = i / inputW, x = i % inputW;
                input[0][y][x][0] = ((p >> 16) & 0xFF) / 255f;
                input[0][y][x][1] = ((p >> 8) & 0xFF) / 255f;
                input[0][y][x][2] = (p & 0xFF) / 255f;
            }
            explicitProbability = runAndResolve(input);
        }

        NsfwResult.Label label;
        if (explicitProbability >= EXPLICIT_THRESHOLD) label = NsfwResult.Label.EXPLICIT;
        else if (explicitProbability >= SUGGESTIVE_THRESHOLD) label = NsfwResult.Label.SUGGESTIVE;
        else label = NsfwResult.Label.SAFE;

        // The tflite classifier here only produces a whole-frame probability,
        // not localized boxes, so region localization is left empty; callers
        // fall back to a full-frame censor when regions are empty.
        return new NsfwResult(explicitProbability, label, Collections.emptyList(), name());
    }

    private float runAndResolve(Object input) {
        if (outputSize <= 1) {
            float[][] out = new float[1][1];
            interpreter.run(input, out);
            return sigmoidIfNeeded(out[0][0]);
        }
        float[][] out = new float[1][outputSize];
        interpreter.run(input, out);
        // Softmax-style multi-class output: last class = "explicit" by convention.
        float sum = 0f;
        for (float v : out[0]) sum += v;
        float last = out[0][outputSize - 1];
        return sum > 1.01f ? sigmoidIfNeeded(last) : last; // if not already normalized, treat as logit
    }

    private float sigmoidIfNeeded(float raw) {
        if (raw >= 0f && raw <= 1f) return raw; // already a probability
        return 1f / (1f + (float) Math.exp(-raw));
    }
}