package com.mylifeos.app.nighttorise;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.animation.DecelerateInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * [N2R-CARD] Card-only Sleep/Rise block UI, illustrated version.
 *
 * Adds a small painted scene (night sky + moon + cottage for Sleep, sunrise +
 * clouds + cottage for Rise) above the same text/stat/button layout the
 * simple card already had. Everything is drawn once in onDraw() — there is
 * deliberately NO looping animation here (no twinkling stars, no drifting
 * clouds): this screen can be rebuilt often by its callers, and a Handler or
 * ValueAnimator left running across rebuilds is exactly the kind of thing
 * that caused real problems before. The only animation is the one-shot
 * entrance fade the card already used.
 *
 * Public API (Handles, build()) is unchanged from the previous version, so
 * NightToRiseBlockActivity, BlockingOverlay and NightToRiseLockScreen all
 * keep working without changes.
 */
public final class NightToRiseBlockCard {

    private NightToRiseBlockCard() {}

    /** Live widgets the caller (the Activity) updates and attaches listeners to. */
    public static final class Handles {
        public final View root;
        public final View content;
        public final TextView pill;
        public final TextView title;
        public final TextView message;
        public final TextView countdown;
        public final View countdownBox;
        /** The second stat box, e.g. "6:30 AM" / "ALARM". Set with setEndTime() or directly. */
        public final TextView endTime;
        public final LinearLayout allowedContainer;
        public final Button home;
        public final Button override;

        Handles(View root, View content, TextView pill, TextView title, TextView message,
                TextView countdown, View countdownBox, TextView endTime,
                LinearLayout allowedContainer, Button home, Button override) {
            this.root = root; this.content = content; this.pill = pill; this.title = title;
            this.message = message; this.countdown = countdown; this.countdownBox = countdownBox;
            this.endTime = endTime;
            this.allowedContainer = allowedContainer; this.home = home; this.override = override;
        }

        /** Convenience: format and set an absolute epoch-ms end time, e.g. setEndTime(endMs). */
        public void setEndTime(long epochMs) {
            if (endTime != null) endTime.setText(formatClock(epochMs));
        }
    }

    private static int blend(int c, int with, float amount) {
        int a = Math.round(Color.alpha(c) * (1 - amount) + Color.alpha(with) * amount);
        int r = Math.round(Color.red(c) * (1 - amount) + Color.red(with) * amount);
        int g = Math.round(Color.green(c) * (1 - amount) + Color.green(with) * amount);
        int b = Math.round(Color.blue(c) * (1 - amount) + Color.blue(with) * amount);
        return Color.argb(a, r, g, b);
    }

    private static int alpha(int c, int a) {
        return Color.argb(a, Color.red(c), Color.green(c), Color.blue(c));
    }

    /** cheap, fixed pseudo-random sequence — same scene every time, no Random object kept around */
    private static final class Rng {
        private int seed;
        Rng(int seed) { this.seed = seed; }
        float next() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280f; }
    }

    // ------------------------------------------------------------------
    // The scene: sky + stars/moon (sleep) or sun/rays/clouds (rise) + hills + cottage.
    // Drawn once; no animation loop.
    // ------------------------------------------------------------------
    private static final class SceneView extends View {
        private final boolean rise;
        private Bitmap cache; // drawn once at final size, then just blitted

        SceneView(Context ctx, boolean rise) {
            super(ctx);
            this.rise = rise;
        }

        @Override protected void onSizeChanged(int w, int h, int ow, int oh) {
            super.onSizeChanged(w, h, ow, oh);
            if (w <= 0 || h <= 0) return;
            try {
                cache = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                Canvas c = new Canvas(cache);
                if (rise) drawRise(c, w, h); else drawSleep(c, w, h);
            } catch (Throwable t) {
                cache = null; // low-memory device: onDraw falls back to a flat colour
            }
        }

        @Override protected void onDraw(Canvas c) {
            if (cache != null && !cache.isRecycled()) {
                c.drawBitmap(cache, 0, 0, null);
            } else {
                Paint p = new Paint();
                p.setColor(rise ? 0xFF4A2242 : 0xFF151A3A);
                c.drawRect(0, 0, getWidth(), getHeight(), p);
            }
        }

        // ---------------- sleep scene ----------------
        private void drawSleep(Canvas c, int w, int h) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

            // sky
            p.setShader(new LinearGradient(0, 0, 0, h,
                new int[]{0xFF060924, 0xFF141A55, 0xFF2B2470}, new float[]{0f, 0.6f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(0, 0, w, h, p);
            p.setShader(null);

            // soft nebula glow, top-right
            p.setShader(new RadialGradient(w * 0.82f, h * 0.18f, w * 0.65f,
                alpha(0xFF7C5CF0, 70), alpha(0xFF7C5CF0, 0), Shader.TileMode.CLAMP));
            c.drawRect(0, 0, w, h, p);
            p.setShader(null);

            // stars
            Rng r = new Rng(7);
            p.setColor(Color.WHITE);
            for (int i = 0; i < 34; i++) {
                float x = r.next() * w, y = r.next() * h * 0.62f;
                float rad = 0.6f + r.next() * 1.1f;
                p.setAlpha(90 + (int) (r.next() * 120));
                c.drawCircle(x, y, rad, p);
            }
            p.setAlpha(255);

            // moon (crescent), upper area
            float mr = Math.max(16f, h * 0.17f);
            float mx = w * 0.62f, my = h * 0.32f;
            p.setShader(new RadialGradient(mx, my, mr * 3.2f,
                alpha(0xFFFFF2C8, 110), alpha(0xFFCFC2FF, 0), Shader.TileMode.CLAMP));
            c.drawCircle(mx, my, mr * 3.2f, p);
            p.setShader(null);

            int save = c.saveLayer(mx - mr, my - mr, mx + mr, my + mr, null);
            p.setShader(new LinearGradient(mx - mr, my - mr, mx + mr, my + mr,
                0xFFFFFBE6, 0xFFE9DCA8, Shader.TileMode.CLAMP));
            c.drawCircle(mx, my, mr, p);
            p.setShader(null);
            p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.DST_OUT));
            c.drawCircle(mx + mr * 0.42f, my - mr * 0.22f, mr * 0.86f, p);
            p.setXfermode(null);
            c.restoreToCount(save);

            // hills (two layers) + cottage
            drawHills(c, w, h, 0xFF101340, 0xFF232A55);
            drawCottage(c, w * 0.13f, h * 0.885f, h * 0.1f, 0xFF0A0C2E, true);
        }

        // ---------------- rise scene ----------------
        private void drawRise(Canvas c, int w, int h) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

            p.setShader(new LinearGradient(0, 0, 0, h,
                new int[]{0xFF23123F, 0xFF6A2C6E, 0xFFD1506A, 0xFFF7955A, 0xFFFFC47D},
                new float[]{0f, 0.36f, 0.62f, 0.82f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(0, 0, w, h, p);
            p.setShader(null);

            // sun + rays, low on the horizon
            float sx = w * 0.5f, sy = h * 0.72f, sr = Math.max(14f, h * 0.15f);
            p.setShader(new RadialGradient(sx, sy, h * 0.95f,
                alpha(0xFFFFE9A8, 140), alpha(0xFFFFE9A8, 0), Shader.TileMode.CLAMP));
            c.drawRect(0, 0, w, h, p);
            p.setShader(null);

            Paint ray = new Paint(Paint.ANTI_ALIAS_FLAG);
            ray.setColor(0xFFFFF0B8);
            double rl = h * 0.95;
            for (int i = 0; i < 11; i++) {
                double a1 = Math.toRadians(i * 360.0 / 11), a2 = a1 + 0.07;
                ray.setAlpha(i % 2 == 0 ? 60 : 36);
                Path path = new Path();
                path.moveTo(sx, sy);
                path.lineTo((float) (sx + Math.cos(a1) * rl), (float) (sy + Math.sin(a1) * rl));
                path.lineTo((float) (sx + Math.cos(a2) * rl), (float) (sy + Math.sin(a2) * rl));
                path.close();
                c.drawPath(path, ray);
            }

            p.setShader(new RadialGradient(sx, sy, sr * 1.5f, alpha(0xFFFFE9A8, 90), alpha(0xFFFFE9A8, 0), Shader.TileMode.CLAMP));
            c.drawCircle(sx, sy, sr * 1.5f, p);
            p.setShader(null);
            p.setShader(new RadialGradient(sx - sr * 0.3f, sy - sr * 0.3f, sr * 1.3f, 0xFFFFF6CF, 0xFFFFA03E, Shader.TileMode.CLAMP));
            c.drawCircle(sx, sy, sr, p);
            p.setShader(null);

            // a few soft clouds
            Rng r = new Rng(5);
            Paint cloud = new Paint(Paint.ANTI_ALIAS_FLAG);
            cloud.setColor(0xFFFFD9C4);
            float[][] clouds = {{0.14f, 0.28f, 0.3f}, {0.6f, 0.2f, 0.3f}, {0.4f, 0.42f, 0.22f}};
            for (float[] cl : clouds) {
                float cx = w * cl[0], cy = h * cl[1], cw = w * cl[2], ch = cw * 0.3f;
                cloud.setAlpha(80);
                RectF rc = new RectF(cx, cy, cx + cw, cy + ch);
                c.drawRoundRect(rc, ch / 2f, ch / 2f, cloud);
                c.drawCircle(cx + cw * 0.32f, cy + ch * 0.1f, ch * 0.9f, cloud);
                c.drawCircle(cx + cw * 0.58f, cy, ch * 1.2f, cloud);
            }

            // a couple of simple birds
            Paint bird = new Paint(Paint.ANTI_ALIAS_FLAG);
            bird.setStyle(Paint.Style.STROKE);
            bird.setStrokeWidth(Math.max(1.2f, h * 0.006f));
            bird.setStrokeCap(Paint.Cap.ROUND);
            bird.setColor(0xFF3B1740);
            bird.setAlpha(160);
            float[][] birds = {{0.12f, 0.36f}, {0.2f, 0.42f}};
            for (float[] b : birds) {
                float bx = w * b[0], by = h * b[1], bw = w * 0.05f;
                Path bp = new Path();
                bp.moveTo(bx, by);
                bp.quadTo(bx + bw * 0.25f, by - bw * 0.35f, bx + bw * 0.5f, by);
                bp.quadTo(bx + bw * 0.75f, by - bw * 0.35f, bx + bw, by);
                c.drawPath(bp, bird);
            }

            drawHills(c, w, h, 0xFF8D3A6B, 0xFF65284F);
            drawCottage(c, w * 0.12f, h * 0.845f, h * 0.1f, 0xFF3B1740, false);
        }

        // ---------------- shared pieces ----------------
        private void drawHills(Canvas c, int w, int h, int backColor, int frontColor) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setColor(backColor);
            Path back = new Path();
            back.moveTo(0, h * 0.78f);
            back.cubicTo(w * 0.2f, h * 0.68f, w * 0.38f, h * 0.84f, w * 0.58f, h * 0.74f);
            back.cubicTo(w * 0.78f, h * 0.64f, w * 0.9f, h * 0.7f, w, h * 0.76f);
            back.lineTo(w, h); back.lineTo(0, h); back.close();
            c.drawPath(back, p);

            p.setColor(frontColor);
            Path front = new Path();
            front.moveTo(0, h * 0.9f);
            front.cubicTo(w * 0.26f, h * 0.8f, w * 0.5f, h * 0.96f, w * 0.78f, h * 0.87f);
            front.cubicTo(w * 0.9f, h * 0.84f, w * 0.96f, h * 0.85f, w, h * 0.88f);
            front.lineTo(w, h); front.lineTo(0, h); front.close();
            c.drawPath(front, p);
        }

        private void drawCottage(Canvas c, float x, float y, float u, int bodyColor, boolean lit) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setColor(bodyColor);
            float cw = u * 1.5f, ch = u * 1.0f;
            // chimney
            c.drawRect(x + cw * 0.68f, y - ch - u * 0.7f, x + cw * 0.68f + u * 0.2f, y - ch + u * 0.55f, p);
            // body
            c.drawRect(x, y - ch, x + cw, y + 2, p);
            // roof
            Path roof = new Path();
            roof.moveTo(x - u * 0.12f, y - ch + 1);
            roof.lineTo(x + cw / 2f, y - ch - u * 0.72f);
            roof.lineTo(x + cw + u * 0.12f, y - ch + 1);
            roof.close();
            c.drawPath(roof, p);
            // window
            if (lit) {
                Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
                glow.setShader(new RadialGradient(x + cw * 0.5f, y - ch * 0.5f, u * 1.0f,
                    alpha(0xFFFFD27A, 150), alpha(0xFFFFD27A, 0), Shader.TileMode.CLAMP));
                c.drawCircle(x + cw * 0.5f, y - ch * 0.5f, u * 1.0f, glow);
            }
            Paint win = new Paint(Paint.ANTI_ALIAS_FLAG);
            win.setColor(lit ? 0xFFFFD27A : 0x33FFFFFF);
            float ww = cw * 0.34f, wh = ch * 0.4f;
            c.drawRect(x + cw * 0.33f, y - ch * 0.76f, x + cw * 0.33f + ww, y - ch * 0.76f + wh, win);
        }
    }

    // ------------------------------------------------------------------
    // Spec kept for backward compatibility with any caller using it; the
    // Activity-driven callers (NightToRiseBlockActivity, NightToRiseLockScreen)
    // set title/message/countdown themselves, same as before.
    // ------------------------------------------------------------------

    /** Builds the card. {@code isRise} picks the palette/scene/copy; everything else is generic. */
    public static Handles build(Context ctx, boolean isRise) {
        int a1 = isRise ? 0xFFFB923C : 0xFF6D6BF5;
        int a2 = isRise ? 0xFFF43F5E : 0xFFB39BFF;
        int tint = blend(a1, Color.WHITE, 0.7f);
        int cardBottom = isRise ? 0xFF170B22 : 0xFF121629;
        int colorText = 0xFFF6F7FF;
        int colorText2 = 0xFFA9B0D6;

        DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
        float d = dm.density;
        float em = Math.max(14f * d, Math.min(20f * d, 0.05f * Math.min(dm.widthPixels, dm.heightPixels)));

        FrameLayout root = new FrameLayout(ctx);
        root.setBackgroundColor(Color.TRANSPARENT); // [N2R-CARD] no painted backdrop — card only.
        root.setClickable(true);
        root.setFocusable(true);

        ScrollView scroll = new ScrollView(ctx);
        scroll.setFillViewport(true);
        scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        scroll.setVerticalScrollBarEnabled(false);
        root.addView(scroll, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout page = new LinearLayout(ctx);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER);
        page.setPadding(0, Math.round(em), 0, Math.round(em));
        scroll.addView(page, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        int cardW = Math.round(Math.min(em * 23f, dm.widthPixels - em * 2.2f));

        // ---- outer card: clipped rounded corners so the scene's square bitmap
        // corners don't poke out at the top ----
        LinearLayout content = new LinearLayout(ctx);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setClipToOutline(true);
        content.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(cardBottom);
        cardBg.setCornerRadius(em * 1.9f);
        content.setBackground(cardBg);
        page.addView(content, new LinearLayout.LayoutParams(cardW, LinearLayout.LayoutParams.WRAP_CONTENT));

        // ---- scene header ----
        FrameLayout sceneHolder = new FrameLayout(ctx);
        SceneView scene = new SceneView(ctx, isRise);
        sceneHolder.addView(scene, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, Math.round(em * 8.4f)));

        TextView pill = new TextView(ctx);
        pill.setText(isRise ? "RISE GUARD" : "SLEEP GUARD");
        pill.setTextColor(Color.WHITE);
        pill.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 0.68f);
        pill.setTypeface(Typeface.DEFAULT_BOLD);
        pill.setLetterSpacing(0.06f);
        pill.setPadding(Math.round(em * 0.75f), Math.round(em * 0.38f), Math.round(em * 0.75f), Math.round(em * 0.38f));
        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setColor(alpha(Color.BLACK, 70));
        pillBg.setCornerRadius(em * 2f);
        pillBg.setStroke(Math.max(1, Math.round(d)), alpha(Color.WHITE, 40));
        pill.setBackground(pillBg);
        FrameLayout.LayoutParams pillLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        pillLp.gravity = Gravity.TOP | Gravity.START;
        pillLp.leftMargin = Math.round(em * 0.8f);
        pillLp.topMargin = Math.round(em * 0.8f);
        sceneHolder.addView(pill, pillLp);

        content.addView(sceneHolder, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // ---- body ----
        LinearLayout body = new LinearLayout(ctx);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setGravity(Gravity.CENTER_HORIZONTAL);
        body.setPadding(Math.round(em * 1.4f), Math.round(em * 1.1f), Math.round(em * 1.4f), Math.round(em * 1.3f));
        content.addView(body, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(ctx);
        title.setTextColor(colorText);
        title.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 1.45f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        title.setIncludeFontPadding(false);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleLp.bottomMargin = Math.round(em * 0.3f);
        body.addView(title, titleLp);

        TextView message = new TextView(ctx);
        message.setTextColor(colorText2);
        message.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 0.88f);
        message.setGravity(Gravity.CENTER);
        message.setLineSpacing(0, 1.3f);
        message.setClickable(true); // kept clickable for any caller that wants tap-to-register-something
        LinearLayout.LayoutParams msgLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        msgLp.bottomMargin = Math.round(em * 1.1f);
        body.addView(message, msgLp);

        // ---- stat row: countdown + end-time, side by side ----
        LinearLayout statRow = new LinearLayout(ctx);
        statRow.setOrientation(LinearLayout.HORIZONTAL);
        GradientDrawable statBg = new GradientDrawable();
        statBg.setColor(alpha(Color.WHITE, 14));
        statBg.setCornerRadius(em * 1.1f);
        statBg.setStroke(Math.max(1, Math.round(d)), alpha(Color.WHITE, 20));
        statRow.setBackground(statBg);

        TextView countdown = new TextView(ctx);
        LinearLayout countdownBox = statCell(ctx, em, countdown, isRise ? "UNTIL UNLOCK" : "UNTIL WAKE-UP", colorText, colorText2);
        statRow.addView(countdownBox, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        View divider = new View(ctx);
        divider.setBackgroundColor(alpha(Color.WHITE, 16));
        statRow.addView(divider, new LinearLayout.LayoutParams(Math.max(1, Math.round(d)), ViewGroup.LayoutParams.MATCH_PARENT));

        TextView endTime = new TextView(ctx);
        LinearLayout endBox = statCell(ctx, em, endTime, isRise ? "APPS UNLOCK" : "ALARM", colorText, colorText2);
        statRow.addView(endBox, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        LinearLayout.LayoutParams statLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        statLp.bottomMargin = Math.round(em * 1.2f);
        body.addView(statRow, statLp);

        // allowed-apps chips container (rows added by the Activity, unchanged logic)
        LinearLayout allowedContainer = new LinearLayout(ctx);
        allowedContainer.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams allowedLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        allowedLp.bottomMargin = Math.round(em * 1.1f);
        body.addView(allowedContainer, allowedLp);

        // primary CTA — goes Home (does not lift the block)
        Button home = new Button(ctx);
        home.setText(isRise ? "Start my day" : "Good night");
        home.setAllCaps(false);
        home.setTypeface(Typeface.DEFAULT_BOLD);
        home.setTextColor(Color.WHITE);
        home.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 1f);
        GradientDrawable homeBg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{a1, a2});
        homeBg.setCornerRadius(em * 2.4f);
        home.setBackground(homeBg);
        home.setPadding(0, 0, 0, 0);
        LinearLayout.LayoutParams homeLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, Math.round(em * 3.1f));
        homeLp.bottomMargin = Math.round(em * 0.7f);
        body.addView(home, homeLp);

        // secondary — the real safety valve (emergency unlock / strict wait), kept clearly
        // visible when the caller chooses to show it (hidden by default via visibility).
        Button override = new Button(ctx);
        override.setAllCaps(false);
        override.setTypeface(Typeface.DEFAULT_BOLD);
        override.setTextColor(tint);
        override.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 0.85f);
        GradientDrawable overrideBg = new GradientDrawable();
        overrideBg.setColor(Color.TRANSPARENT);
        overrideBg.setCornerRadius(em * 2.4f);
        overrideBg.setStroke(Math.max(1, Math.round(d)), alpha(tint, 90));
        override.setBackground(overrideBg);
        override.setPadding(0, 0, 0, 0);
        body.addView(override, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, Math.round(em * 2.7f)));

        content.setAlpha(0f);
        content.setTranslationY(em * 0.6f);
        content.animate().alpha(1f).translationY(0f).setDuration(260)
            .setInterpolator(new DecelerateInterpolator()).start();

        return new Handles(root, content, pill, title, message, countdown, countdownBox, endTime, allowedContainer, home, override);
    }

    private static LinearLayout statCell(Context ctx, float em, TextView big, String label, int colorText, int colorText2) {
        LinearLayout box = new LinearLayout(ctx);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(Math.round(em * 0.6f), Math.round(em * 0.75f), Math.round(em * 0.6f), Math.round(em * 0.75f));
        big.setTextColor(colorText);
        big.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 1.25f);
        big.setTypeface(Typeface.DEFAULT_BOLD);
        big.setIncludeFontPadding(false);
        big.setGravity(Gravity.CENTER);
        box.addView(big, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        TextView lbl = new TextView(ctx);
        lbl.setText(label);
        lbl.setTextColor(colorText2);
        lbl.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 0.58f);
        lbl.setLetterSpacing(0.07f);
        lbl.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lblLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lblLp.topMargin = Math.round(em * 0.2f);
        box.addView(lbl, lblLp);
        return box;
    }

    /** Formats an absolute end time as a 12-hour clock string, e.g. "6:30 AM". */
    public static String formatClock(long epochMs) {
        try {
            return new SimpleDateFormat("h:mm a", Locale.US).format(new Date(epochMs));
        } catch (Throwable t) {
            return "";
        }
    }
}
