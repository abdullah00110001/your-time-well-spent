package com.mylifeos.app.shield.vision;

import android.content.Context;
import android.graphics.*;
import android.view.View;

/**
 * PureShieldBlurView — Face blur overlay
 *
 * ✅ v2 Changes:
 *   1. Oval → Rounded Rectangle (Muslim AI Browser style)
 *   2. Stack Blur algorithm — smooth gaussian, no RenderScript needed
 *   3. Face angle rotation — canvas.rotate() দিয়ে tilt করা face ও ঠিকমতো cover
 *   4. Feathered edge — hard border নেই
 *   5. All styles rounded rect এ converted
 */
public class PureShieldBlurView extends View {

    public enum BlurStyle {
        PIXELATE, SMUDGE, DOTS, BLUR, FROSTED, SOLID, MOSAIC
    }

    private BlurStyle blurStyle    = BlurStyle.BLUR;
    private int       overlayAlpha = 255;
    private boolean   debugOverlay = false;
    private Bitmap    sourceBitmap = null;
    private float     faceAngle    = 0f;   // ✅ rotation angle (degrees)

    private final Paint paint;
    private final Paint edgePaint;
    private final Paint pixelPaint;
    private final Paint bitmapPaint;

    // ✅ Rounded rect corner radius — % of shorter side
    private static final float CORNER_RADIUS_FRAC = 0.18f;
    private static final int   PIXEL_BLOCK        = 10;

    public PureShieldBlurView(Context context) {
        super(context);
        setWillNotDraw(false);
        setLayerType(LAYER_TYPE_SOFTWARE, null);
        setBackgroundColor(Color.TRANSPARENT);

        paint      = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.FILL);

        edgePaint  = new Paint(Paint.ANTI_ALIAS_FLAG);
        edgePaint.setStyle(Paint.Style.FILL);

        pixelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        pixelPaint.setStyle(Paint.Style.FILL);
        pixelPaint.setFilterBitmap(false);

        bitmapPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    }

    public void setBlurStyle(BlurStyle style) {
        this.blurStyle = (style != null) ? style : BlurStyle.BLUR;
        invalidate();
    }

    public void setSourceBitmap(Bitmap bmp) {
        Bitmap old = this.sourceBitmap;
        this.sourceBitmap = bmp;
        if (old != null && old != bmp && !old.isRecycled()) {
            try { old.recycle(); } catch (Throwable ignored) {}
        }
        invalidate();
    }

    public void setOverlayOpacity(int opacityPercent) {
        overlayAlpha = Math.round(255f * Math.max(20, Math.min(100, opacityPercent)) / 100f);
        invalidate();
    }

    public void setDebugOverlay(boolean enabled) {
        this.debugOverlay = enabled;
        invalidate();
    }

    /** ✅ Face rotation angle (degrees). BlazeFace eye keypoints থেকে calculate করা হয়। */
    public void setFaceAngle(float angleDegrees) {
        this.faceAngle = angleDegrees;
        invalidate();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // onDraw
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int w = getWidth(), h = getHeight();
        if (w <= 0 || h <= 0) return;

        canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);

        // ✅ Rotate canvas around center for tilted faces
        float cx = w / 2f, cy = h / 2f;
        if (Math.abs(faceAngle) > 1f) {
            canvas.save();
            canvas.rotate(faceAngle, cx, cy);
        }

        if (sourceBitmap != null && !sourceBitmap.isRecycled()
                && blurStyle != BlurStyle.SOLID) {
            drawRealBlur(canvas, w, h);
        } else {
            switch (blurStyle) {
                case PIXELATE: drawPixelate(canvas, w, h); break;
                case SMUDGE:   drawSmudge(canvas, w, h);   break;
                case DOTS:     drawDots(canvas, w, h);     break;
                case BLUR:     drawBlur(canvas, w, h);     break;
                case FROSTED:  drawFrosted(canvas, w, h);  break;
                case SOLID:    drawSolid(canvas, w, h);    break;
                case MOSAIC:   drawMosaic(canvas, w, h);   break;
            }
        }

        if (Math.abs(faceAngle) > 1f) canvas.restore();

        if (debugOverlay) drawDebugBox(canvas, w, h);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rounded rect path helper
    // ─────────────────────────────────────────────────────────────────────────

    private RectF makeRect(int w, int h) {
        return new RectF(0, 0, w, h);
    }

    private float cornerRadius(int w, int h) {
        return Math.min(w, h) * CORNER_RADIUS_FRAC;
    }

    private Path makeRoundRectPath(int w, int h) {
        Path path = new Path();
        float r = cornerRadius(w, h);
        path.addRoundRect(makeRect(w, h), r, r, Path.Direction.CW);
        return path;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ✅ Real pixel blur — Stack Blur (smooth gaussian, no RenderScript)
    // ─────────────────────────────────────────────────────────────────────────

    private void drawRealBlur(Canvas canvas, int w, int h) {
        canvas.save();
        float r = cornerRadius(w, h);
        canvas.clipPath(makeRoundRectPath(w, h));

        int srcW = sourceBitmap.getWidth();
        int srcH = sourceBitmap.getHeight();
        if (srcW <= 0 || srcH <= 0) { canvas.restore(); return; }

        bitmapPaint.setAlpha(overlayAlpha);
        pixelPaint.setAlpha(overlayAlpha);

        try {
            if (blurStyle == BlurStyle.PIXELATE || blurStyle == BlurStyle.MOSAIC) {
                // Pixelate: downsample to 14px, upscale without filtering
                int tiny = 14;
                Bitmap small = Bitmap.createScaledBitmap(sourceBitmap, tiny, tiny, false);
                pixelPaint.setFilterBitmap(false);
                canvas.drawBitmap(small, null, makeRect(w, h), pixelPaint);
                if (small != sourceBitmap) small.recycle();
            } else {
                // ✅ Stack Blur — smooth gaussian-like blur
                Bitmap blurred = stackBlur(sourceBitmap, 14);
                bitmapPaint.setFilterBitmap(true);
                canvas.drawBitmap(blurred, null, makeRect(w, h), bitmapPaint);
                if (blurred != sourceBitmap) blurred.recycle();

                // Subtle dark veil so face is not readable
                paint.setShader(null);
                paint.setColor(Color.argb(
                    Math.round(55f * overlayAlpha / 255f), 0, 0, 0));
                canvas.drawRoundRect(makeRect(w, h), r, r, paint);
            }
        } catch (Throwable t) {
            // OOM fallback
            paint.setShader(null);
            paint.setColor(Color.argb(230, 200, 210, 230));
            canvas.drawRoundRect(makeRect(w, h), r, r, paint);
        }

        canvas.restore();
        bitmapPaint.setAlpha(255);
        pixelPaint.setAlpha(255);
        drawFeatheredEdge(canvas, w, h, Color.argb(70, 60, 70, 90));
    }

    /**
     * ✅ Stack Blur — pure Java, no API dependency.
     * radius: blur strength (8–20 recommended)
     * Approach: 3-pass downsample + upscale (effective gaussian approximation)
     */
    private Bitmap stackBlur(Bitmap src, int radius) {
        // Pass 1: heavy downsample
        int s1 = Math.max(6, Math.min(src.getWidth(), src.getHeight()) / radius);
        Bitmap pass1 = Bitmap.createScaledBitmap(src, s1, s1, true);
        // Pass 2: downsample again
        int s2 = Math.max(4, s1 / 2);
        Bitmap pass2 = Bitmap.createScaledBitmap(pass1, s2, s2, true);
        if (pass1 != src) pass1.recycle();
        // Pass 3: upscale with bilinear — this creates smooth blur
        Bitmap result = Bitmap.createScaledBitmap(pass2, src.getWidth(), src.getHeight(), true);
        if (pass2 != src) pass2.recycle();
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. BLUR
    // ─────────────────────────────────────────────────────────────────────────

    private void drawBlur(Canvas canvas, int w, int h) {
        float r = cornerRadius(w, h);
        canvas.save();
        canvas.clipPath(makeRoundRectPath(w, h));

        paint.setShader(null);
        paint.setColor(Color.argb(245, 255, 255, 255));
        canvas.drawRoundRect(makeRect(w, h), r, r, paint);

        float cx = w / 2f, cy = h / 2f;
        float radius = Math.max(w, h) / 1.4f;

        RadialGradient g1 = new RadialGradient(cx, cy, radius * 0.4f,
            new int[]{Color.argb(245,255,255,255), Color.argb(220,240,245,255), Color.argb(0,240,245,255)},
            new float[]{0f, 0.6f, 1f}, Shader.TileMode.CLAMP);
        paint.setShader(g1);
        canvas.drawRoundRect(makeRect(w, h), r, r, paint);
        paint.setShader(null);

        RadialGradient g2 = new RadialGradient(cx, cy * 0.7f, radius * 0.65f,
            new int[]{Color.argb(120,255,255,255), Color.argb(60,230,235,248), Color.argb(0,230,235,248)},
            new float[]{0f, 0.55f, 1f}, Shader.TileMode.CLAMP);
        paint.setShader(g2);
        canvas.drawRoundRect(makeRect(w, h), r, r, paint);
        paint.setShader(null);

        canvas.restore();
        drawFeatheredEdge(canvas, w, h, Color.argb(60, 180, 200, 235));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. SMUDGE
    // ─────────────────────────────────────────────────────────────────────────

    private void drawSmudge(Canvas canvas, int w, int h) {
        float r = cornerRadius(w, h);
        canvas.save();
        canvas.clipPath(makeRoundRectPath(w, h));

        paint.setShader(null);
        paint.setColor(Color.argb(240, 248, 250, 255));
        canvas.drawRect(0, 0, w, h, paint);

        Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setStrokeCap(Paint.Cap.ROUND);
        strokePaint.setMaskFilter(new BlurMaskFilter(8f, BlurMaskFilter.Blur.NORMAL));

        int[][] smudgeColors = {
            {160,165,175,80},{140,148,165,70},{175,180,190,60},
            {130,138,155,75},{190,194,200,55},{155,160,172,85},
        };
        for (int i = 0; i < 8; i++) {
            int[] c = smudgeColors[i % smudgeColors.length];
            strokePaint.setColor(Color.argb(c[3], c[0], c[1], c[2]));
            strokePaint.setStrokeWidth(w * 0.08f + i * 2);
            float yPos = h * (0.1f + i * 0.11f);
            float waveAmp = h * 0.06f;
            Path wavePath = new Path();
            wavePath.moveTo(-w * 0.1f, yPos);
            for (float x = 0; x <= w * 1.1f; x += w * 0.15f) {
                float y = yPos + (float)(Math.sin(x / (w * 0.3f) + i * 0.7f) * waveAmp);
                wavePath.lineTo(x, y);
            }
            canvas.drawPath(wavePath, strokePaint);
        }

        canvas.restore();
        drawFeatheredEdge(canvas, w, h, Color.argb(70, 140, 150, 170));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. DOTS
    // ─────────────────────────────────────────────────────────────────────────

    private void drawDots(Canvas canvas, int w, int h) {
        canvas.save();
        canvas.clipPath(makeRoundRectPath(w, h));

        paint.setShader(null);
        paint.setColor(Color.argb(230, 245, 247, 255));
        canvas.drawRect(0, 0, w, h, paint);

        int spacing = Math.max(8, Math.min(w, h) / 9);
        float dotR = spacing * 0.32f;
        int[] dotColors = {
            Color.argb(200,60,80,120), Color.argb(180,80,100,150),
            Color.argb(160,40,60,100), Color.argb(190,70,90,135),
        };
        for (int y = spacing/2; y < h; y += spacing) {
            for (int x = spacing/2; x < w; x += spacing) {
                int hash = Math.abs(x/spacing*7 + y/spacing*13) % dotColors.length;
                pixelPaint.setColor(dotColors[hash]);
                canvas.drawCircle(x, y, dotR, pixelPaint);
            }
        }

        canvas.restore();
        drawFeatheredEdge(canvas, w, h, Color.argb(80, 60, 80, 140));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. PIXELATE
    // ─────────────────────────────────────────────────────────────────────────

    private void drawPixelate(Canvas canvas, int w, int h) {
        canvas.save();
        canvas.clipPath(makeRoundRectPath(w, h));

        int[] colors = {
            Color.rgb(210,170,130), Color.rgb(185,145,105), Color.rgb(230,195,160),
            Color.rgb(160,120,85),  Color.rgb(240,210,175), Color.rgb(120,90,70),
            Color.rgb(195,160,125), Color.rgb(80,60,50),
        };
        for (int y = 0; y < h; y += PIXEL_BLOCK) {
            for (int x = 0; x < w; x += PIXEL_BLOCK) {
                int hash = Math.abs(x/PIXEL_BLOCK*31 + y/PIXEL_BLOCK*17) % colors.length;
                pixelPaint.setColor(colors[hash]);
                canvas.drawRect(x, y, Math.min(x+PIXEL_BLOCK,w), Math.min(y+PIXEL_BLOCK,h), pixelPaint);
            }
        }

        canvas.restore();
        drawFeatheredEdge(canvas, w, h, Color.argb(80, 100, 70, 50));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. FROSTED
    // ─────────────────────────────────────────────────────────────────────────

    private void drawFrosted(Canvas canvas, int w, int h) {
        float r = cornerRadius(w, h);

        // Outer glow
        for (int ring = 6; ring >= 1; ring--) {
            float s = 1f + ring * 0.02f;
            edgePaint.setShader(null);
            edgePaint.setColor(Color.argb(ring * 8, 180, 200, 240));
            float cx = w/2f, cy = h/2f;
            canvas.drawRoundRect(new RectF(
                cx-(w/2f)*s, cy-(h/2f)*s, cx+(w/2f)*s, cy+(h/2f)*s),
                r*s, r*s, edgePaint);
        }

        canvas.save();
        canvas.clipPath(makeRoundRectPath(w, h));

        RadialGradient gradient = new RadialGradient(
            w/2f, h*0.38f, Math.max(w,h)/1.5f,
            new int[]{Color.argb(240,250,252,255), Color.argb(245,225,235,252),
                      Color.argb(248,195,210,240), Color.argb(250,160,178,220)},
            new float[]{0f, 0.40f, 0.72f, 1f}, Shader.TileMode.CLAMP);
        paint.setShader(gradient);
        canvas.drawRoundRect(makeRect(w,h), r, r, paint);
        paint.setShader(null);

        RadialGradient shimmer = new RadialGradient(
            w*0.38f, h*0.22f, w*0.45f,
            new int[]{Color.argb(120,255,255,255), Color.argb(0,255,255,255)},
            null, Shader.TileMode.CLAMP);
        paint.setShader(shimmer);
        canvas.drawRoundRect(makeRect(w,h), r, r, paint);
        paint.setShader(null);

        canvas.restore();
        drawFeatheredEdge(canvas, w, h, Color.argb(90, 120, 150, 200));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. SOLID
    // ─────────────────────────────────────────────────────────────────────────

    private void drawSolid(Canvas canvas, int w, int h) {
        float r = cornerRadius(w, h);

        canvas.save();
        canvas.clipPath(makeRoundRectPath(w, h));

        RadialGradient gradient = new RadialGradient(
            w/2f, h/3f, Math.max(w,h)*0.7f,
            new int[]{Color.argb(240,30,42,68), Color.argb(250,10,16,35)},
            null, Shader.TileMode.CLAMP);
        paint.setShader(gradient);
        canvas.drawRoundRect(makeRect(w,h), r, r, paint);
        paint.setShader(null);

        canvas.restore();
        drawShieldIcon(canvas, w, h, Color.argb(180, 255, 255, 255));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. MOSAIC
    // ─────────────────────────────────────────────────────────────────────────

    private void drawMosaic(Canvas canvas, int w, int h) {
        float r = cornerRadius(w, h);
        canvas.save();
        canvas.clipPath(makeRoundRectPath(w, h));

        int block = Math.max(10, Math.min(w,h)/7);
        int[] colors = {
            Color.rgb(15,23,42), Color.rgb(8,145,178), Color.rgb(226,232,240),
            Color.rgb(51,65,85), Color.rgb(30,58,138), Color.rgb(100,116,139),
            Color.rgb(14,116,144), Color.rgb(71,85,105),
        };
        for (int y = 0; y < h; y += block) {
            for (int x = 0; x < w; x += block) {
                int hash = Math.abs(x/block*13 + y/block*7) % colors.length;
                pixelPaint.setColor(colors[hash]);
                canvas.drawRoundRect(
                    new RectF(x+1f, y+1f, Math.min(x+block,w)-1f, Math.min(y+block,h)-1f),
                    3f, 3f, pixelPaint);
            }
        }

        canvas.restore();
        drawFeatheredEdge(canvas, w, h, Color.argb(100, 8, 145, 178));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** ✅ Feathered rounded-rect border */
    private void drawFeatheredEdge(Canvas canvas, int w, int h, int color) {
        float r = cornerRadius(w, h);
        paint.setShader(null);
        edgePaint.setShader(null);
        int cr = Color.red(color), cg = Color.green(color), cb = Color.blue(color);
        for (int ring = 5; ring >= 1; ring--) {
            float s = 1f - ring * 0.025f;
            edgePaint.setColor(Color.argb(ring * 16, cr, cg, cb));
            float cx = w/2f, cy = h/2f;
            canvas.drawRoundRect(new RectF(
                cx-(w/2f)*s, cy-(h/2f)*s, cx+(w/2f)*s, cy+(h/2f)*s),
                r*s, r*s, edgePaint);
        }
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1.5f);
        paint.setColor(color);
        canvas.drawRoundRect(new RectF(1f, 1f, w-1f, h-1f), r, r, paint);
        paint.setStyle(Paint.Style.FILL);
    }

    private void drawShieldIcon(Canvas canvas, int w, int h, int color) {
        float size = Math.min(w, h) * 0.28f;
        if (size < 8f) return;
        paint.setShader(null);
        paint.setColor(color);
        paint.setTextSize(size);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(Typeface.DEFAULT);
        canvas.drawText("🛡", w/2f, h/2f + size*0.38f, paint);
    }

    private void drawDebugBox(Canvas canvas, int w, int h) {
        paint.setShader(null);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(3f);
        paint.setColor(0xFF22C55E);
        canvas.drawRect(1, 1, w-1, h-1, paint);
        paint.setStyle(Paint.Style.FILL);
    }
}
