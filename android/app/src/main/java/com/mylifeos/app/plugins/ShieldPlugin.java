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

        // Adult filter — app open হলেই automatically start
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

    // ==========================================
    // 🛡️ MASTER CONTROL
    // ==========================================
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

    // ==========================================
    // 🧠 SHIELD MODES
    // ==========================================
    @PluginMethod
    public void getCurrentMode(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("mode", modeManager.getCurrentMode());
        ret.put("strict", modeManager.isStrictMode());
        call.resolve(ret);
    }

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

    // ==========================================
    // 📱 BLOCKING LOGIC
    // ==========================================
    @PluginMethod
    public void getBlockedApps(PluginCall call) {
        JSObject ret = new JSObject();
        JSArray appsArray = new JSArray();
        for (String app : preferences.getBlockedApps()) {
            appsArray.put(app);
        }
        ret.put("apps", appsArray);
        call.resolve(ret);
    }

    @PluginMethod
    public void blockApps(PluginCall call) {
        try {
            JSArray appsArray = call.getArray("apps");
            Set<String> apps = new HashSet<>();
            for (int i = 0; i < appsArray.length(); i++) {
                apps.add(appsArray.getString(i));
            }
            preferences.setBlockedApps(apps);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update block list", e);
        }
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
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update keywords", e);
        }
    }

    // ==========================================
    // 🌐 ADULT FILTER & VPN
    // ==========================================
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

    // ==========================================
    // 🎨 ADULT FILTER — BLOCK SCREEN STYLE
    // ইউজার AdultFilterPage থেকে যে style select করে সেটা save হয়
    // ShieldBlockActivity এই pref পড়ে সঠিক UI দেখাবে
    // ==========================================
    @PluginMethod
    public void updateAdultFilterScreen(PluginCall call) {
        try {
            String style = call.getString("style", "focus");
            String customMessage = call.getString("customMessage", "");

            preferences.setAdultBlockScreenStyle(style);
            preferences.setAdultBlockCustomMessage(customMessage);

            Log.d("ShieldPlugin", "✅ Adult block screen style saved: " + style);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save adult filter screen style", e);
        }
    }

    // AdultFilterPage load হলে saved style ফেরত দেয়
    @PluginMethod
    public void getAdultFilterScreen(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("style", preferences.getAdultBlockScreenStyle());
        ret.put("customMessage", preferences.getAdultBlockCustomMessage());
        call.resolve(ret);
    }

    // ==========================================
    // ⚙️ SETTINGS & PROTECTION
    // ==========================================
    @PluginMethod
    public void updateHardcoreSettings(PluginCall call) {
        try {
            String key = call.getString("key");
            boolean value = call.getBoolean("value", false);

            if (key == null) {
                call.reject("Must provide a key");
                return;
            }

            switch (key) {
                case "blockSplitScreen":
                    preferences.setBlockSplitScreen(value);
                    break;
                case "blockPowerOff":
                    preferences.setBlockPowerOff(value);
                    break;
                case "blockRecentApps":
                    preferences.setBlockRecentApps(value);
                    break;
                case "preventUninstall":
                    preferences.setPreventUninstall(value);
                    break;
                case "blockReels":
                    preferences.setReelsBlockEnabled(value);
                    break;
                case "blockAdult":
                    preferences.setAdultFilterEnabled(value);
                    break;
                default:
                    call.reject("Unknown settings key: " + key);
                    return;
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Error updating hardcore settings", e);
        }
    }

    @PluginMethod
    public void updateNotificationSettings(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Key cannot be null");
            return;
        }
        boolean value = call.getBoolean("value", false);
        if ("vibrate".equals(key)) preferences.setVibrationEnabled(value);
        else if ("sound".equals(key)) preferences.setSoundEnabled(value);
        else if ("lowTimeAlert".equals(key)) preferences.setLowTimeAlert(value);
        call.resolve();
    }

    @PluginMethod
    public void clearHistory(PluginCall call) {
        try {
            preferences.clearHistory();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to clear history", e);
        }
    }

    @PluginMethod
    public void requestUninstall(PluginCall call) {
        Context context = getContext();

        if (preferences.isStrictMode() && !preferences.isBypassActive()) {
            call.reject("Cannot uninstall while Strict Mode is active!");
            return;
        }

        DevicePolicyManager dpm = (DevicePolicyManager)
            context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(
            context, ShieldDeviceAdminReceiver.class);

        if (dpm.isAdminActive(adminComponent)) {
            dpm.removeActiveAdmin(adminComponent);
        }

        Intent intent = new Intent(Intent.ACTION_DELETE);
        intent.setData(Uri.parse("package:" + context.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);

        call.resolve();
    }

    // ==========================================
    // 🔑 EMERGENCY BYPASS
    // ==========================================
    @PluginMethod
    public void setEmergencyPin(PluginCall call) {
        String pin = call.getString("pin");
        if (pin == null || pin.length() < 4) {
            call.reject("PIN must be at least 4 digits");
            return;
        }
        preferences.setEmergencyPin(pin);
        call.resolve();
    }

    @PluginMethod
    public void triggerEmergencyBypass(PluginCall call) {
        String inputPin = call.getString("pin");
        String savedPin = preferences.getEmergencyPin();

        if (savedPin.isEmpty()) {
            call.reject("No Emergency PIN set!");
            return;
        }

        if (savedPin.equals(inputPin)) {
            preferences.setStrictMode(false);
            preferences.setEnabled(false);
            preferences.setPreventUninstall(false);
            preferences.setBypassActive(true);
            preferences.setCurrentMode("normal");

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Incorrect Emergency PIN!");
        }
    }

    // ==========================================
    // 📊 DATA & STATS
    // ==========================================
    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent launcherIntent = new Intent(Intent.ACTION_MAIN, null);
            launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<android.content.pm.ResolveInfo> resolved =
                pm.queryIntentActivities(launcherIntent, 0);

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
                apps.put(app);
            }

            JSObject ret = new JSObject();
            ret.put("apps", apps);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to list installed apps", e);
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

    // ==========================================
    // 🪟 FLOATING TIMER
    // ==========================================
    @PluginMethod
    public void toggleFloatingTimer(PluginCall call) {
        boolean enable = call.getBoolean("enable", false);
        preferences.setFloatingTimerEnabled(enable);

        Intent intent = new Intent(getContext(), ShieldFloatingService.class);
        if (enable) {
            getContext().startService(intent);
        } else {
            getContext().stopService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void updateFloatingTimerStyle(PluginCall call) {
        if (call.hasOption("opacity"))
            preferences.setFloatingTimerOpacity(call.getFloat("opacity", 1.0f));
        if (call.hasOption("size"))
            preferences.setFloatingTimerSize(call.getInt("size", 16));
        if (call.hasOption("countdown"))
            preferences.setCountdownMode(call.getBoolean("countdown", false));
        call.resolve();
    }

    // ==========================================
    // 🔐 PERMISSIONS
    // ==========================================
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("accessibility", permissionHelper.hasAccessibilityPermission());
        ret.put("usageStats", permissionHelper.hasUsageStatsPermission());
        ret.put("overlay", permissionHelper.hasOverlayPermission());
        ret.put("battery", true);

        // Device Admin check
        DevicePolicyManager dpm = (DevicePolicyManager)
            getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(getContext(), ShieldDeviceAdminReceiver.class);
        ret.put("deviceAdmin", dpm.isAdminActive(admin));

        call.resolve(ret);
    }

    @PluginMethod
    public void requestAccessibility(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestUsageStats(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestOverlay(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void requestBattery(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void requestDeviceAdmin(PluginCall call) {
        try {
            ComponentName adminComponent = new ComponentName(
                getContext(), ShieldDeviceAdminReceiver.class);
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "Shield needs Device Admin to set DNS filter and prevent uninstall.");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open Device Admin settings", e);
        }
    }
}
