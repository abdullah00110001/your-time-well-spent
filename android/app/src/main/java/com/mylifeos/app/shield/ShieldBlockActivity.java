package com.mylifeos.app.shield;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class ShieldBlockActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Vibration
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(200);
                }
            }
        } catch (Exception ignored) {}

        Window w = getWindow();
        w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        w.setStatusBarColor(Color.TRANSPARENT);

        String pkgName = getIntent().getStringExtra("BLOCKED_PACKAGE");
        boolean isAdultBlock = getIntent().getBooleanExtra("IS_ADULT_BLOCK", false);
        if (pkgName == null) pkgName = "this app";
        String appName = extractAppName(pkgName);

        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);

        if (isAdultBlock) {
            // ✅ Adult block screen — আলাদা style
            buildAdultBlockScreen();
        } else {
            // Regular app block screen
            buildRegularBlockScreen(prefs, appName);
        }
    }

    // ==========================================
    // 🔞 Adult Block Screen
    // ShieldPreferences থেকে selected style পড়ে
    // ==========================================
    private void buildAdultBlockScreen() {
        // ✅ FIXED: CapacitorStorage নয়, ShieldPreferences থেকে পড়া
        ShieldPreferences shieldPrefs = new ShieldPreferences(this);
        String style = shieldPrefs.getAdultBlockScreenStyle();
        String customMessage = shieldPrefs.getAdultBlockCustomMessage();

        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setGravity(Gravity.CENTER);
        mainLayout.setPadding(60, 100, 60, 100);
        mainLayout.setBackground(getAdultThemeGradient(style));

        LinearLayout card = buildGlassCard();

        // Icon
        TextView icon = new TextView(this);
        icon.setTextSize(56);
        icon.setGravity(Gravity.CENTER);
        icon.setPadding(0, 0, 0, 32);
        icon.setText(getAdultIcon(style));

        // Title
        TextView title = new TextView(this);
        title.setTextSize(22);
        title.setTextColor(Color.WHITE);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 16);
        title.setText(getAdultTitle(style));

        // Message
        TextView message = new TextView(this);
        message.setTextSize(15);
        message.setTextColor(Color.parseColor("#CCFFFFFF"));
        message.setGravity(Gravity.CENTER);
        message.setLineSpacing(0, 1.3f);
        message.setPadding(0, 0, 0, 48);

        if ("custom".equals(style) && !customMessage.isEmpty()) {
            message.setText(customMessage);
        } else {
            message.setText(getAdultMessage(style));
        }

        // Button
        Button btn = buildHomeButton("Go Back");
        btn.setOnClickListener(v -> forceUserToHome());

        card.addView(icon);
        card.addView(title);
        card.addView(message);
        card.addView(btn);
        mainLayout.addView(card);
        setContentView(mainLayout);
    }

    // ==========================================
    // 📱 Regular App Block Screen
    // ==========================================
    private void buildRegularBlockScreen(SharedPreferences prefs, String appName) {
        String selectedTheme = prefs.getString("shield_block_screen_theme", "default");
        String customQuote = prefs.getString("shield_block_screen_text",
            "Stay Focused on your GOALS,\nyour PEACE & your HAPPINESS...");
        String base64Image = prefs.getString("shield_block_screen_image", null);

        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setGravity(Gravity.CENTER);
        mainLayout.setPadding(60, 100, 60, 100);

        if ("custom".equals(selectedTheme) && base64Image != null && !base64Image.isEmpty()) {
            try {
                String pureBase64 = base64Image.contains(",")
                    ? base64Image.substring(base64Image.indexOf(",") + 1) : base64Image;
                byte[] decoded = Base64.decode(pureBase64, Base64.DEFAULT);
                Bitmap bmp = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                mainLayout.setBackground(new BitmapDrawable(getResources(), bmp));
            } catch (Exception e) {
                mainLayout.setBackground(getRegularThemeGradient("default"));
            }
        } else {
            mainLayout.setBackground(getRegularThemeGradient(selectedTheme));
        }

        LinearLayout card = buildGlassCard();

        TextView shieldIcon = new TextView(this);
        shieldIcon.setText("🛡️");
        shieldIcon.setTextSize(60);
        shieldIcon.setGravity(Gravity.CENTER);
        shieldIcon.setPadding(0, 0, 0, 40);

        TextView quoteText = new TextView(this);
        quoteText.setText(customQuote);
        quoteText.setTextSize(18);
        quoteText.setTextColor(Color.WHITE);
        quoteText.setTypeface(null, Typeface.BOLD);
        quoteText.setGravity(Gravity.CENTER);
        quoteText.setLineSpacing(0, 1.2f);
        quoteText.setPadding(0, 0, 0, 60);

        TextView blockedText = new TextView(this);
        blockedText.setText(appName + " is currently blocked.");
        blockedText.setTextSize(14);
        blockedText.setTextColor(Color.parseColor("#E2E8F0"));
        blockedText.setGravity(Gravity.CENTER);
        blockedText.setPadding(0, 0, 0, 80);

        Button btn = buildHomeButton("Go Back Home");
        btn.setOnClickListener(v -> forceUserToHome());

        card.addView(shieldIcon);
        card.addView(quoteText);
        card.addView(blockedText);
        card.addView(btn);
        mainLayout.addView(card);
        setContentView(mainLayout);
    }

    // ==========================================
    // 🎨 Adult Theme Gradients
    // ==========================================
    private GradientDrawable getAdultThemeGradient(String style) {
        int[] colors;
        switch (style) {
            case "reminder":
                colors = new int[]{Color.parseColor("#4C0519"), Color.parseColor("#0F172A")};
                break;
            case "strict":
                colors = new int[]{Color.parseColor("#18181B"), Color.parseColor("#09090B")};
                break;
            case "motivate":
                colors = new int[]{Color.parseColor("#2E1065"), Color.parseColor("#1E1B4B")};
                break;
            case "streak":
                colors = new int[]{Color.parseColor("#431407"), Color.parseColor("#1C1003")};
                break;
            case "islamic":
                colors = new int[]{Color.parseColor("#022C22"), Color.parseColor("#042F2E")};
                break;
            default: // focus
                colors = new int[]{Color.parseColor("#0F172A"), Color.parseColor("#1E293B")};
                break;
        }
        return new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors);
    }

    private String getAdultIcon(String style) {
        switch (style) {
            case "reminder": return "💔";
            case "strict": return "🚫";
            case "motivate": return "💪";
            case "streak": return "🔥";
            case "islamic": return "☪️";
            default: return "🛡️";
        }
    }

    private String getAdultTitle(String style) {
        switch (style) {
            case "reminder": return "Not Today";
            case "strict": return "Access Denied";
            case "motivate": return "You Got This!";
            case "streak": return "Don't Break It!";
            case "islamic": return "اتق الله";
            default: return "Stay Focused";
        }
    }

    private String getAdultMessage(String style) {
        switch (style) {
            case "reminder": return "Remember your goals.\nYou can do this.";
            case "strict": return "This content is blocked.\nFocus Shield is protecting you.";
            case "motivate": return "Every time you resist,\nyou grow stronger.";
            case "streak": return "Stay strong.\nDon't ruin your progress.";
            case "islamic": return "Fear Allah.\nGuard your eyes and heart.\n\nغُضَّ بَصَرَكَ";
            default: return "This content is blocked.\nYou are better than this.";
        }
    }

    // ==========================================
    // 🎨 Regular Theme Gradients
    // ==========================================
    private GradientDrawable getRegularThemeGradient(String themeId) {
        int[] colors;
        switch (themeId) {
            case "ocean":
                colors = new int[]{Color.parseColor("#22D3EE"), Color.parseColor("#3B82F6")};
                break;
            case "sunset":
                colors = new int[]{Color.parseColor("#67E8F9"), Color.parseColor("#F472B6")};
                break;
            case "nature":
                colors = new int[]{Color.parseColor("#DDD6FE"), Color.parseColor("#C4B5FD")};
                break;
            case "minimal":
                colors = new int[]{Color.parseColor("#F9A8D4"), Color.parseColor("#FB7185")};
                break;
            default:
                colors = new int[]{Color.parseColor("#D8B4FE"), Color.parseColor("#A78BFA")};
                break;
        }
        return new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors);
    }

    // ==========================================
    // 🛠️ Helper — Glass Card
    // ==========================================
    private LinearLayout buildGlassCard() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER);
        card.setPadding(80, 100, 80, 100);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#33FFFFFF"));
        bg.setCornerRadius(60f);
        bg.setStroke(3, Color.parseColor("#4DFFFFFF"));
        card.setBackground(bg);
        return card;
    }

    private Button buildHomeButton(String label) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setTextSize(16);
        btn.setTextColor(Color.parseColor("#1E293B"));
        btn.setTypeface(null, Typeface.BOLD);
        btn.setPadding(60, 40, 60, 40);
        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(Color.WHITE);
        btnBg.setCornerRadius(100f);
        btn.setBackground(btnBg);
        return btn;
    }

    private String extractAppName(String pkgName) {
        if (pkgName.contains("facebook")) return "Facebook";
        if (pkgName.contains("instagram")) return "Instagram";
        if (pkgName.contains("youtube")) return "YouTube";
        if (pkgName.contains("tiktok")) return "TikTok";
        String[] parts = pkgName.split("\\.");
        String name = parts[parts.length - 1];
        return name.substring(0, 1).toUpperCase() + name.substring(1);
    }

    private void forceUserToHome() {
        Intent startMain = new Intent(Intent.ACTION_MAIN);
        startMain.addCategory(Intent.CATEGORY_HOME);
        startMain.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(startMain);
        finish();
    }

    @Override
    public void onBackPressed() {
        forceUserToHome();
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        finish();
    }
}
