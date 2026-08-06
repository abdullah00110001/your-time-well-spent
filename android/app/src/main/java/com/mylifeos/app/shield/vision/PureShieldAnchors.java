package com.mylifeos.app.shield.vision;

/**
 * PureShieldAnchors
 *
 * Pre-computed anchor boxes for BlazeFace (128x128 input model).
 * These are generated once and hardcoded to avoid runtime computation.
 *
 * BlazeFace uses 896 anchors across 2 feature map layers:
 *   - Layer 1: 16x16 grid, 2 anchors/cell = 512 anchors
 *   - Layer 2: 8x8 grid, 6 anchors/cell = 384 anchors
 *   Total: 896 anchors
 *
 * Source: MediaPipe BlazeFace model spec
 * https://arxiv.org/abs/1907.05047
 */
public final class PureShieldAnchors {

    private PureShieldAnchors() {}

    public static final float[] X_CENTER;
    public static final float[] Y_CENTER;
    public static final float[] WIDTH;
    public static final float[] HEIGHT;

    static {
        X_CENTER = new float[896];
        Y_CENTER = new float[896];
        WIDTH    = new float[896];
        HEIGHT   = new float[896];
        generateAnchors();
    }

    private static void generateAnchors() {
        // Layer 1: 16x16, 2 anchors per cell
        int idx = 0;
        for (int row = 0; row < 16; row++) {
            for (int col = 0; col < 16; col++) {
                for (int anchor = 0; anchor < 2; anchor++) {
                    X_CENTER[idx] = (col + 0.5f) / 16f;
                    Y_CENTER[idx] = (row + 0.5f) / 16f;
                    WIDTH[idx]    = 1.0f;
                    HEIGHT[idx]   = 1.0f;
                    idx++;
                }
            }
        }
        // Layer 2: 8x8, 6 anchors per cell
        for (int row = 0; row < 8; row++) {
            for (int col = 0; col < 8; col++) {
                for (int anchor = 0; anchor < 6; anchor++) {
                    X_CENTER[idx] = (col + 0.5f) / 8f;
                    Y_CENTER[idx] = (row + 0.5f) / 8f;
                    WIDTH[idx]    = 1.0f;
                    HEIGHT[idx]   = 1.0f;
                    idx++;
                }
            }
        }
    }
}
