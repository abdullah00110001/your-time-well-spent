package com.mylifeos.app.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.mylifeos.app.rise.nighttorise.NightToRiseManager;
import com.mylifeos.app.rise.nighttorise.NightToRisePreferences;

import org.json.JSONException;

/**
 * JS bridge for Sleep to Rise, matching exactly the contract declared in
 * src/lib/capacitor/nightToRiseBridge.ts:
 *
 *   NightToRise.setConfig({ json })
 *   NightToRise.setRiseAlarm({ epochMillis })
 *   NightToRise.consumePendingBreak() -> { broke }
 */
@CapacitorPlugin(name = "NightToRise")
public class NightToRisePlugin extends Plugin {

    @PluginMethod
    public void setConfig(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        try {
            new NightToRisePreferences(getContext()).applyConfigJson(json);
            NightToRiseManager.scheduleNextBoundaryAlarm(getContext());
            call.resolve();
        } catch (JSONException e) {
            call.reject("Invalid config JSON", e);
        }
    }

    @PluginMethod
    public void setRiseAlarm(PluginCall call) {
        if (!call.getData().has("epochMillis")) {
            call.reject("epochMillis is required");
            return;
        }
        // getLong isn't available on PluginCall in older Capacitor versions;
        // JS numbers arrive as double/int via getData(), so read generically.
        long epochMillis;
        Object raw = call.getData().opt("epochMillis");
        if (raw instanceof Number) {
            epochMillis = ((Number) raw).longValue();
        } else {
            epochMillis = 0L;
        }

        new NightToRisePreferences(getContext()).setRiseAlarmEpochMillis(epochMillis);
        NightToRiseManager.scheduleNextBoundaryAlarm(getContext());
        call.resolve();
    }

    @PluginMethod
    public void consumePendingBreak(PluginCall call) {
        boolean broke = new NightToRisePreferences(getContext()).consumePendingBreak();
        JSObject result = new JSObject();
        result.put("broke", broke);
        call.resolve(result);
    }

    // --- Not part of the JS bridge contract yet, but useful for a future
    // permissions row wired specifically to this service (see the note in
    // NightToRiseAccessibilityService). Safe to call from JS as
    // NightToRise.isAccessibilityEnabled() if you add it to the TS
    // interface later. ---
    @PluginMethod
    public void isAccessibilityEnabled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", NightToRiseManager.isAccessibilityServiceEnabled(getContext()));
        call.resolve(result);
    }
}

