package com.mylifeos.app.shield.vision.nsfw;

import android.graphics.RectF;

import java.util.Collections;
import java.util.List;

/**
 * Result of an NSFW classification pass over a single captured frame.
 */
public final class NsfwResult {

    public enum Label { SAFE, SUGGESTIVE, EXPLICIT }

    /** Confidence score in [0,1] that the frame contains explicit content. */
    public final float score;

    /** Coarse classification bucket derived from {@link #score}. */
    public final Label label;

    /** Regions (normalized 0..1 image-space rects) that should be censored. Empty = full-frame censor. */
    public final List<RectF> regions;

    /** Name of the classifier that produced this result (for debugging/telemetry). */
    public final String sourceName;

    public NsfwResult(float score, Label label, List<RectF> regions, String sourceName) {
        this.score = score;
        this.label = label;
        this.regions = regions != null ? regions : Collections.emptyList();
        this.sourceName = sourceName;
    }

    public static NsfwResult safe(String sourceName) {
        return new NsfwResult(0f, Label.SAFE, Collections.emptyList(), sourceName);
    }

    public boolean isExplicit() { return label == Label.EXPLICIT; }
    public boolean isSuggestive() { return label == Label.SUGGESTIVE; }
}
