package com.mylifeos.app.nighttorise;

import android.content.Context;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * [N2R-CARD] Card-only Sleep/Rise block UI.
 *
 * Same idea as Shield's ShieldBlockCard: nothing is painted behind the card —
 * the host (Activity window or overlay) is left fully transparent, so only
 * the floating card is visible over whatever was on screen.
 *
 * This class only builds the view tree and hands back the live widgets the
 * existing NightToRiseBlockActivity already knows how to drive (countdown
 * timer, emergency-unlock button, kill-switch taps, allowed-app chips). No
 * block/safety logic lives here — that all stays in the Activity, unchanged.
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
        public final LinearLayout allowedContainer;
        public final Button home;
        public final Button override;

        Handles(View root, View content, TextView pill, TextView title, TextView message,
                TextView countdown, View countdownBox, LinearLayout allowedContainer, Button home, Button override) {
            this.root = root; this.content = content; this.pill = pill; this.title = title;
            this.message = message; this.countdown = countdown; this.countdownBox = countdownBox;
            this.allowedContainer = allowedContainer; this.home = home; this.override = override;
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

    /** Builds the card. {@code isRise} picks the palette/icon/copy; everything else is generic. */
    public static Handles build(Context ctx, boolean isRise) {
        int a1 = isRise ? 0xFFFB923C : 0xFF6D6BF5;
        int a2 = isRise ? 0xFFF43F5E : 0xFFB39BFF;
        int glow = isRise ? 0xFFFF7A60 : 0xFF8B7CF6;
        int tint = blend(a1, Color.WHITE, 0.7f);
        int cardTop = isRise ? 0xE62B1430 : 0xE6242A55;
        int cardBottom = isRise ? 0xF2170B22 : 0xF2121629;
        int rim = isRise ? 0xFF2B1430 : 0xFF141A3A;
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
        FrameLayout holder = new FrameLayout(ctx);
        holder.setClipChildren(false);
        holder.setClipToPadding(false);
        page.addView(holder, new LinearLayout.LayoutParams(cardW, LinearLayout.LayoutParams.WRAP_CONTENT));

        int badgeBox = Math.round(em * 5.6f);
        int cardTopMargin = badgeBox / 2;

        LinearLayout content = new LinearLayout(ctx);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(Math.round(em * 1.5f), Math.round(em * 3.1f), Math.round(em * 1.5f), Math.round(em * 1.5f));
        GradientDrawable cardBg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{cardTop, cardBottom});
        cardBg.setCornerRadius(em * 1.9f);
        cardBg.setStroke(Math.max(1, Math.round(d)), alpha(a2, 60));
        content.setBackground(cardBg);
        FrameLayout.LayoutParams contentLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        contentLp.topMargin = cardTopMargin;
        holder.addView(content, contentLp);

        // badge: soft glow + gradient circle + emoji, centred on the card's top edge
        View badgeView = new View(ctx) {
            @Override protected void onDraw(android.graphics.Canvas c) {
                float cx = getWidth() / 2f, cy = getHeight() / 2f, r = em * 2f;
                Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
                p.setShader(new RadialGradient(cx, cy, r * 1.7f, alpha(glow, 130), alpha(glow, 0), Shader.TileMode.CLAMP));
                c.drawCircle(cx, cy, r * 1.7f, p);
                p.setShader(null);
                p.setColor(rim);
                c.drawCircle(cx, cy, r, p);
                p.setShader(new LinearGradient(cx - r, cy - r, cx + r, cy + r, a1, a2, Shader.TileMode.CLAMP));
                c.drawCircle(cx, cy, r - em * 0.22f, p);
                p.setShader(null);
                p.setColor(Color.WHITE);
                p.setTextAlign(Paint.Align.CENTER);
                p.setTextSize(em * 1.9f);
                Paint.FontMetrics fm = p.getFontMetrics();
                c.drawText(isRise ? "\u2600" : "\u263E", cx, cy - (fm.ascent + fm.descent) / 2f, p);
            }
        };
        FrameLayout.LayoutParams badgeLp = new FrameLayout.LayoutParams(badgeBox, badgeBox);
        badgeLp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        badgeLp.topMargin = cardTopMargin;
        holder.addView(badgeView, badgeLp);

        // pill: "SLEEP GUARD" / "RISE GUARD"
        TextView pill = new TextView(ctx);
        pill.setText(isRise ? "RISE GUARD" : "SLEEP GUARD");
        pill.setTextColor(tint);
        pill.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 0.7f);
        pill.setTypeface(Typeface.DEFAULT_BOLD);
        pill.setLetterSpacing(0.08f);
        pill.setPadding(Math.round(em * 0.9f), Math.round(em * 0.45f), Math.round(em * 0.9f), Math.round(em * 0.45f));
        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setColor(alpha(Color.WHITE, 18));
        pillBg.setCornerRadius(em * 2f);
        pillBg.setStroke(Math.max(1, Math.round(d)), alpha(Color.WHITE, 26));
        pill.setBackground(pillBg);
        LinearLayout.LayoutParams pillLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        pillLp.bottomMargin = Math.round(em * 0.8f);
        content.addView(pill, pillLp);

        TextView title = new TextView(ctx);
        title.setTextColor(colorText);
        title.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 1.5f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        title.setIncludeFontPadding(false);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleLp.bottomMargin = Math.round(em * 0.35f);
        content.addView(title, titleLp);

        TextView message = new TextView(ctx);
        message.setTextColor(colorText2);
        message.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 0.92f);
        message.setGravity(Gravity.CENTER);
        message.setLineSpacing(0, 1.3f);
        message.setClickable(true); // kill-switch taps land here, same as before
        LinearLayout.LayoutParams msgLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        msgLp.bottomMargin = Math.round(em * 1.3f);
        content.addView(message, msgLp);

        // countdown block
        LinearLayout cdBox = new LinearLayout(ctx);
        cdBox.setOrientation(LinearLayout.VERTICAL);
        cdBox.setGravity(Gravity.CENTER);
        cdBox.setPadding(Math.round(em * 1f), Math.round(em * 0.8f), Math.round(em * 1f), Math.round(em * 0.8f));
        GradientDrawable cdBg = new GradientDrawable();
        cdBg.setColor(alpha(Color.WHITE, 14));
        cdBg.setCornerRadius(em * 1.1f);
        cdBg.setStroke(Math.max(1, Math.round(d)), alpha(Color.WHITE, 20));
        cdBox.setBackground(cdBg);
        TextView countdown = new TextView(ctx);
        countdown.setTextColor(colorText);
        countdown.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 1.7f);
        countdown.setTypeface(Typeface.DEFAULT_BOLD);
        countdown.setIncludeFontPadding(false);
        cdBox.addView(countdown, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        TextView cdLabel = new TextView(ctx);
        cdLabel.setText(isRise ? "UNTIL APPS UNLOCK" : "UNTIL WAKE-UP");
        cdLabel.setTextColor(colorText2);
        cdLabel.setTextSize(TypedValue.COMPLEX_UNIT_PX, em * 0.62f);
        cdLabel.setLetterSpacing(0.08f);
        LinearLayout.LayoutParams cdLabelLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cdLabelLp.topMargin = Math.round(em * 0.2f);
        cdBox.addView(cdLabel, cdLabelLp);
        LinearLayout.LayoutParams cdBoxLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cdBoxLp.bottomMargin = Math.round(em * 1.2f);
        content.addView(cdBox, cdBoxLp);

        // allowed-apps chips container (rows added by the Activity, unchanged logic)
        LinearLayout allowedContainer = new LinearLayout(ctx);
        allowedContainer.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams allowedLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        allowedLp.bottomMargin = Math.round(em * 1.2f);
        content.addView(allowedContainer, allowedLp);

        // primary CTA — goes Home (does not lift the block)
        Button home = new Button(ctx);
        home.setText(isRise ? "Return to Home" : "Go Back Home");
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
        content.addView(home, homeLp);

        // secondary — the real safety valve (emergency unlock / strict wait), kept clearly visible
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
        content.addView(override, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, Math.round(em * 2.7f)));

        content.setAlpha(0f);
        content.setTranslationY(em * 0.6f);
        content.animate().alpha(1f).translationY(0f).setDuration(260)
            .setInterpolator(new DecelerateInterpolator()).start();

        return new Handles(root, content, pill, title, message, countdown, cdBox, allowedContainer, home, override);
    }
}
