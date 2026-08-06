package com.mylifeos.app.nighttorise;

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
 *   - consumePendingBreak() -> { broke: boolean }   [NEW]
 */
@CapacitorPlugin(name = "NightToRise")
public class NightToRisePlugin extends Plugin {

    @PluginMethod
    public void setConfig(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("json required"); return; }
        try {
            new NightToRisePreferences(getContext()).saveJsonConfig(json);
            call.resolve();
        } catch (Exception t) {
            call.reject("setConfig failed: " + t.getMessage(), t);
        }
    }

    @PluginMethod
    public void setRiseAlarm(PluginCall call) {
        long ms = call.getLong("epochMillis", 0L);
        new NightToRisePreferences(getContext()).saveRiseAlarmMillis(ms);
        call.resolve();
    }

    /**
     * NEW: JS calls this on app resume/mount to check whether the native
     * block screen's "Emergency unlock" was used since the last check. If so,
     * it should call recordBreak() on the streak hook.
     */
    @PluginMethod
    public void consumePendingBreak(PluginCall call) {
        boolean broke = new NightToRisePreferences(getContext()).consumePendingBreak();
        JSObject ret = new JSObject();
        ret.put("broke", broke);
        call.resolve(ret);
    }
}
