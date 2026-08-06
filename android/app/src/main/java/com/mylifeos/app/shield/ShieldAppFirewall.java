package com.mylifeos.app.shield;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Controls per-app network blocking via ShieldVpnService.
 * Root ছাড়াই কাজ করে — local VPN tunnel দিয়ে।
 */
public class ShieldAppFirewall {

    private static final String TAG = "ShieldAppFirewall";

    public static final String ACTION_BLOCK_APP   = "shield.firewall.BLOCK_APP";
    public static final String ACTION_UNBLOCK_APP = "shield.firewall.UNBLOCK_APP";
    public static final String ACTION_BLOCK_ALL   = "shield.firewall.BLOCK_ALL";
    public static final String ACTION_UNBLOCK_ALL = "shield.firewall.UNBLOCK_ALL";
    public static final String EXTRA_PACKAGE      = "target_package";
    public static final String EXTRA_DURATION_MS  = "duration_ms";

    private final Context context;

    public ShieldAppFirewall(Context context) {
        this.context = context.getApplicationContext();
    }

    /**
     * Block a specific app's internet for durationMs milliseconds.
     * ShieldVpnService এ intent পাঠায়।
     */
    public void blockApp(String packageName, long durationMs) {
        Log.d(TAG, "🔥 Blocking network for: " + packageName
            + " | duration: " + (durationMs / 60000) + " min");
        Intent intent = new Intent(context, ShieldVpnService.class);
        intent.setAction(ACTION_BLOCK_APP);
        intent.putExtra(EXTRA_PACKAGE, packageName);
        intent.putExtra(EXTRA_DURATION_MS, durationMs);
        context.startService(intent);
    }

    /**
     * Unblock a specific app's internet immediately.
     */
    public void unblockApp(String packageName) {
        Log.d(TAG, "✅ Unblocking network for: " + packageName);
        Intent intent = new Intent(context, ShieldVpnService.class);
        intent.setAction(ACTION_UNBLOCK_APP);
        intent.putExtra(EXTRA_PACKAGE, packageName);
        context.startService(intent);
    }

    /**
     * Block ALL internet (nuclear option).
     */
    public void blockAllInternet(long durationMs) {
        Log.d(TAG, "💣 Blocking ALL internet for " + (durationMs / 60000) + " min");
        Intent intent = new Intent(context, ShieldVpnService.class);
        intent.setAction(ACTION_BLOCK_ALL);
        intent.putExtra(EXTRA_DURATION_MS, durationMs);
        context.startService(intent);
    }

    public void unblockAll() {
        Intent intent = new Intent(context, ShieldVpnService.class);
        intent.setAction(ACTION_UNBLOCK_ALL);
        context.startService(intent);
    }
}