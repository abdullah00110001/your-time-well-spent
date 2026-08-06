package com.mylifeos.app.shield;

import android.app.AppOpsManager;
import android.content.Context;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

public class ShieldPermissionHelper {
    private static final String TAG = "ShieldPermHelper";
    private Context context;

    public ShieldPermissionHelper(Context context) {
        this.context = context;
    }

    // ==========================================
    // 🛠️ Accessibility Service Check
    // ==========================================
    public boolean hasAccessibilityPermission() {
        int accessibilityEnabled = 0;
        final String service = context.getPackageName() + "/" + ShieldAccessibilityService.class.getCanonicalName();
        
        try {
            accessibilityEnabled = Settings.Secure.getInt(
                    context.getApplicationContext().getContentResolver(),
                    android.provider.Settings.Secure.ACCESSIBILITY_ENABLED);
        } catch (Settings.SettingNotFoundException e) {
            Log.e(TAG, "Accessibility setting not found", e);
        }

        TextUtils.SimpleStringSplitter mStringColonSplitter = new TextUtils.SimpleStringSplitter(':');

        if (accessibilityEnabled == 1) {
            String settingValue = Settings.Secure.getString(
                    context.getApplicationContext().getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                mStringColonSplitter.setString(settingValue);
                while (mStringColonSplitter.hasNext()) {
                    String accessibilityService = mStringColonSplitter.next();
                    if (accessibilityService.equalsIgnoreCase(service)) {
                        return true; // সার্ভিস পারফেক্টলি রানিং আছে
                    }
                }
            }
        }
        return false;
    }

    // ==========================================
    // 📊 Usage Stats (Screen Time) Check
    // ==========================================
    public boolean hasUsageStatsPermission() {
        AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        int mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(), context.getPackageName());
        
        if (mode == AppOpsManager.MODE_DEFAULT) {
            return (context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) == android.content.pm.PackageManager.PERMISSION_GRANTED);
        } else {
            return (mode == AppOpsManager.MODE_ALLOWED);
        }
    }

    // ==========================================
    // 📱 Display Over Other Apps (Overlay) Check
    // ==========================================
    public boolean hasOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(context);
        }
        return true; // Android 6.0 এর নিচে এই পারমিশন বাই-ডিফল্ট ট্রু থাকে
    }
}
