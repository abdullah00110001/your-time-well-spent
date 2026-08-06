package com.mylifeos.app.plugins;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.mylifeos.app.shield.vision.PureShieldAdaptiveEngine;
import com.mylifeos.app.shield.vision.PureShieldBlurView;
import com.mylifeos.app.shield.vision.PureShieldConfig;
import com.mylifeos.app.shield.vision.PureShieldModelManager;
import com.mylifeos.app.shield.vision.PureShieldPreferences;
import com.mylifeos.app.shield.vision.PureShieldService;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "PureShield")
public class PureShieldPlugin extends Plugin {

    private static final String PREFS_NAME = "pureview_prefs";
    private static final String KEY_PROJECTION_APPROVED = "projection_approved_once";
    private PureShieldModelManager modelManager;

    @Override
    public void load() {
        // ⚠️ LAZY: do NOT construct PureShieldModelManager here.
        // It indirectly touches TensorFlow Lite native libraries which can
        // crash on app startup on devices without GPU support.
    }

    private synchronized PureShieldModelManager getModelManager() {
        if (modelManager == null) {
            modelManager = new PureShieldModelManager(getContext());
        }
        return modelManager;
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("overlay", hasOverlayPermission());
        result.put("projection", isProjectionApprovedOnce() || isPureShieldRunning());
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext())) {
            resolveGranted(call, true);
            return;
        }
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        startActivityForResult(call, intent, "overlayPermissionCallback");
    }

    @ActivityCallback
    private void overlayPermissionCallback(PluginCall call, ActivityResult result) {
        resolveGranted(call, hasOverlayPermission());
    }

    @PluginMethod
    public void requestMediaProjection(PluginCall call) {
        MediaProjectionManager manager = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager == null) {
            call.reject("MediaProjectionManager unavailable");
            return;
        }
        startActivityForResult(call, manager.createScreenCaptureIntent(), "mediaProjectionCallback");
    }

    @ActivityCallback
    private void mediaProjectionCallback(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            resolveGranted(call, false);
            return;
        }
        Intent intent = new Intent(getContext(), PureShieldService.class);
        intent.setAction(PureShieldService.Actions.START_PROJECTION);
        intent.putExtra("resultCode", result.getResultCode());
        intent.putExtra("data", result.getData());
        setProjectionApprovedOnce(true);
        startPureShieldService(intent);
        resolveGranted(call, true);
    }

    @PluginMethod
    public void startPureShield(PluginCall call) {
        JSObject result = new JSObject();
        result.put("started", isPureShieldRunning());
        result.put("requiresProjection", !isPureShieldRunning());
        call.resolve(result);
    }

    @PluginMethod
    public void stopPureShield(PluginCall call) {
        if (isServiceClassRunning(PureShieldService.class)) {
            Intent intent = new Intent(getContext(), PureShieldService.class);
            intent.setAction(PureShieldService.Actions.STOP);
            getContext().startService(intent);
        } else {
            android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) { nm.cancel(9901); nm.cancel(9902); }
        }
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", isPureShieldRunning());
        call.resolve(result);
    }

    @PluginMethod
    public void setConfig(PluginCall call) {
        try {
            PureShieldConfig config = PureShieldPreferences.loadConfig(getContext());

            String blurGender = call.getString("blurGender");
            if (blurGender != null) config.setBlurGender(PureShieldConfig.BlurGender.valueOf(blurGender));

            String blurStyle = call.getString("blurStyle");
            if (blurStyle != null) {
                try {
                    config.setBlurStyle(PureShieldBlurView.BlurStyle.valueOf(blurStyle));
                } catch (IllegalArgumentException e) {
                    // Unknown style — use default BLUR
                    config.setBlurStyle(PureShieldBlurView.BlurStyle.BLUR);
                }
            }

            Double threshold = call.getDouble("confidenceThreshold");
            if (threshold != null) config.setConfidenceThreshold(threshold.floatValue());

            Integer blurOpacity = call.getInt("blurOpacity");
            if (blurOpacity != null) config.setBlurOpacity(blurOpacity);

            Integer blurPaddingPct = call.getInt("blurPaddingPct");
            if (blurPaddingPct != null) config.setBlurPaddingPct(blurPaddingPct);

            Integer minFaceSizePct = call.getInt("minFaceSizePct");
            if (minFaceSizePct != null) config.setMinFaceSizePct(minFaceSizePct);

            Integer maxFaces = call.getInt("maxFaces");
            if (maxFaces != null) config.setMaxFaces(maxFaces);

            if (call.hasOption("debugOverlay")) {
                config.setDebugOverlay(call.getBoolean("debugOverlay", config.isDebugOverlay()));
            }

            config.setEnabled(call.getBoolean("enabled", config.isEnabled()));
            config.setPauseOnBatteryBelow20(call.getBoolean("pauseOnBatteryBelow20", config.isPauseOnBatteryBelow20()));

            PureShieldPreferences.saveConfig(getContext(), config);
            notifyConfigChanged();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to set config: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getConfig(PluginCall call) {
        try {
            call.resolve(configToJson(PureShieldPreferences.loadConfig(getContext())));
        } catch (Exception e) {
            call.reject("Failed to get config: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setTargetApps(PluginCall call) {
        try {
            JSArray packagesArray = call.getArray("packages");
            Set<String> packages = new HashSet<>();
            if (packagesArray != null) {
                for (int i = 0; i < packagesArray.length(); i++) {
                    String pkg = packagesArray.getString(i);
                    if (pkg != null && !pkg.trim().isEmpty()) packages.add(pkg);
                }
            }
            PureShieldPreferences.saveTargetPackages(getContext(), packages);
            notifyConfigChanged();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to set target apps: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getTargetApps(PluginCall call) {
        JSArray packagesArray = new JSArray();
        for (String pkg : PureShieldPreferences.loadTargetPackages(getContext())) {
            packagesArray.put(pkg);
        }
        JSObject result = new JSObject();
        result.put("packages", packagesArray);
        call.resolve(result);
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent launcherIntent = new Intent(Intent.ACTION_MAIN, null);
            launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<android.content.pm.ResolveInfo> resolved = pm.queryIntentActivities(launcherIntent, 0);

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
                } catch (Exception e) {
                    app.put("appName", pkg);
                }
                apps.put(app);
            }
            JSObject result = new JSObject();
            result.put("apps", apps);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to list installed apps: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAdaptiveStatus(PluginCall call) {
        JSObject result = new JSObject();
        PureShieldService service = PureShieldService.instance;
        if (service != null) {
            PureShieldAdaptiveEngine.AdaptiveStatus status = service.getAdaptiveStatus();
            result.put("deviceTier", status.deviceTier);
            result.put("sampleIntervalMs", status.sampleIntervalMs);
            result.put("batteryLevel", status.batteryLevel);
            result.put("thermalStatus", status.thermalStatus);
            result.put("lastInferenceMs", PureShieldService.lastInferenceMs.get());
        } else {
            result.put("deviceTier", getModelManager().getSelectedTier().toString());
            result.put("sampleIntervalMs", getModelManager().getSamplingIntervalMs());
            result.put("batteryLevel", 100);
            result.put("thermalStatus", -1);
            result.put("lastInferenceMs", 0);
        }
        call.resolve(result);
    }

    // ✅ NEW: Live stats from service counters
    @PluginMethod
    public void getLiveStats(PluginCall call) {
        JSObject result = new JSObject();
        result.put("totalFrames",      PureShieldService.totalFramesProcessed.get());
        result.put("totalFaces",       PureShieldService.totalFacesDetected.get());
        result.put("totalBlurred",     PureShieldService.totalFacesBlurred.get());
        result.put("lastInferenceMs",  PureShieldService.lastInferenceMs.get());
        result.put("lastDebugMessage", PureShieldService.lastDebugMessage);
        result.put("modelStatus",      PureShieldService.lastModelStatus);
        result.put("foregroundApp",    PureShieldService.lastForegroundApp);
        result.put("blazeMaxScore",    PureShieldService.lastBlazeMaxScore);
        result.put("blazeAboveCount",  PureShieldService.lastBlazeAboveCount);
        result.put("blazeKeptCount",   PureShieldService.lastBlazeKeptCount);
        result.put("overlayCount",     PureShieldService.lastOverlayCount);
        result.put("genderModelLoaded", PureShieldService.lastGenderModelLoaded);
        call.resolve(result);
    }

    @PluginMethod
    public void switchModelTier(PluginCall call) {
        String tier = call.getString("tier");
        if (tier == null) { call.reject("tier parameter required"); return; }
        try {
            PureShieldModelManager.ModelTier newTier = PureShieldModelManager.ModelTier.valueOf(tier);
            getModelManager().setSelectedTier(newTier);
            Intent intent = new Intent(getContext(), PureShieldService.class);
            intent.setAction(PureShieldService.Actions.SWITCH_MODEL_TIER);
            intent.putExtra("tier", tier);
            if (isServiceClassRunning(PureShieldService.class)) startPureShieldService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to switch tier: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("autoDetectedTier", getModelManager().getAutoDetectedTier().toString());
            result.put("selectedTier",     getModelManager().getSelectedTier().toString());
            result.put("deviceInfo",       getModelManager().getDeviceInfo());
            result.put("expectedFps",      getModelManager().getExpectedFps());
            result.put("batteryDrain",     getModelManager().getExpectedBatteryDrainPerHour());
            result.put("tierName",         getModelManager().getTierName());
            result.put("tierDescription",  getModelManager().getTierDescription());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get device info: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getModelStatus(PluginCall call) {
        JSObject result = new JSObject();
        String status = PureShieldService.lastModelStatus;
        String reason = PureShieldService.lastModelStatusReason;
        if ("UNKNOWN".equals(status)) {
            try {
                String[] assets = getContext().getAssets().list("");
                boolean hasAny = false;
                if (assets != null) {
                    for (String a : assets) {
                        if (a.endsWith(".tflite")) { hasAny = true; break; }
                    }
                }
                status = hasAny ? "OK" : "MODEL_EMPTY";
            } catch (Throwable t) {
                status = "MODEL_FAILED";
                reason = t.getMessage();
            }
        }
        result.put("status", status);
        if (reason != null) result.put("reason", reason);
        call.resolve(result);
    }

    // Aliases
    @PluginMethod public void startService(PluginCall call) { startPureShield(call); }
    @PluginMethod public void stopService(PluginCall call)  { stopPureShield(call); }
    @PluginMethod public void isEnabled(PluginCall call)    { isRunning(call); }
    @PluginMethod public void saveConfig(PluginCall call)   { setConfig(call); }
    @PluginMethod public void loadConfig(PluginCall call)   { getConfig(call); }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private JSObject configToJson(PureShieldConfig config) {
        JSObject result = new JSObject();
        result.put("blurGender",           config.getBlurGender().toString());
        result.put("blurStyle",            config.getBlurStyle().toString());
        result.put("confidenceThreshold",  config.getConfidenceThreshold());
        result.put("blurOpacity",          config.getBlurOpacity());
        result.put("blurPaddingPct",       config.getBlurPaddingPct());
        result.put("minFaceSizePct",       config.getMinFaceSizePct());
        result.put("maxFaces",             config.getMaxFaces());
        result.put("debugOverlay",         config.isDebugOverlay());
        result.put("enabled",              config.isEnabled());
        result.put("pauseOnBatteryBelow20", config.isPauseOnBatteryBelow20());
        return result;
    }

    private void notifyConfigChanged() {
        if (PureShieldService.instance == null && !isServiceClassRunning(PureShieldService.class)) return;
        Intent intent = new Intent(getContext(), PureShieldService.class);
        intent.setAction(PureShieldService.Actions.UPDATE_CONFIG);
        startPureShieldService(intent);
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    private boolean hasOverlayPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext());
    }

    private boolean isProjectionApprovedOnce() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_PROJECTION_APPROVED, false);
    }

    private void setProjectionApprovedOnce(boolean approved) {
        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_PROJECTION_APPROVED, approved).apply();
    }

    private boolean isPureShieldRunning() {
        PureShieldService service = PureShieldService.instance;
        return service != null && service.isPureShieldRunning();
    }

    private void startPureShieldService(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
    }

    private boolean isServiceClassRunning(Class<?> serviceClass) {
        ActivityManager manager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        if (manager == null) return false;
        for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
            if (serviceClass.getName().equals(service.service.getClassName())) return true;
        }
        return false;
    }
}