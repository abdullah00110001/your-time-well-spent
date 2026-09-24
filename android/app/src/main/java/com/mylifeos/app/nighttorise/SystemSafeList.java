package com.mylifeos.app.nighttorise;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.Settings;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * SystemSafeList — packages Sleep to Rise must NEVER block, regardless of the
 * user's allow/block lists. Blocking any of these (launcher, System UI,
 * keyboard, dialer…) makes the block screen relaunch itself on every window
 * change, which floods system_server and can force a device restart.
 *
 * Resolved at runtime (launchers / IMEs / dialers differ per OEM) and cached
 * for 10 minutes so the accessibility hot path never touches PackageManager.
 */
public final class SystemSafeList {

    private static final long TTL_MS = 10 * 60_000L;

    private static final String[] STATIC = {
        "android",
        "com.android.systemui",
        "com.android.settings",
        "com.android.phone",
        "com.android.server.telecom",
        "com.android.dialer",
        "com.google.android.dialer",
        "com.samsung.android.dialer",
        "com.android.emergency",
        "com.google.android.apps.safetyhub",
        "com.android.deskclock",
        "com.google.android.deskclock",
        "com.sec.android.app.clockpackage",
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.android.permissioncontroller",
        "com.google.android.permissioncontroller",
        "com.android.incallui",
        "com.android.launcher3",
        "com.google.android.apps.nexuslauncher",
        "com.sec.android.app.launcher",
        "com.miui.home",
        "com.mi.android.globallauncher",
        "com.oppo.launcher",
        "com.bbk.launcher2",
        "com.huawei.android.launcher",
        "com.transsion.hilauncher",
        "com.android.inputmethod.latin",
        "com.google.android.inputmethod.latin",
        "com.samsung.android.honeyboard",
    };

    private static volatile Set<String> sCache = null;
    private static volatile long sCachedAt = 0L;

    private SystemSafeList() {}

    public static boolean isSafe(Context ctx, String pkg) {
        if (pkg == null) return true;
        if (pkg.equals(ctx.getPackageName())) return true;
        return get(ctx).contains(pkg);
    }

    public static Set<String> get(Context ctx) {
        long now = System.currentTimeMillis();
        Set<String> c = sCache;
        if (c != null && now - sCachedAt < TTL_MS) return c;
        synchronized (SystemSafeList.class) {
            if (sCache != null && now - sCachedAt < TTL_MS) return sCache;
            Set<String> out = new HashSet<>();
            Collections.addAll(out, STATIC);
            out.add(ctx.getPackageName());
            Context app = ctx.getApplicationContext();
            PackageManager pm = app.getPackageManager();
            try {
                Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
                addAll(out, pm.queryIntentActivities(home, 0));
            } catch (Throwable ignored) {}
            try {
                Intent dial = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:"));
                addAll(out, pm.queryIntentActivities(dial, 0));
            } catch (Throwable ignored) {}
            try {
                InputMethodManager imm = (InputMethodManager) app.getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) for (InputMethodInfo i : imm.getEnabledInputMethodList()) out.add(i.getPackageName());
            } catch (Throwable ignored) {}
            try {
                String def = Settings.Secure.getString(app.getContentResolver(), Settings.Secure.DEFAULT_INPUT_METHOD);
                if (def != null && def.contains("/")) out.add(def.substring(0, def.indexOf('/')));
            } catch (Throwable ignored) {}
            sCache = Collections.unmodifiableSet(out);
            sCachedAt = now;
            return sCache;
        }
    }

    private static void addAll(Set<String> out, List<ResolveInfo> list) {
        if (list == null) return;
        for (ResolveInfo r : list) {
            if (r.activityInfo != null && r.activityInfo.packageName != null) out.add(r.activityInfo.packageName);
        }
    }
}
