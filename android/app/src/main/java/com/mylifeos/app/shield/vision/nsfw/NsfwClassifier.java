package com.mylifeos.app.shield.vision.nsfw;

import android.graphics.Bitmap;
import android.graphics.RectF;

import java.util.List;

/**
 * Pluggable NSFW (nudity/explicit content) classifier contract.
 *
 * Implementations must be safe to call once per sampled frame from a
 * background inference thread. {@link #classify(Bitmap, List)} must never
 * throw — on internal failure it should return {@link NsfwResult#safe}.
 */
public interface NsfwClassifier {

    /**
     * Classify a single captured frame.
     *
     * @param frame     the captured frame bitmap (NOT recycled by the classifier).
     * @param faceBoxes normalized (0..1) face bounding boxes already detected in this
     *                  frame by the face detector — used so classifiers can exclude
     *                  ordinary face/skin area from nudity scoring.
     */
    NsfwResult classify(Bitmap frame, List<RectF> faceBoxes);

    /** Whether this classifier is fully initialized and able to run classify(). */
    boolean isReady();

    /** Human readable identifier, e.g. "skin-heuristic" or "tflite:nsfw.tflite". */
    String name();

    /** Release any native/model resources. Safe to call multiple times. */
    void close();
}
