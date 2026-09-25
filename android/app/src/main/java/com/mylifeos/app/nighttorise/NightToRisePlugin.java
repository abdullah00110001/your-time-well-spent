package com.mylifeos.app.nighttorise;

import android.content.Context;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * NightToRisePlugin — JS bridge for syncing Night-to-Rise config + rise alarm
 * time into SharedPreferences so the accessibility service can enforce the lock.
 *
 * JS side: registerPlugin<…>('NightToRise')
 *   - setConfig({ json: string })
 *   - setRiseAlarm({ epochMillis: number })
 *   - consumePendingBreak() -> { broke: boolean }
 *   - getStatus() -> NativeLockStatus   [FIX: was declared on the TS side
 *     (nightToRiseBridge.ts) and called from NightToRiseGuard, but never
 *     actually implemented here — every call silently failed and returned
 *     null. This is why the in-app "Rest now" overlay's phase was always
 *     computed locally in JS instead of reflecting real native enforcement.]
 *
 * FIX (v2): setConfig/setRiseAlarm now also call ForegroundGuardService.kick(),
 * so the polling enforcement service actually starts/stops immediately when
 * the user toggles Sleep to Rise or changes settings — it used to only start
 * on boot (via BootReceiver), so a fresh toggle mid-session had no effect
 * until the next reboot.
 */
@CapacitorPlugin(name = "NightToRise")
public class NightToRisePlugin extends Plugin {

    @PluginMethod
    public void setConfig(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("json required"); return; }
        try {
            new NightToRisePreferences(getContext()).saveJsonConfig(json);
            com.mylifeos.app.shield.core.ForegroundGuardService.forceSync(getContext());
            call.resolve();
        } catch (Exception t) {
            call.reject("setConfig failed: " + t.getMessage(), t);
        }
    }

    @PluginMethod
    public void setRiseAlarm(PluginCall call) {
        long ms = call.getLong("epochMillis", 0L);
        NightToRisePreferences prefs = new NightToRisePreferences(getContext());
        prefs.saveRiseAlarmMillis(ms);

        // Weekdays the alarm rings on (0=Sun..6=Sat). Empty/absent = every day.
        java.util.Set<Integer> days = new java.util.HashSet<>();
        try {
            com.getcapacitor.JSArray arr = call.getArray("days");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    int d = arr.optInt(i, -1);
                    if (d >= 0 && d <= 6) days.add(d);
                }
            }
        } catch (Throwable ignored) {}
        prefs.saveRiseAlarmDays(days);

        com.mylifeos.app.shield.core.ForegroundGuardService.forceSync(getContext());
        call.resolve();
    }

    @PluginMethod
    public void consumePendingBreak(PluginCall call) {
        boolean broke = new NightToRisePreferences(getContext()).consumePendingBreak();
        JSObject ret = new JSObject();
        ret.put("broke", broke);
        call.resolve(ret);
    }

    /**
     * NEW: real native enforcement state, matching NativeLockStatus on the TS
     * side exactly:
     *   { enabled, phase, locking, endTimeMs, accessibilityEnabled }
     *
     * We deliberately probe with a package name that can never match the
     * self-package exemption, the allowlist, or any hardcoded safe package —
     * decide()'s safe-package check treats null/empty as "safe" (so it would
     * always report ARMED regardless of the real window), and a real
     * foreground package could itself be on the allowlist (also always
     * reporting ARMED). A private-use probe string guarantees the returned
     * phase reflects the actual sleep/rise window, not whatever happens to
     * be in the foreground at the moment this is called.
     */
    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        NightToRiseManager mgr = new NightToRiseManager(ctx);
        NightToRiseManager.Decision d =
            mgr.decide(System.currentTimeMillis(), "__n2r_status_probe__");

        JSObject ret = new JSObject();
        ret.put("enabled", mgr.prefs().isEnabled());
        ret.put("phase", d.phase.name());
        ret.put("locking", d.shouldBlock);
        ret.put("endTimeMs", d.endTimeMs);
        ret.put("accessibilityEnabled", isAccessibilityServiceEnabled(ctx));
        call.resolve(ret);
    }

    /**
     * getDiagnostics — live self-test of the whole enforcement chain, so
     * "guards say active but nothing is blocked" is answerable on-device
     * without a log cable. Also SELF-HEALS: re-syncs the polling guard
     * service, which OEM task killers (MIUI/HyperOS) love to kill silently.
     */
    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        Context ctx = getContext();
        NightToRiseManager mgr = new NightToRiseManager(ctx);
        NightToRiseDecider.Config cfg = mgr.snapshot();
        NightToRiseManager.Decision d =
            mgr.decide(System.currentTimeMillis(), "__n2r_status_probe__");

        // Self-heal: make sure the poll service is running when it should be.
        boolean synced = false;
        try {
            com.mylifeos.app.shield.core.ForegroundGuardService.forceSync(ctx);
            synced = true;
        } catch (Throwable ignored) {}

        JSObject ret = new JSObject();
        ret.put("enabled", mgr.prefs().isEnabled());
        ret.put("configured", cfg.enabled);
        ret.put("phase", d.phase.name());
        ret.put("locking", d.shouldBlock);
        ret.put("endTimeMs", d.endTimeMs);
        ret.put("sleepGuardEnabled", cfg.sleepGuardEnabled);
        ret.put("riseGuardEnabled", cfg.riseGuardEnabled);
        ret.put("sleepTime", cfg.sleepTime);
        ret.put("riseAlarmMs", cfg.riseAlarmMs);
        ret.put("allowedCount", cfg.allowedPackages == null ? 0 : cfg.allowedPackages.size());
        ret.put("accessibilityEnabled", isAccessibilityServiceEnabled(ctx));
        ret.put("accessibilityConnected",
            com.mylifeos.app.shield.ShieldAccessibilityService.isConnected());
        ret.put("overlayGranted", hasOverlay(ctx));
        ret.put("guardServiceSynced", synced);
        ret.put("guardServiceRunning", isGuardServiceRunning(ctx));

        // Last observed enforcement pass + last actual block.
        ret.put("lastPhase", com.mylifeos.app.shield.core.BlockEnforcer.lastPhase);
        ret.put("lastLocking", com.mylifeos.app.shield.core.BlockEnforcer.lastLocking);
        ret.put("lastForegroundPackage",
            com.mylifeos.app.shield.core.BlockEnforcer.lastForegroundPackage());
        ret.put("lastGuardPassAt", com.mylifeos.app.shield.core.BlockEnforcer.lastGuardPassAt);
        ret.put("lastUsageAccess", com.mylifeos.app.shield.core.BlockEnforcer.lastUsageAccess);
        ret.put("lastBlockAt", com.mylifeos.app.shield.core.BlockEnforcer.lastBlockAt);
        ret.put("lastBlockedPkg", com.mylifeos.app.shield.core.BlockEnforcer.lastBlockedPkg);
        ret.put("lastError", com.mylifeos.app.shield.core.BlockEnforcer.lastError);
        call.resolve(ret);
    }

    private boolean hasOverlay(Context ctx) {
        try {
            return android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M
                || Settings.canDrawOverlays(ctx);
        } catch (Throwable t) {
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private boolean isGuardServiceRunning(Context ctx) {
        try {
            android.app.ActivityManager am =
                (android.app.ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) return false;
            String target =
                com.mylifeos.app.shield.core.ForegroundGuardService.class.getName();
            for (android.app.ActivityManager.RunningServiceInfo s : am.getRunningServices(200)) {
                if (s.service != null && target.equals(s.service.getClassName())) return true;
            }
            return false;
        } catch (Throwable t) {
            return false;
        }
    }


    private boolean isAccessibilityServiceEnabled(Context ctx) {
        try {
            String enabled = Settings.Secure.getString(
                ctx.getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (enabled == null || enabled.isEmpty()) return false;
            String target = ctx.getPackageName() + "/"
                + com.mylifeos.app.shield.ShieldAccessibilityService.class.getName();
            for (String s : enabled.split(":")) {
                if (s.equalsIgnoreCase(target)) return true;
            }
            return false;
        } catch (Throwable t) {
            return false;
        }
    }
}
