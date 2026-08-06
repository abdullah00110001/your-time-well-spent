package com.mylifeos.app.shield;

import com.mylifeos.app.shield.ShieldPreferences;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import android.widget.Toast;

public class ShieldDeviceAdminReceiver extends DeviceAdminReceiver {

    private static final String TAG = "ShieldDeviceAdmin";

    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Toast.makeText(context, "🛡️ Shield Protection Activated!", Toast.LENGTH_SHORT).show();

        // ✅ Device Admin active হলে সাথে সাথে Private DNS set করো
        setPrivateDnsAfterAdminEnabled(context);
    }

    private void setPrivateDnsAfterAdminEnabled(Context context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                DevicePolicyManager dpm = (DevicePolicyManager)
                    context.getSystemService(Context.DEVICE_POLICY_SERVICE);
                ComponentName admin = new ComponentName(
                    context, ShieldDeviceAdminReceiver.class);

                if (dpm != null && dpm.isAdminActive(admin)) {
                    dpm.setGlobalSetting(admin, "private_dns_mode", "hostname");
                    dpm.setGlobalSetting(admin, "private_dns_specifier",
                        "family.cloudflare-dns.com");
                    Log.d(TAG, "✅ Private DNS set — family.cloudflare-dns.com");
                } else {
                    Log.w(TAG, "Admin not active yet");
                }
            } else {
                // Android 8/9 — VPN start করো
                Intent vpnIntent = new Intent(context, ShieldVpnService.class);
                vpnIntent.setAction(ShieldVpnService.ACTION_START);
                context.startService(vpnIntent);
                Log.d(TAG, "✅ VPN started — Android 8/9");
            }
        } catch (Exception e) {
            Log.e(TAG, "DNS/VPN setup failed", e);
        }
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
        Toast.makeText(context, "⚠️ Shield Protection Disabled!", Toast.LENGTH_SHORT).show();

        // ✅ DNS reset করো
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                DevicePolicyManager dpm = (DevicePolicyManager)
                    context.getSystemService(Context.DEVICE_POLICY_SERVICE);
                ComponentName admin = new ComponentName(
                    context, ShieldDeviceAdminReceiver.class);
                if (dpm != null && dpm.isAdminActive(admin)) {
                    dpm.setGlobalSetting(admin, "private_dns_mode", "opportunistic");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "DNS reset failed", e);
        }

        ShieldPreferences prefs = new ShieldPreferences(context);
        prefs.setStrictMode(false);
        prefs.setPreventUninstall(false);
        prefs.setCurrentMode("normal");
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        ShieldPreferences prefs = new ShieldPreferences(context);

        if (prefs.isStrictMode() || prefs.isPreventUninstallEnabled()) {
            return "🛑 ACCESS DENIED!\n\nShield Protection is locked. You cannot disable or uninstall the app while in focus mode or if Uninstall Protection is ON.";
        }

        return "Disabling Shield will stop all blocking services.";
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
    }
}
