package com.mylifeos.app.shield.core;

import android.animation.ValueAnimator;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.mylifeos.app.shield.ShieldPreferences;

import java.util.Calendar;

/**
 * [SHIELD-CARD] The single Shield block card.
 *
 * One builder, three hosts: the accessibility overlay (BlockingOverlay), the
 * system overlay tier, and ShieldBlockActivity (last-resort fallback). Every
 * Shield block (app / daily limit / keyword / site / adult content) renders
 * from a {@link Spec} so the design can never drift between hosts.
 *
 * Pure Canvas + framework widgets: no assets, no network, no new dependency.
 * minSdk 24 safe (no blur, no RenderEffect).
 */
public final class ShieldBlockCard {

    private static final String TAG = "ShieldBlockCard";

    public enum Kind { APP, LIMIT, KEYWORD, SITE, CONTENT }

    public interface Callbacks {
        void onHome();
        void onGhost();
    }

    // icon ids
    static final int ICON_SHIELD = 0;
    static final int ICON_CLOCK = 1;
    static final int ICON_GLOBE = 2;
    static final int ICON_LOCK = 3;
    static final int ICON_SEARCH = 4;
    static final int ICON_ARROW = 5;

    private static final int COLOR_BASE = 0xFF0D1224;
    private static final int COLOR_TEXT = 0xFFF5F7FF;
    private static final int COLOR_TEXT2 = 0xFFA3AED0;
    private static final int COLOR_RIM = 0xFF1A2038;

    private ShieldBlockCard() {}

    // ------------------------------------------------------------------
    // Spec
    // ------------------------------------------------------------------

    public static final class Spec {
        public Kind kind = Kind.APP;
        public String pkg;
        public String appName = "This app";
        public String title = "Stay focused";
        public String sub = "";
        public String chipText = "Blocked by Shield";
        public int chipIcon = ICON_SHIELD;
        public float ringProgress = 1f;
        public String ringBig = "";
        public String ringLabel = "";
        public String emoji;
        public int a1 = 0xFF6366F1;
        public int a2 = 0xFFA855F7;
        public int glow1 = 0xFFEC4899;
        public int glow2 = 0xFF3B82F6;
        public boolean countdown = true;
        public String ghostLabel;
        public Drawable appIcon;
        public Bitmap backdropImage;

        /** Builds the spec from the same Intent extras the block activity has always used. */
        public static Spec fromIntent(Context ctx, Intent it, boolean allowGhost) {
            Spec s = new Spec();
            Context app = ctx.getApplicationContext() != null ? ctx.getApplicationContext() : ctx;
            ShieldPreferences sp = new ShieldPreferences(app);

            String pkg = it.getStringExtra("BLOCKED_PACKAGE");
            boolean adult = it.getBooleanExtra("IS_ADULT_BLOCK", false);
            boolean limit = it.getBooleanExtra("IS_LIMIT_BLOCK", false);
            int limitMin = it.getIntExtra("LIMIT_MINUTES", 0);
            long escMs = it.getLongExtra("ESCALATION_REMAINING_MS", 0L);
            String kindExtra = it.getStringExtra("BLOCK_KIND");

            s.pkg = pkg;
            s.appName = resolveAppName(app, pkg);
            s.countdown = safeCountdown(sp);
            s.ghostLabel = (allowGhost && !safeStrict(sp)) ? "I opened this by mistake" : null;

            SharedPreferences cap = app.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String themeId = safeString(sp.getBlockScreenTheme(), null);
            if (themeId == null || themeId.isEmpty()) themeId = cap.getString("shield_block_screen_theme", "default");
            applyTheme(s, themeId);

            String customText = safeString(sp.getBlockScreenText(), "");
            if (customText.isEmpty()) customText = cap.getString("shield_block_screen_text", "");
            if (customText == null) customText = "";
            customText = customText.trim();
            if (customText.startsWith("Stay Focused on your GOALS")) customText = "";

            if ("custom".equals(themeId)) {
                String img = cap.getString("shield_block_screen_image", null);
                if (img != null && !img.isEmpty()) {
                    DisplayMetrics dm = app.getResources().getDisplayMetrics();
                    s.backdropImage = decodeBase64(img, Math.max(dm.widthPixels, dm.heightPixels));
                }
            }

            if (limit) {
                s.kind = Kind.LIMIT;
                s.title = "Daily limit reached";
                s.sub = "You've used your " + fmtShort(limitMin) + " on\n" + s.appName + " today.";
                s.ringProgress = 1f;
                s.ringBig = fmtBig(limitMin);
                s.ringLabel = "used today";
                s.chipIcon = ICON_CLOCK;
                s.chipText = resetIn(safeStartHour(sp));
            } else if (adult && "keyword".equals(kindExtra)) {
                s.kind = Kind.KEYWORD;
                s.title = "Blocked keyword";
                s.sub = "This search has a word\nyou chose to avoid.";
                s.chipIcon = ICON_SHIELD;
                s.chipText = "Keyword filter";
            } else if (adult && "site".equals(kindExtra)) {
                s.kind = Kind.SITE;
                s.title = "Site blocked";
                s.sub = "This site is on your\nblock list.";
                s.chipIcon = ICON_GLOBE;
                s.chipText = "Site filter";
            } else if (adult) {
                s.kind = Kind.CONTENT;
                String style = safeString(sp.getAdultBlockScreenStyle(), "focus");
                String custom = safeString(sp.getAdultBlockCustomMessage(), "");
                applyAdultStyle(s, style);
                if ("custom".equals(style) && !custom.isEmpty()) s.sub = custom;
                s.chipIcon = ICON_SHIELD;
                s.chipText = "Content filter";
                if (escMs > 0) {
                    int mins = (int) Math.max(1, (escMs + 59_999L) / 60_000L);
                    s.chipIcon = ICON_CLOCK;
                    s.chipText = "Paused · " + fmtShort(mins) + " left";
                }
            } else {
                s.kind = Kind.APP;
                s.title = "Stay focused";
                s.sub = !customText.isEmpty() ? customText
                    : s.appName + " is blocked right now.\nYou're doing great.";
                s.chipIcon = ICON_SHIELD;
                s.chipText = "Blocked by Shield";
            }

            if (s.kind == Kind.APP || s.kind == Kind.LIMIT) {
                s.appIcon = resolveAppIcon(app, pkg);
            }
            return s;
        }

        /** Generic spec for callers that only have a title + message (safety net). */
        public static Spec generic(String title, String message) {
            Spec s = new Spec();
            s.kind = Kind.CONTENT;
            s.title = title == null || title.isEmpty() ? "Stay focused" : title;
            s.sub = message == null ? "" : message;
            s.chipText = "Blocked by Shield";
            return s;
        }
    }

    private static boolean safeCountdown(ShieldPreferences sp) {
        try { return sp.isBlockCountdownEnabled(); } catch (Throwable t) { return true; }
    }

    private static boolean safeStrict(ShieldPreferences sp) {
        try { return sp.isStrictMode(); } catch (Throwable t) { return false; }
    }

    private static int safeStartHour(ShieldPreferences sp) {
        try { return Math.max(0, Math.min(23, sp.getStartOfDayHour())); } catch (Throwable t) { return 0; }
    }

    private static String safeString(String v, String fallback) {
        return v == null ? fallback : v;
    }

    private static void applyTheme(Spec s, String id) {
        if (id == null) id = "default";
        switch (id) {
            case "ocean":
                set(s, 0xFF0EA5E9, 0xFF14B8A6, 0xFF06B6D4, 0xFF3B82F6); break;
            case "sunset":
                set(s, 0xFFF43F5E, 0xFFFB923C, 0xFFF97316, 0xFFEC4899); break;
            case "forest":
            case "nature":
                set(s, 0xFF10B981, 0xFF0F766E, 0xFF10B981, 0xFF14B8A6); break;
            case "midnight":
                set(s, 0xFF4F46E5, 0xFF1E3A8A, 0xFF4338CA, 0xFF1D4ED8); break;
            case "mono":
            case "minimal":
                set(s, 0xFFA1A1AA, 0xFF52525B, 0xFF71717A, 0xFF52525B); break;
            case "rose":
                set(s, 0xFFF472B6, 0xFFE11D48, 0xFFEC4899, 0xFFF43F5E); break;
            default:
                set(s, 0xFF6366F1, 0xFFA855F7, 0xFFEC4899, 0xFF3B82F6); break;
        }
    }

    private static void set(Spec s, int a1, int a2, int g1, int g2) {
        s.a1 = a1; s.a2 = a2; s.glow1 = g1; s.glow2 = g2;
    }

    private static void applyAdultStyle(Spec s, String style) {
        if (style == null) style = "focus";
        switch (style) {
            case "reminder":
                s.emoji = "\uD83D\uDC94"; s.title = "Not Today";
                s.sub = "Remember your goals.\nYou can do this.";
                set(s, 0xFFF43F5E, 0xFFFB923C, 0xFFF43F5E, 0xFFFB923C); break;
            case "strict":
                s.emoji = "\uD83D\uDEAB"; s.title = "Access Denied";
                s.sub = "This content is blocked.\nFocus Shield is protecting you.";
                set(s, 0xFFEF4444, 0xFFB91C1C, 0xFFDC2626, 0xFF7F1D1D); break;
            case "motivate":
                s.emoji = "\uD83D\uDCAA"; s.title = "You Got This!";
                s.sub = "Every time you resist,\nyou grow stronger.";
                set(s, 0xFF8B5CF6, 0xFF6366F1, 0xFF8B5CF6, 0xFF6366F1); break;
            case "streak":
                s.emoji = "\uD83D\uDD25"; s.title = "Don't Break It!";
                s.sub = "Stay strong.\nDon't ruin your progress.";
                set(s, 0xFFF97316, 0xFFEF4444, 0xFFF97316, 0xFFEF4444); break;
            case "islamic":
                s.emoji = "\u262A\uFE0F"; s.title = "\u0627\u062A\u0642 \u0627\u0644\u0644\u0647";
                s.sub = "Fear Allah.\nGuard your eyes and heart.\n\n\u063A\u064F\u0636\u0651\u064E \u0628\u064E\u0635\u064E\u0631\u064E\u0643\u064E";
                set(s, 0xFF10B981, 0xFF0D9488, 0xFF10B981, 0xFF0D9488); break;
            default:
                s.emoji = null; s.title = "Stay Focused";
                s.sub = "This content is blocked.\nYou are better than this.";
                break;
        }
    }

    // ------------------------------------------------------------------
    // Data helpers
    // ------------------------------------------------------------------

    static String resolveAppName(Context ctx, String pkg) {
        if (pkg == null || pkg.isEmpty()) return "This app";
        try {
            PackageManager pm = ctx.getPackageManager();
            CharSequence label = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0));
            if (label != null && label.length() > 0) return label.toString();
        } catch (Throwable ignored) {}
        String[] parts = pkg.split("\\.");
        String name = parts[parts.length - 1];
        if (name.isEmpty()) return "This app";
        return name.substring(0, 1).toUpperCase() + name.substring(1);
    }

    static Drawable resolveAppIcon(Context ctx, String pkg) {
        if (pkg == null || pkg.isEmpty()) return null;
        try { return ctx.getPackageManager().getApplicationIcon(pkg); }
        catch (Throwable t) { return null; }
    }

    static String fmtShort(int m) {
        if (m <= 0) return "0m";
        int h = m / 60, r = m % 60;
        if (h == 0) return m + "m";
        return r == 0 ? h + "h" : h + "h " + r + "m";
    }

    static String fmtBig(int m) {
        if (m < 0) m = 0;
        int h = m / 60, r = m % 60;
        if (h == 0) return m + "m";
        return h + "h " + (r < 10 ? "0" : "") + r + "m";
    }

    static String resetIn(int startHour) {
        Calendar now = Calendar.getInstance();
        Calendar next = (Calendar) now.clone();
        next.set(Calendar.HOUR_OF_DAY, startHour);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (!next.after(now)) next.add(Calendar.DAY_OF_YEAR, 1);
        long mins = (next.getTimeInMillis() - now.getTimeInMillis()) / 60_000L;
        long h = mins / 60, r = mins % 60;
        return "Resets in " + (h > 0 ? h + "h " + r + "m" : Math.max(1, r) + "m");
    }

    static Bitmap decodeBase64(String data, int maxDim) {
        try {
            int comma = data.indexOf(',');
            if (comma >= 0) data = data.substring(comma + 1);
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
            int sample = 1;
            while (o.outWidth / sample > maxDim * 2 || o.outHeight / sample > maxDim * 2) sample *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o2);
        } catch (Throwable t) {
            return null;
        }
    }

    static boolean animationsOn(Context ctx) {
        try {
            return Settings.Global.getFloat(ctx.getContentResolver(),
                Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f;
        } catch (Throwable t) {
            return true;
        }
    }

    static int blend(int c, int with, float amount) {
        int a = Math.round(Color.alpha(c) * (1 - amount) + Color.alpha(with) * amount);
        int r = Math.round(Color.red(c) * (1 - amount) + Color.red(with) * amount);
        int g = Math.round(Color.green(c) * (1 - amount) + Color.green(with) * amount);
        int b = Math.round(Color.blue(c) * (1 - amount) + Color.blue(with) * amount);
        return Color.argb(a, r, g, b);
    }

    static int alpha(int c, int a) {
        return Color.argb(a, Color.red(c), Color.green(c), Color.blue(c));
    }

    // ------------------------------------------------------------------
    // Icons (24x24 space, stroke based)
    // ------------------------------------------------------------------

    static Path iconPath(int id) {
        Path p = new Path();
        switch (id) {
            case ICON_SHIELD:
                p.moveTo(12f, 3f);
                p.lineTo(19.5f, 6f);
                p.lineTo(19.5f, 11.5f);
                p.cubicTo(19.5f, 16.1f, 16.4f, 19.9f, 12f, 21f);
                p.cubicTo(7.6f, 19.9f, 4.5f, 16.1f, 4.5f, 11.5f);
                p.lineTo(4.5f, 6f);
                p.close();
                break;
            case ICON_CLOCK:
                p.addCircle(12f, 12f, 8.5f, Path.Direction.CW);
                p.moveTo(12f, 7.5f);
                p.lineTo(12f, 12f);
                p.lineTo(15f, 14f);
                break;
            case ICON_GLOBE:
                p.addCircle(12f, 12f, 8.5f, Path.Direction.CW);
                p.moveTo(3.5f, 12f);
                p.lineTo(20.5f, 12f);
                p.addOval(new RectF(8.4f, 3.5f, 15.6f, 20.5f), Path.Direction.CW);
                break;
            case ICON_LOCK:
                p.addRoundRect(new RectF(5.5f, 11f, 18.5f, 20f), 2.5f, 2.5f, Path.Direction.CW);
                p.moveTo(8.5f, 11f);
                p.lineTo(8.5f, 8f);
                p.arcTo(new RectF(8.5f, 4.5f, 15.5f, 11.5f), 180f, 180f);
                p.lineTo(15.5f, 11f);
                break;
            case ICON_SEARCH:
                p.addCircle(11f, 11f, 6.5f, Path.Direction.CW);
                p.moveTo(16f, 16f);
                p.lineTo(20.5f, 20.5f);
                p.moveTo(4f, 4f);
                p.lineTo(20f, 20f);
                break;
            case ICON_ARROW:
            default:
                p.moveTo(5f, 12f);
                p.lineTo(19f, 12f);
                p.moveTo(13f, 6f);
                p.lineTo(19f, 12f);
                p.lineTo(13f, 18f);
                break;
        }
        return p;
    }

    private static Paint strokePaint(int color, float width) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeJoin(Paint.Join.ROUND);
        p.setStrokeWidth(width);
        p.setColor(color);
        return p;
    }

    /** Draws icon id centred at (cx, cy) with the given pixel size. */
    private static void drawIcon(Canvas c, int id, float cx, float cy, float size,
                                 int color, float strokeUnits) {
        Path p = iconPath(id);
        Paint paint = strokePaint(color, strokeUnits);
        c.save();
        c.translate(cx - size / 2f, cy - size / 2f);
        float sc = size / 24f;
        c.scale(sc, sc);
        c.drawPath(p, paint);
        c.restore();
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    private static final class IconView extends View {
        private final int id;
        private final int color;
        private final float units;

        IconView(Context ctx, int id, int color, float units) {
            super(ctx);
            this.id = id; this.color = color; this.units = units;
        }

        @Override protected void onDraw(Canvas c) {
            float s = Math.min(getWidth(), getHeight());
            drawIcon(c, id, getWidth() / 2f, getHeight() / 2f, s, color, units);
        }
    }

    private static final class BackdropView extends View {
        private final Spec spec;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private Shader g1, g2;

        BackdropView(Context ctx, Spec spec) {
            super(ctx);
            this.spec = spec;
        }

        @Override protected void onSizeChanged(int w, int h, int ow, int oh) {
            super.onSizeChanged(w, h, ow, oh);
            g1 = new RadialGradient(w * 0.88f, h * 0.06f, Math.max(w, 1) * 0.85f,
                alpha(spec.glow1, 120), alpha(spec.glow1, 0), Shader.TileMode.CLAMP);
            g2 = new RadialGradient(w * 0.08f, h * 0.96f, Math.max(w, 1) * 1.0f,
                alpha(spec.glow2, 110), alpha(spec.glow2, 0), Shader.TileMode.CLAMP);
        }

        @Override protected void onDraw(Canvas c) {
            int w = getWidth(), h = getHeight();
            c.drawColor(COLOR_BASE);
            Bitmap bmp = spec.backdropImage;
            if (bmp != null && !bmp.isRecycled() && bmp.getWidth() > 0 && bmp.getHeight() > 0) {
                float sc = Math.max(w / (float) bmp.getWidth(), h / (float) bmp.getHeight());
                Matrix m = new Matrix();
                m.postScale(sc, sc);
                m.postTranslate((w - bmp.getWidth() * sc) / 2f, (h - bmp.getHeight() * sc) / 2f);
                c.drawBitmap(bmp, m, null);
                paint.setShader(null);
                paint.setColor(Color.argb(160, 6, 8, 18));
                c.drawRect(0, 0, w, h, paint);
                return;
            }
            if (g1 != null) { paint.setShader(g1); c.drawRect(0, 0, w, h, paint); }
            if (g2 != null) { paint.setShader(g2); c.drawRect(0, 0, w, h, paint); }
            paint.setShader(null);
            paint.setColor(Color.argb(70, 6, 8, 18));
            c.drawRect(0, 0, w, h, paint);
        }
    }

    private static final class AccentLine extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final int color;

        AccentLine(Context ctx, int color) { super(ctx); this.color = color; }

        @Override protected void onSizeChanged(int w, int h, int ow, int oh) {
            super.onSizeChanged(w, h, ow, oh);
            paint.setShader(new LinearGradient(0, 0, w, 0,
                new int[]{alpha(color, 0), color, alpha(color, 0)}, null, Shader.TileMode.CLAMP));
        }

        @Override protected void onDraw(Canvas c) {
            c.drawRoundRect(new RectF(0, 0, getWidth(), getHeight()), getHeight() / 2f, getHeight() / 2f, paint);
        }
    }

    private static final class BadgeView extends View {
        private final Spec spec;
        private final float em;
        private final boolean animate;
        private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path shield = iconPath(ICON_SHIELD);
        private final Path check = new Path();
        private ValueAnimator anim;
        private float t = 0.35f;

        BadgeView(Context ctx, Spec spec, float em) {
            super(ctx);
            this.spec = spec;
            this.em = em;
            this.animate = animationsOn(ctx);
            ring.setStyle(Paint.Style.STROKE);
            ring.setStrokeWidth(Math.max(2f, em * 0.09f));
            text.setTextAlign(Paint.Align.CENTER);
            check.moveTo(8.5f, 12.2f);
            check.lineTo(11f, 14.7f);
            check.lineTo(15.6f, 9.7f);
        }

        @Override protected void onAttachedToWindow() {
            super.onAttachedToWindow();
            if (!animate) return;
            try {
                anim = ValueAnimator.ofFloat(0f, 1f);
                anim.setDuration(2800);
                anim.setInterpolator(new LinearInterpolator());
                anim.setRepeatCount(ValueAnimator.INFINITE);
                anim.addUpdateListener(a -> { t = (float) a.getAnimatedValue(); invalidate(); });
                anim.start();
            } catch (Throwable ignored) {}
        }

        @Override protected void onDetachedFromWindow() {
            if (anim != null) { anim.cancel(); anim = null; }
            super.onDetachedFromWindow();
        }

        @Override protected void onDraw(Canvas c) {
            float cx = getWidth() / 2f, cy = getHeight() / 2f;
            float r = em * 2.7f;

            // pulse ring
            float pr = r * (0.8f + 0.45f * t) + em * 0.9f * t;
            ring.setColor(alpha(spec.a2, Math.round(140 * (1f - t))));
            c.drawCircle(cx, cy, pr, ring);

            // soft glow
            fill.setShader(null);
            for (int i = 3; i >= 1; i--) {
                fill.setColor(alpha(spec.a2, 14 * (4 - i)));
                c.drawCircle(cx, cy + em * 0.25f, r + em * 0.32f * i, fill);
            }
            // rim + gradient body
            fill.setColor(COLOR_RIM);
            c.drawCircle(cx, cy, r, fill);
            fill.setShader(new LinearGradient(cx - r, cy - r, cx + r, cy + r,
                spec.a1, spec.a2, Shader.TileMode.CLAMP));
            c.drawCircle(cx, cy, r - em * 0.28f, fill);
            fill.setShader(null);

            if (spec.emoji != null) {
                text.setTextSize(em * 2.3f);
                Paint.FontMetrics fm = text.getFontMetrics();
                c.drawText(spec.emoji, cx, cy - (fm.ascent + fm.descent) / 2f, text);
                return;
            }
            float size = em * 2.5f;
            float sc = size / 24f;
            c.save();
            c.translate(cx - size / 2f, cy - size / 2f);
            c.scale(sc, sc);
            Paint f = new Paint(Paint.ANTI_ALIAS_FLAG);
            f.setStyle(Paint.Style.FILL);
            f.setColor(Color.argb(46, 255, 255, 255));
            c.drawPath(shield, f);
            c.drawPath(shield, strokePaint(Color.WHITE, 1.8f));
            c.drawPath(check, strokePaint(Color.WHITE, 1.8f));
            c.restore();
        }
    }

    private static final class RingView extends View {
        private final Spec spec;
        private final Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint arc = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF box = new RectF();
        private float progress;
        private ValueAnimator anim;

        RingView(Context ctx, Spec spec) {
            super(ctx);
            this.spec = spec;
            this.progress = animationsOn(ctx) ? 0f : spec.ringProgress;
            track.setStyle(Paint.Style.STROKE);
            track.setColor(Color.argb(23, 255, 255, 255));
            arc.setStyle(Paint.Style.STROKE);
            arc.setStrokeCap(Paint.Cap.ROUND);
        }

        @Override protected void onAttachedToWindow() {
            super.onAttachedToWindow();
            if (!animationsOn(getContext())) { progress = spec.ringProgress; return; }
            try {
                anim = ValueAnimator.ofFloat(0f, spec.ringProgress);
                anim.setDuration(1300);
                anim.setInterpolator(new DecelerateInterpolator(2f));
                anim.addUpdateListener(a -> { progress = (float) a.getAnimatedValue(); invalidate(); });
                anim.start();
            } catch (Throwable t) { progress = spec.ringProgress; }
        }

        @Override protected void onDetachedFromWindow() {
            if (anim != null) { anim.cancel(); anim = null; }
            super.onDetachedFromWindow();
        }

        @Override protected void onDraw(Canvas c) {
            float s = Math.min(getWidth(), getHeight());
            float stroke = s * 8f / 120f;
            float r = s * 52f / 120f;
            float cx = getWidth() / 2f, cy = getHeight() / 2f;
            box.set(cx - r, cy - r, cx + r, cy + r);

            track.setStrokeWidth(stroke);
            c.drawOval(box, track);

            float sweep = 360f * Math.max(0f, Math.min(1f, progress));
            if (sweep <= 0.5f) return;
            arc.setShader(null);
            int[] glowAlpha = {26, 16, 8};
            for (int i = 0; i < glowAlpha.length; i++) {
                arc.setColor(alpha(spec.a2, glowAlpha[i]));
                arc.setStrokeWidth(stroke + stroke * 0.8f * (glowAlpha.length - i));
                c.drawArc(box, -90f, sweep, false, arc);
            }
            arc.setStrokeWidth(stroke);
            arc.setShader(new LinearGradient(cx - r, cy - r, cx + r, cy + r,
                spec.a1, spec.a2, Shader.TileMode.CLAMP));
            c.drawArc(box, -90f, sweep, false, arc);
        }
    }

    private static final class TileView extends View {
        private final Spec spec;
        private final float em;
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

        TileView(Context ctx, Spec spec, float em) {
            super(ctx);
            this.spec = spec;
            this.em = em;
        }

        @Override protected void onDraw(Canvas c) {
            boolean app = spec.kind == Kind.APP || spec.kind == Kind.LIMIT;
            float cx = getWidth() / 2f, cy = getHeight() / 2f;
            float half = em * 3.2f;
            RectF tile = new RectF(cx - half, cy - half, cx + half, cy + half);
            float radius = app ? em * 1.75f : half;

            p.setStyle(Paint.Style.FILL);
            p.setShader(null);
            float[] spread = {em * 1.2f, em * 0.6f};
            int[] a = {6, 10};
            for (int i = 0; i < 2; i++) {
                p.setColor(Color.argb(a[i], 255, 255, 255));
                RectF h = new RectF(tile);
                h.inset(-spread[i], -spread[i]);
                c.drawRoundRect(h, radius + spread[i], radius + spread[i], p);
            }

            if (app) {
                Drawable icon = spec.appIcon;
                if (icon != null) {
                    c.save();
                    Path clip = new Path();
                    clip.addRoundRect(tile, radius, radius, Path.Direction.CW);
                    c.clipPath(clip);
                    icon.setBounds(Math.round(tile.left), Math.round(tile.top),
                        Math.round(tile.right), Math.round(tile.bottom));
                    icon.draw(c);
                    c.restore();
                } else {
                    p.setShader(new LinearGradient(tile.left, tile.top, tile.right, tile.bottom,
                        new int[]{0xFFF59E4B, 0xFFE0567F, 0xFF7C5CD6}, null, Shader.TileMode.CLAMP));
                    c.drawRoundRect(tile, radius, radius, p);
                    p.setShader(null);
                    String letter = spec.appName != null && !spec.appName.isEmpty()
                        ? spec.appName.substring(0, 1).toUpperCase() : "?";
                    Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG);
                    tp.setColor(Color.WHITE);
                    tp.setTypeface(Typeface.DEFAULT_BOLD);
                    tp.setTextAlign(Paint.Align.CENTER);
                    tp.setTextSize(em * 3f);
                    Paint.FontMetrics fm = tp.getFontMetrics();
                    c.drawText(letter, cx, cy - (fm.ascent + fm.descent) / 2f, tp);
                }
                // lock badge, bottom-right
                float lr = em * 1.15f;
                float lx = tile.right - em * 0.55f, ly = tile.bottom - em * 0.55f;
                p.setColor(COLOR_RIM);
                c.drawCircle(lx, ly, lr, p);
                p.setShader(new LinearGradient(lx - lr, ly - lr, lx + lr, ly + lr,
                    spec.a1, spec.a2, Shader.TileMode.CLAMP));
                c.drawCircle(lx, ly, lr - em * 0.2f, p);
                p.setShader(null);
                drawIcon(c, ICON_LOCK, lx, ly, em * 1.2f, Color.WHITE, 2.2f);
            } else {
                p.setColor(Color.argb(18, 255, 255, 255));
                c.drawCircle(cx, cy, half, p);
                Paint edge = strokePaint(Color.argb(36, 255, 255, 255), Math.max(1f, em * 0.06f));
                c.drawCircle(cx, cy, half, edge);
                int glyph = spec.kind == Kind.SITE ? ICON_GLOBE : ICON_SEARCH;
                drawIcon(c, glyph, cx, cy, em * 3.2f, blend(spec.a1, Color.WHITE, 0.7f), 1.7f);
            }
        }
    }

    // ------------------------------------------------------------------
    // Root + layout
    // ------------------------------------------------------------------

    /** Builds the full-screen card view. Throws on unexpected failure: callers must fall back. */
    public static View build(Context ctx, Spec spec, Callbacks cb) {
        return new Root(ctx, spec, cb);
    }

    private static final class Root extends FrameLayout {
        private final Spec spec;
        private final Callbacks cb;
        private final Handler handler = new Handler(Looper.getMainLooper());
        private TextView ctaLabel;
        private int remaining = 3;
        private boolean fired = false;
        private boolean attached = false;

        private final Runnable tick = new Runnable() {
            @Override public void run() {
                if (fired || !attached) return;
                remaining--;
                if (remaining <= 0) {
                    fired = true;
                    try { cb.onHome(); } catch (Throwable t) { Log.w(TAG, "auto-close failed", t); }
                    return;
                }
                updateCta();
                handler.postDelayed(this, 1000);
            }
        };

        Root(Context ctx, Spec spec, Callbacks cb) {
            super(ctx);
            this.spec = spec;
            this.cb = cb;
            setClickable(true);
            setFocusable(true);
            rebuild();
        }

        @Override protected void onAttachedToWindow() {
            super.onAttachedToWindow();
            attached = true;
            if (spec.countdown && !fired) {
                updateCta();
                handler.removeCallbacks(tick);
                handler.postDelayed(tick, 1000);
            }
        }

        @Override protected void onDetachedFromWindow() {
            attached = false;
            handler.removeCallbacks(tick);
            super.onDetachedFromWindow();
        }

        @Override protected void onConfigurationChanged(Configuration newConfig) {
            super.onConfigurationChanged(newConfig);
            try { rebuild(); } catch (Throwable t) { Log.w(TAG, "rebuild failed", t); }
        }

        private void updateCta() {
            if (ctaLabel == null) return;
            ctaLabel.setText(spec.countdown && !fired ? "Go home \u00B7 " + remaining : "Go home");
        }

        private void fireHome() {
            fired = true;
            handler.removeCallbacks(tick);
            cb.onHome();
        }

        private void rebuild() {
            removeAllViews();
            Context ctx = getContext();
            DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
            int W = dm.widthPixels, H = dm.heightPixels;
            boolean land = W > H;
            float d = dm.density;
            float em = Math.max(14f * d, Math.min(22f * d, 0.043f * Math.min(W, H)));
            boolean compact = !land && (H / d) < 640f;
            boolean hasVis = spec.kind != Kind.CONTENT;

            // [SHIELD-CARD] No backdrop layer: the window itself is translucent (set by the
            // overlay/activity host), so only the floating card is visible — nothing is drawn
            // behind it. BackdropView is kept unused rather than deleted in case a future
            // request brings a background back; it costs nothing sitting idle.
            setBackgroundColor(Color.TRANSPARENT);

            ScrollView scroll = new ScrollView(ctx);
            scroll.setFillViewport(true);
            scroll.setVerticalScrollBarEnabled(false);
            scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
            scroll.setClipChildren(false);
            scroll.setClipToPadding(false);
            addView(scroll, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));

            LinearLayout page = new LinearLayout(ctx);
            page.setOrientation(LinearLayout.VERTICAL);
            page.setGravity(Gravity.CENTER);
            page.setClipChildren(false);
            page.setClipToPadding(false);
            page.setPadding(0, Math.round(em), 0, Math.round(em));
            scroll.addView(page, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            int cardW = Math.round(land ? Math.min(em * 38f, W - em * 3f) : Math.min(em * 23f, W - em * 2.4f));
            FrameLayout holder = new FrameLayout(ctx);
            holder.setClipChildren(false);
            holder.setClipToPadding(false);
            page.addView(holder, new LinearLayout.LayoutParams(cardW, LinearLayout.LayoutParams.WRAP_CONTENT));

            int badgeBox = Math.round(em * 9.4f);
            int cardTop = badgeBox / 2;

            // ---- card ----
            LinearLayout card = new LinearLayout(ctx);
            card.setOrientation(land && hasVis ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
            card.setGravity(land && hasVis ? Gravity.CENTER_VERTICAL : Gravity.CENTER_HORIZONTAL);
            int padTop = Math.round(em * (land ? 3.4f : 3.6f));
            card.setPadding(Math.round(em * 1.6f), padTop, Math.round(em * 1.6f), Math.round(em * 1.6f));
            GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{0xF2242C47, 0xF2161C32});
            bg.setCornerRadius(em * 2.1f);
            bg.setStroke(Math.max(1, Math.round(d)), 0x26FFFFFF);
            card.setBackground(bg);
            FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
            cardLp.topMargin = cardTop;
            holder.addView(card, cardLp);

            // accent line on top edge
            FrameLayout.LayoutParams lineLp = new FrameLayout.LayoutParams(
                Math.round(cardW * 0.72f), Math.max(2, Math.round(d * 2)));
            lineLp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            lineLp.topMargin = cardTop;
            holder.addView(new AccentLine(ctx, spec.a2), lineLp);

            // ---- visual (ring / tile) ----
            View vis = null;
            int visPx = Math.round(em * (compact ? 8f : (land ? 9f : 10f)));
            if (spec.kind == Kind.LIMIT) {
                FrameLayout ringBox = new FrameLayout(ctx);
                ringBox.addView(new RingView(ctx, spec),
                    new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
                LinearLayout center = new LinearLayout(ctx);
                center.setOrientation(LinearLayout.VERTICAL);
                center.setGravity(Gravity.CENTER);
                center.addView(text(spec.ringBig, em * (compact || land ? 1.5f : 1.85f), COLOR_TEXT, true, Gravity.CENTER));
                TextView lbl = text(spec.ringLabel, em * 0.82f, COLOR_TEXT2, false, Gravity.CENTER);
                center.addView(lbl);
                ringBox.addView(center, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
                vis = ringBox;
            } else if (hasVis) {
                vis = new TileView(ctx, spec, em * (compact ? 0.86f : (land ? 0.9f : 1f)));
            }

            // ---- text column ----
            LinearLayout col = new LinearLayout(ctx);
            col.setOrientation(LinearLayout.VERTICAL);
            col.setGravity(land && hasVis ? Gravity.START : Gravity.CENTER_HORIZONTAL);

            TextView title = text(spec.title, em * 1.7f, COLOR_TEXT, true, land && hasVis ? Gravity.START : Gravity.CENTER);
            title.setMaxLines(2);
            LinearLayout.LayoutParams tLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            tLp.bottomMargin = Math.round(em * 0.3f);
            col.addView(title, tLp);

            TextView sub = text(spec.sub, em, COLOR_TEXT2, false, land && hasVis ? Gravity.START : Gravity.CENTER);
            sub.setLineSpacing(0f, 1.3f);
            LinearLayout.LayoutParams sLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            sLp.bottomMargin = Math.round(em * (land ? 1.0f : 1.3f));
            col.addView(sub, sLp);

            if (vis != null && !land) {
                LinearLayout.LayoutParams vLp = new LinearLayout.LayoutParams(visPx, visPx);
                vLp.gravity = Gravity.CENTER_HORIZONTAL;
                vLp.bottomMargin = Math.round(em * 1.2f);
                col.addView(vis, vLp);
            }

            // chip
            LinearLayout chip = new LinearLayout(ctx);
            chip.setOrientation(LinearLayout.HORIZONTAL);
            chip.setGravity(Gravity.CENTER_VERTICAL);
            int tint = blend(spec.a1, Color.WHITE, 0.65f);
            int ic = Math.round(em * 1.15f);
            LinearLayout.LayoutParams icLp = new LinearLayout.LayoutParams(ic, ic);
            icLp.rightMargin = Math.round(em * 0.5f);
            chip.addView(new IconView(ctx, spec.chipIcon, tint, 2f), icLp);
            chip.addView(text(spec.chipText, em * 0.85f, tint, false, Gravity.CENTER));
            chip.setPadding(Math.round(em * 1.0f), Math.round(em * 0.6f), Math.round(em * 1.0f), Math.round(em * 0.6f));
            GradientDrawable chipBg = new GradientDrawable();
            chipBg.setColor(0x12FFFFFF);
            chipBg.setCornerRadius(em * 2f);
            chipBg.setStroke(Math.max(1, Math.round(d)), 0x1AFFFFFF);
            chip.setBackground(chipBg);
            LinearLayout.LayoutParams chipLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            chipLp.bottomMargin = Math.round(em * 1.4f);
            chipLp.gravity = land && hasVis ? Gravity.START : Gravity.CENTER_HORIZONTAL;
            col.addView(chip, chipLp);

            // CTA
            LinearLayout cta = new LinearLayout(ctx);
            cta.setOrientation(LinearLayout.HORIZONTAL);
            cta.setGravity(Gravity.CENTER);
            GradientDrawable ctaBg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{spec.a1, spec.a2});
            ctaBg.setCornerRadius(em * 3f);
            cta.setBackground(ctaBg);
            ctaLabel = text("Go home", em * 1.02f, Color.WHITE, true, Gravity.CENTER);
            cta.addView(ctaLabel);
            int ai = Math.round(em * 1.15f);
            LinearLayout.LayoutParams aLp = new LinearLayout.LayoutParams(ai, ai);
            aLp.leftMargin = Math.round(em * 0.5f);
            cta.addView(new IconView(ctx, ICON_ARROW, Color.WHITE, 2.2f), aLp);
            cta.setClickable(true);
            cta.setFocusable(true);
            cta.setOnClickListener(v -> { try { fireHome(); } catch (Throwable t) { Log.w(TAG, "home failed", t); } });
            cta.setOnTouchListener((v, e) -> {
                int a = e.getActionMasked();
                if (a == MotionEvent.ACTION_DOWN) { v.setScaleX(0.97f); v.setScaleY(0.97f); }
                else if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) { v.setScaleX(1f); v.setScaleY(1f); }
                return false;
            });
            col.addView(cta, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, Math.round(em * 3.4f)));

            // ghost ("opened by mistake")
            if (spec.ghostLabel != null) {
                TextView ghost = text(spec.ghostLabel, em * 0.85f, COLOR_TEXT2, false, Gravity.CENTER);
                ghost.setPadding(0, Math.round(em * 0.9f), 0, Math.round(em * 0.2f));
                ghost.setClickable(true);
                ghost.setOnClickListener(v -> {
                    fired = true;
                    handler.removeCallbacks(tick);
                    try { cb.onGhost(); } catch (Throwable t) { Log.w(TAG, "ghost failed", t); }
                });
                col.addView(ghost, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
            }

            if (land && hasVis && vis != null) {
                LinearLayout.LayoutParams vLp = new LinearLayout.LayoutParams(visPx, visPx);
                vLp.rightMargin = Math.round(em * 1.8f);
                card.addView(vis, vLp);
                card.addView(col, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            } else {
                card.addView(col, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
            }

            // badge last so it floats above the card edge
            FrameLayout.LayoutParams bLp = new FrameLayout.LayoutParams(badgeBox, badgeBox);
            bLp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            holder.addView(new BadgeView(ctx, spec, em), bLp);

            updateCta();
        }

        private TextView text(String value, float px, int color, boolean bold, int gravity) {
            TextView tv = new TextView(getContext());
            tv.setText(value == null ? "" : value);
            tv.setTextSize(TypedValue.COMPLEX_UNIT_PX, px);
            tv.setTextColor(color);
            tv.setGravity(gravity);
            tv.setIncludeFontPadding(false);
            if (bold) tv.setTypeface(Typeface.DEFAULT_BOLD);
            return tv;
        }
    }

    /**
     * Last-resort plain view, used only if {@link #build} throws. Never lets a
     * rendering bug leave the person without a way out.
     */
    public static View fallback(Context ctx, String title, String message, Callbacks cb) {
        LinearLayout root = new LinearLayout(ctx);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(COLOR_BASE);
        int pad = Math.round(28 * ctx.getResources().getDisplayMetrics().density);
        root.setPadding(pad, pad, pad, pad);
        TextView t = new TextView(ctx);
        t.setText(title == null ? "Stay focused" : title);
        t.setTextColor(Color.WHITE);
        t.setTextSize(24);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        root.addView(t);
        TextView m = new TextView(ctx);
        m.setText(message == null ? "This app is blocked right now." : message);
        m.setTextColor(0xFFA3AED0);
        m.setTextSize(15);
        m.setGravity(Gravity.CENTER);
        m.setPadding(0, pad / 2, 0, pad);
        root.addView(m);
        TextView b = new TextView(ctx);
        b.setText("Go home");
        b.setTextColor(0xFF131A2E);
        b.setTextSize(16);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setGravity(Gravity.CENTER);
        b.setPadding(pad, pad / 2, pad, pad / 2);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFFE6EAFF);
        bg.setCornerRadius(pad * 2f);
        b.setBackground(bg);
        b.setOnClickListener(v -> { if (cb != null) cb.onHome(); });
        root.addView(b);
        return root;
    }
}
