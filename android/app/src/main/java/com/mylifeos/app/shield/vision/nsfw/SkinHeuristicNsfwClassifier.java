package com.mylifeos.app.shield.vision.nsfw;

import android.graphics.Bitmap;
import android.graphics.RectF;

import com.mylifeos.app.shield.vision.PureShieldConfig;

import java.util.ArrayList;
import java.util.List;

/**
 * Production heuristic NSFW classifier — no ML model required.
 *
 * Approach (fast, dual color-space skin segmentation):
 *   1. Downscale the frame to a small working width (WORK_WIDTH) so the whole
 *      pipeline runs in single-digit milliseconds.
 *   2. Classify each pixel as "skin" only if it passes BOTH a YCbCr rule and
 *      an HSV rule. Using the intersection of two independent color spaces
 *      is far more robust across skin tones and lighting than any single
 *      RGB/YCbCr threshold, and cuts false positives from orange/red/brown
 *      backgrounds that would fool a single-space rule.
 *   3. Run a 4-connected flood fill (union-find style BFS/DFS on a small grid)
 *      to find connected skin regions, tracking the largest region's area and
 *      a simple compactness measure (area / bounding-box area).
 *   4. Subtract any skin pixels that fall inside a known face box (scaled to
 *      the same working resolution) — a face is expected to contain skin and
 *      must never by itself trigger a nudity flag. This is the primary
 *      false-positive killer for normal portrait photos/selfies.
 *   5. Combine ratios into a single score using named, config-driven
 *      constants (scaled by PureShieldConfig sensitivity), and bucket the
 *      score into SAFE / SUGGESTIVE / EXPLICIT.
 *
 * All thresholds are named constants below (no scattered magic numbers) and
 * are scaled by config.getConfidenceThreshold() so users can tune
 * sensitivity from the same slider used for face blur confidence.
 */
public class SkinHeuristicNsfwClassifier implements NsfwClassifier {

    private static final String NAME = "skin-heuristic";

    // Downscale target width for the whole heuristic — keeps this well under
    // 15ms per frame even on low-end CPUs (128 * ~227 pixels max at 16:9).
    private static final int WORK_WIDTH = 128;

    // ── Base thresholds (before sensitivity scaling) ────────────────────────
    // Fraction of non-face skin pixels (of total pixels) above which we
    // consider the frame SUGGESTIVE / EXPLICIT respectively.
    private static final float BASE_SUGGESTIVE_SKIN_RATIO = 0.22f;
    private static final float BASE_EXPLICIT_SKIN_RATIO   = 0.38f;

    // Fraction of total pixels the single largest connected skin blob must
    // cover (outside faces) to count as a real body-skin region rather than
    // scattered noise (e.g. wood floor, tan wall).
    private static final float BASE_LARGEST_REGION_RATIO = 0.10f;

    // A region must be reasonably compact (not a thin diagonal sliver) to be
    // considered a real skin area rather than a JPEG artifact / gradient.
    private static final float MIN_COMPACTNESS = 0.28f;

    // Weights for the final blended score.
    private static final float WEIGHT_SKIN_RATIO     = 0.55f;
    private static final float WEIGHT_LARGEST_REGION = 0.35f;
    private static final float WEIGHT_COMPACTNESS    = 0.10f;

    private final PureShieldConfig config;

    public SkinHeuristicNsfwClassifier(PureShieldConfig config) {
        this.config = config != null ? config : new PureShieldConfig();
    }

    @Override
    public boolean isReady() { return true; }

    @Override
    public String name() { return NAME; }

    @Override
    public void close() { /* no native resources */ }

    @Override
    public NsfwResult classify(Bitmap frame, List<RectF> faceBoxes) {
        if (frame == null || frame.isRecycled() || frame.getWidth() < 4 || frame.getHeight() < 4) {
            return NsfwResult.safe(NAME);
        }
        try {
            return classifyInternal(frame, faceBoxes);
        } catch (Throwable t) {
            // Heuristic must never crash the pipeline.
            return NsfwResult.safe(NAME);
        }
    }

    private NsfwResult classifyInternal(Bitmap frame, List<RectF> faceBoxes) {
        int srcW = frame.getWidth(), srcH = frame.getHeight();
        int workW = Math.min(WORK_WIDTH, srcW);
        int workH = Math.max(1, Math.round(srcH * (workW / (float) srcW)));

        Bitmap small = Bitmap.createScaledBitmap(frame, workW, workH, false);
        int[] pixels = new int[workW * workH];
        small.getPixels(pixels, 0, workW, 0, 0, workW, workH);
        if (small != frame) small.recycle();

        boolean[] skin = new boolean[workW * workH];
        boolean[] faceMask = buildFaceMask(faceBoxes, workW, workH);

        int totalPixels = workW * workH;
        int skinPixelCount = 0;
        int nonFaceSkinCount = 0;

        for (int i = 0; i < totalPixels; i++) {
            int p = pixels[i];
            int r = (p >> 16) & 0xFF, g = (p >> 8) & 0xFF, b = p & 0xFF;
            if (isSkinPixelDualSpace(r, g, b)) {
                skin[i] = true;
                skinPixelCount++;
                if (!faceMask[i]) nonFaceSkinCount++;
            }
        }

        // Connected components (4-connectivity) over non-face skin pixels only —
        // face skin must never contribute to the "largest region" nudity signal.
        boolean[] visited = new boolean[totalPixels];
        int largestArea = 0;
        int largestBoxArea = 1;
        List<RectF> candidateRegions = new ArrayList<>();

        int[] stack = new int[totalPixels];
        for (int start = 0; start < totalPixels; start++) {
            if (visited[start] || !skin[start] || faceMask[start]) continue;

            int sp = 0;
            stack[sp++] = start;
            visited[start] = true;
            int area = 0;
            int minX = workW, minY = workH, maxX = 0, maxY = 0;

            while (sp > 0) {
                int idx = stack[--sp];
                int x = idx % workW, y = idx / workW;
                area++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;

                // 4-neighbors — inline push (avoids cross-call shared state)
                if (x > 0) {
                    int n = idx - 1;
                    if (!visited[n] && skin[n] && !faceMask[n]) { visited[n] = true; stack[sp++] = n; }
                }
                if (x < workW - 1) {
                    int n = idx + 1;
                    if (!visited[n] && skin[n] && !faceMask[n]) { visited[n] = true; stack[sp++] = n; }
                }
                if (y > 0) {
                    int n = idx - workW;
                    if (!visited[n] && skin[n] && !faceMask[n]) { visited[n] = true; stack[sp++] = n; }
                }
                if (y < workH - 1) {
                    int n = idx + workW;
                    if (!visited[n] && skin[n] && !faceMask[n]) { visited[n] = true; stack[sp++] = n; }
                }
            }

            int boxArea = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
            if (area > largestArea) {
                largestArea = area;
                largestBoxArea = boxArea;
            }
            if (area > totalPixels * 0.02f) {
                candidateRegions.add(new RectF(minX / (float) workW, minY / (float) workH,
                    (maxX + 1) / (float) workW, (maxY + 1) / (float) workH));
            }
        }

        float skinRatio          = totalPixels > 0 ? nonFaceSkinCount / (float) totalPixels : 0f;
        float largestRegionRatio = totalPixels > 0 ? largestArea / (float) totalPixels : 0f;
        float compactness        = largestArea > 0 ? largestArea / (float) largestBoxArea : 0f;

        // Sensitivity: PureShieldConfig.confidenceThreshold is in [0.05, 0.95];
        // map it so a lower threshold (more sensitive) proportionally lowers
        // our trigger thresholds, and a higher threshold makes us stricter.
        float sensitivity = config != null ? config.getConfidenceThreshold() : 0.4f;
        float sensitivityScale = 0.6f + (0.5f - sensitivity); // ~[0.65 .. 1.05]

        float suggestiveThreshold = BASE_SUGGESTIVE_SKIN_RATIO * sensitivityScale;
        float explicitThreshold   = BASE_EXPLICIT_SKIN_RATIO   * sensitivityScale;
        float largestRegionThreshold = BASE_LARGEST_REGION_RATIO * sensitivityScale;

        float compactnessScore = compactness >= MIN_COMPACTNESS ? compactness : 0f;
        float blended = (skinRatio * WEIGHT_SKIN_RATIO)
            + (largestRegionRatio * WEIGHT_LARGEST_REGION)
            + (compactnessScore * WEIGHT_COMPACTNESS);
        float score = Math.max(0f, Math.min(1f, blended));

        NsfwResult.Label label;
        boolean explicitHit = skinRatio >= explicitThreshold
            && largestRegionRatio >= largestRegionThreshold
            && compactness >= MIN_COMPACTNESS;
        boolean suggestiveHit = skinRatio >= suggestiveThreshold;

        if (explicitHit) {
            label = NsfwResult.Label.EXPLICIT;
        } else if (suggestiveHit) {
            label = NsfwResult.Label.SUGGESTIVE;
        } else {
            label = NsfwResult.Label.SAFE;
        }

        List<RectF> regions = label == NsfwResult.Label.EXPLICIT ? candidateRegions : new ArrayList<>();
        return new NsfwResult(score, label, regions, NAME);
    }

    /**
     * Marks working-resolution pixels that fall inside any detected face box
     * (with small padding) so face skin is excluded from nudity scoring.
     */
    private boolean[] buildFaceMask(List<RectF> faceBoxes, int workW, int workH) {
        boolean[] mask = new boolean[workW * workH];
        if (faceBoxes == null || faceBoxes.isEmpty()) return mask;
        for (RectF box : faceBoxes) {
            if (box == null) continue;
            // Pad the face box outward by 20% so neck/jaw skin near the face
            // (still clearly "face area", not nudity) is also excluded.
            float padX = box.width() * 0.2f, padY = box.height() * 0.2f;
            int left   = Math.max(0, Math.round((box.left   - padX) * workW));
            int top    = Math.max(0, Math.round((box.top    - padY) * workH));
            int right  = Math.min(workW, Math.round((box.right  + padX) * workW));
            int bottom = Math.min(workH, Math.round((box.bottom + padY) * workH));
            for (int y = top; y < bottom; y++) {
                int rowBase = y * workW;
                for (int x = left; x < right; x++) mask[rowBase + x] = true;
            }
        }
        return mask;
    }

    /**
     * Dual color-space skin detection: pixel must satisfy BOTH the YCbCr rule
     * AND the HSV rule to be classified as skin. This intersection is far more
     * robust across skin tones (light/medium/dark) than a single-space rule.
     */
    private boolean isSkinPixelDualSpace(int r, int g, int b) {
        // ── YCbCr rule (widely used, tone-tolerant when combined with HSV) ──
        double y  = 0.299 * r + 0.587 * g + 0.114 * b;
        double cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        double cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        boolean ycbcrSkin = y > 40
            && cb >= 77 && cb <= 135
            && cr >= 133 && cr <= 180;

        // ── HSV rule ─────────────────────────────────────────────────────────
        float[] hsv = new float[3];
        android.graphics.Color.RGBToHSV(r, g, b, hsv);
        float hue = hsv[0], sat = hsv[1], val = hsv[2];
        boolean hsvSkin = (hue >= 0f && hue <= 50f)
            && sat >= 0.12f && sat <= 0.75f
            && val >= 0.25f;

        return ycbcrSkin && hsvSkin;
    }
}
