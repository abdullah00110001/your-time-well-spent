package com.mylifeos.app.plugins;

import android.app.admin.DevicePolicyManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.net.VpnService;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.mylifeos.app.shield.ShieldDeviceAdminReceiver;
import com.mylifeos.app.shield.ShieldFloatingService;
import com.mylifeos.app.shield.ShieldPermissionHelper;
import com.mylifeos.app.shield.ShieldPreferences;
import com.mylifeos.app.shield.ShieldVpnService;
import com.mylifeos.app.shield.core.ShieldModeManager;

@CapacitorPlugin(name = "Shield")
public class ShieldPlugin extends Plugin {

    private ShieldPreferences preferences;
    private ShieldModeManager modeManager;
    private ShieldPermissionHelper permissionHelper;

    @Override
    public void load() {
        preferences = new ShieldPreferences(getContext());
        modeManager = new ShieldModeManager(getContext());
        permissionHelper = new ShieldPermissionHelper(getContext());

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    setPrivateDns();
                } else {
                    startAdultFilterVpn();
                }
            } catch (Exception e) {
                Log.e("ShieldPlugin", "Adult filter auto-start failed", e);
            }
        }, 2000);
    }

    private static Set<String> sanitizeAppSet(Set<String> raw) {
        Set<String> out = new HashSet<>();
        if (raw == null) return out;
        for (String pkg : raw) {
            if (pkg == null) continue;
            String v = pkg.trim();
            if (v.isEmpty()) continue;
            if (v.equals("android") || v.startsWith("com.android.") || v.startsWith("com.google.android.")
                || v.startsWith("com.sec.android.") || v.startsWith("com.miui.")
                || v.startsWith("com.oneplus.") || v.startsWith("com.samsung.")
                || v.startsWith("com.huawei.")) continue;
            out.add(v);
        }
        return out;
    }

    private static JSArray toJsArray(Set<String> values) {
        JSArray arr = new JSArray();
        for (String value : values) {
            arr.put(value);
        }
        return arr;
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", preferences.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void enable(PluginCall call) {
        preferences.setEnabled(true);
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        if (modeManager.isStrictMode() && !preferences.isBypassActive()) {
            call.reject("Cannot disable during Strict Mode!");
            return;
        }
        preferences.setEnabled(false);
        call.resolve();
    }

    @PluginMethod
    public void getCurrentMode(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("mode", modeManager.getCurrentMode());
        ret.put("strict", modeManager.isStrictMode());
        call.resolve(ret);
    }

    // ------------------------
    // ALLOWLIST APP MANAGEMENT
    // ------------------------
    @PluginMethod
    public void getAllowedApps(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("apps", toJsArray(preferences.getAllowedApps()));
        call.resolve(ret);
    }

    @PluginMethod
    public void setAllowedApps(PluginCall call) {
        try {
            JSArray appsArray = call.getArray("apps");
            Set<String> apps = new HashSet<>();
            if (appsArray != null) {
                for (int i = 0; i < appsArray.length(); i++) {
                    apps.add(appsArray.getString(i));
                }
            }
            preferences.setAllowedApps(sanitizeAppSet(apps));
            com.mylifeos.app.shield.core.ForegroundGuardService.forceSync(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update allowlist", e);
        }
    }

    // Legacy aliases: kept so older app code continues to work while the architecture is allowlist-based.
    @PluginMethod
    public void getBlockedApps(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("apps", toJsArray(preferences.getAllowedApps()));
        call.resolve(ret);
    }

    @PluginMethod
    public void blockApps(PluginCall call) {
        this.setAllowedApps(call);
    }

    @PluginMethod
    public void getBlockedSites(PluginCall call) {
        JSObject ret = new JSObject();
        JSArray arr = new JSArray();
        for (String s : preferences.getBlockedSites()) arr.put(s);
        ret.put("sites", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void blockSites(PluginCall call) {
        try {
            JSArray arr = call.getArray("sites");
            Set<String> set = new HashSet<>();
            for (int i = 0; i < arr.length(); i++) set.add(arr.getString(i));
            preferences.setBlockedSites(set);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update sites", e);
        }
    }

    @PluginMethod
    public void getBlockedKeywords(PluginCall call) {
        JSObject ret = new JSObject();
        JSArray arr = new JSArray();
        for (String s : preferences.getBlockedKeywords()) arr.put(s);
        ret.put("keywords", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void blockKeywords(PluginCall call) {
        try {
            JSArray arr = call.getArray("keywords");
            Set<String> set = new HashSet<>();
            for (int i = 0; i < arr.length(); i++) set.add(arr.getString(i));
            preferences.setBlockedKeywords(set);
            com.mylifeos.app.shield.ShieldAccessibilityService.refreshContentConfiguration();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update keywords", e);
        }
    }

    // rest of file unchanged from original.
    @PluginMethod
    public void activateFocusMode(PluginCall call) {
        modeManager.activateFocusMode();
        call.resolve();
    }

    @PluginMethod
    public void activateSleepMode(PluginCall call) {
        modeManager.activateSleepMode();
        call.resolve();
    }

    @PluginMethod
    public void activateStrictMode(PluginCall call) {
        modeManager.activateStrictMode();
        call.resolve();
    }

    @PluginMethod
    public void deactivateMode(PluginCall call) {
        if (modeManager.isStrictMode() && !preferences.isBypassActive()) {
            call.reject("Strict mode is active!");
            return;
        }
        modeManager.deactivateMode();
        call.resolve();
    }

    @PluginMethod
    public void setEscalationBase(PluginCall call) {
        Integer minutes = call.getInt("minutes");
        if (minutes == null) {
            call.reject("Must provide minutes");
            return;
        }
        boolean updated = new com.mylifeos.app.shield.ShieldEscalationManager(getContext())
                .setBaseMinutes(minutes);
        JSObject ret = new JSObject();
        ret.put("success", updated);
        call.resolve(ret);
    }

    @PluginMethod
    public void getTelegramGuard(PluginCall call) {
        JSObject ret = new JSObject();
        for (String key : ShieldPreferences.TELEGRAM_GUARD_KEYS) {
            ret.put(key, preferences.getTelegramGuardOption(key));
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void setTelegramGuard(PluginCall call) {
        try {
            for (String key : ShieldPreferences.TELEGRAM_GUARD_KEYS) {
                Boolean value = call.getBoolean(key);
                if (value != null) preferences.setTelegramGuardOption(key, value);
            }
            com.mylifeos.app.shield.ShieldAccessibilityService.refreshContentConfiguration();
            JSObject ret = new JSObject();
            for (String key : ShieldPreferences.TELEGRAM_GUARD_KEYS) {
                ret.put(key, preferences.getTelegramGuardOption(key));
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to update Telegram Guard settings", e);
        }
    }

    private void setPrivateDns() {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager)
                getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName admin = new ComponentName(
                getContext(), ShieldDeviceAdminReceiver.class);

            if (dpm.isAdminActive(admin)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    dpm.setGlobalSetting(admin, "private_dns_mode", "hostname");
                    dpm.setGlobalSetting(admin, "private_dns_specifier", "family.cloudflare-dns.com");
                    Log.d("ShieldPlugin", "✅ Private DNS set — Android 10+");
                }
            } else {
                Log.w("ShieldPlugin", "Device Admin not active, falling back to VPN");
                startAdultFilterVpn();
            }
        } catch (Exception e) {
            Log.e("ShieldPlugin", "Private DNS failed, falling back to VPN", e);
            startAdultFilterVpn();
        }
    }

    private void startAdultFilterVpn() {
        try {
            Intent vpnIntent = new Intent(getContext(), ShieldVpnService.class);
            vpnIntent.setAction(ShieldVpnService.ACTION_START);
            getContext().startService(vpnIntent);
            Log.d("ShieldPlugin", "✅ VPN started");
        } catch (Exception e) {
            Log.e("ShieldPlugin", "VPN start failed", e);
        }
    }

    @PluginMethod
    public void toggleAdultFilter(PluginCall call) {
        boolean enable = call.getBoolean("enable", false);
        Intent vpnIntent = VpnService.prepare(getContext());

        if (enable) {
            if (vpnIntent != null) {
                startActivityForResult(call, vpnIntent, "vpnCallback");
            } else {
                Intent intent = new Intent(getContext(), ShieldVpnService.class);
                intent.setAction(ShieldVpnService.ACTION_START);
                getContext().startService(intent);
                call.resolve();
            }
        } else {
            Intent intent = new Intent(getContext(), ShieldVpnService.class);
            intent.setAction(ShieldVpnService.ACTION_STOP);
            getContext().startService(intent);
            call.resolve();
        }
    }

    @ActivityCallback
    private void vpnCallback(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            Intent intent = new Intent(getContext(), ShieldVpnService.class);
            intent.setAction(ShieldVpnService.ACTION_START);
            getContext().startService(intent);
            call.resolve();
        } else {
            call.reject("VPN permission denied");
        }
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent launcherIntent = new Intent(Intent.ACTION_MAIN, null);
            launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<android.content.pm.ResolveInfo> resolved = pm.queryIntentActivities(launcherIntent, 0);

            boolean withIcons = call.getBoolean("icons", Boolean.TRUE);
            JSArray apps = new JSArray();
            String myPkg = getContext().getPackageName();
            for (android.content.pm.ResolveInfo ri : resolved) {
                String pkg = ri.activityInfo.packageName;
                if (pkg == null || pkg.equals(myPkg)) continue;

                JSObject app = new JSObject();
                app.put("packageName", pkg);
                try {
                    ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                    app.put("appName", pm.getApplicationLabel(ai).toString());
                    app.put("isSystem", (ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                } catch (Exception e) {
                    app.put("appName", pkg);
                    app.put("isSystem", false);
                }
                if (withIcons) {
                    String icon = encodeAppIcon(pm, ri);
                    if (icon != null) app.put("icon", icon);
                }
                apps.put(app);
            }

            JSObject ret = new JSObject();
            ret.put("apps", apps);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to list installed apps", e);
        }
    }

    private String encodeAppIcon(PackageManager pm, android.content.pm.ResolveInfo ri) {
        try {
            android.graphics.drawable.Drawable d = ri.loadIcon(pm);
            if (d == null) return null;

            int size = 96;
            android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(
                size, size, android.graphics.Bitmap.Config.ARGB_8888);
            android.graphics.Canvas canvas = new android.graphics.Canvas(bmp);
            d.setBounds(0, 0, size, size);
            d.draw(canvas);

            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out);
            bmp.recycle();
            return "data:image/png;base64," + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP);
        } catch (Throwable t) {
            return null;
        }
    }

    @PluginMethod
    public void getBlockStats(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("blockedAttemptsToday", preferences.getBlockedAttemptsToday());
        call.resolve(ret);
    }

    @PluginMethod
    public void getDailyHistory(PluginCall call) {
        try {
            ShieldPreferences prefs = new ShieldPreferences(getContext());
            String historyJson = prefs.getFullHistory();
            JSObject ret = new JSObject();
            ret.put("history", new JSONObject(historyJson));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to fetch history", e);
        }
    }

    @PluginMethod
    public void getScreenTimeStats(PluginCall call) {
        if (!permissionHelper.hasUsageStatsPermission()) {
            call.reject("Usage Stats permission not granted");
            return;
        }

        try {
            UsageStatsManager usageStatsManager = (UsageStatsManager)
                getContext().getSystemService(Context.USAGE_STATS_SERVICE);

            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, 0);
            calendar.set(Calendar.MINUTE, 0);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            long startTime = calendar.getTimeInMillis();
            long endTime = System.currentTimeMillis();

            List<UsageStats> usageStatsList = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
            PackageManager pm = getContext().getPackageManager();

            JSArray appsArray = new JSArray();
            long totalTimeMinutes = 0;

            if (usageStatsList != null) {
                for (UsageStats stats : usageStatsList) {
                    long timeInForeground = stats.getTotalTimeInForeground();
                    String pkgName = stats.getPackageName();

                    boolean isSystemLauncher = pkgName.contains("launcher") ||
                        pkgName.contains("systemui") || pkgName.equals("android");

                    if (timeInForeground > 0 && !isSystemLauncher) {
                        long minutes = timeInForeground / (1000 * 60);
                        if (minutes > 0) {
                            totalTimeMinutes += minutes;
                            JSObject appObj = new JSObject();
                            appObj.put("packageName", pkgName);
                            appObj.put("usageMinutes", minutes);
                            try {
                                ApplicationInfo appInfo = pm.getApplicationInfo(pkgName, 0);
                                appObj.put("appName", pm.getApplicationLabel(appInfo).toString());
                            } catch (Exception e) {
                                appObj.put("appName", pkgName);
                            }
                            appsArray.put(appObj);
                        }
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("apps", appsArray);
            ret.put("totalMinutes", totalTimeMinutes);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to get screen time stats", e);
        }
    }

    @PluginMethod
    public void getCurrentMode(PluginCall call) { /* duplicate removed below? */ }
}
