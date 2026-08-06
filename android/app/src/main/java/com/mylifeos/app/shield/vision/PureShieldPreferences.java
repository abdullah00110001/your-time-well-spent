package com.mylifeos.app.shield.vision;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.gson.Gson;
import java.util.*;

/**
 * PureShieldPreferences - Persist all PureView settings
 */
public class PureShieldPreferences {

    private static final String PREFS_NAME = "pureview_prefs";
    private static final String KEY_MODEL_TIER = "selected_model_tier";
    private static final String KEY_CONFIG = "config";
    private static final String KEY_PACKAGES = "target_packages";

    private static final Gson gson = new Gson();

    // ─────────────────────────────────────────────────────────────────────────
    // Model Tier
    // ─────────────────────────────────────────────────────────────────────────

    public static void saveSelectedModelTier(Context ctx, PureShieldModelManager.ModelTier tier) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_MODEL_TIER, tier.name())
            .apply();
    }

    public static PureShieldModelManager.ModelTier loadSelectedModelTier(Context ctx) {
        String tierStr = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_MODEL_TIER, null);
        
        if (tierStr == null) return null;
        
        try {
            return PureShieldModelManager.ModelTier.valueOf(tierStr);
        } catch (Exception e) {
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────────────────

    public static PureShieldConfig loadConfig(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_CONFIG, null);
        if (json == null) return new PureShieldConfig();
        try {
            return gson.fromJson(json, PureShieldConfig.class);
        } catch (Exception e) {
            return new PureShieldConfig();
        }
    }

    public static void saveConfig(Context ctx, PureShieldConfig config) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_CONFIG, gson.toJson(config))
            .apply();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Target Packages
    // ─────────────────────────────────────────────────────────────────────────

    public static Set<String> loadTargetPackages(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_PACKAGES, null);
        if (json == null) return new HashSet<>();
        try {
            java.lang.reflect.Type type = new com.google.gson.reflect.TypeToken<Set<String>>(){}.getType();
            Set<String> result = gson.fromJson(json, type);
            return result != null ? result : new HashSet<>();
        } catch (Exception e) {
            return new HashSet<>();
        }
    }

    public static void saveTargetPackages(Context ctx, Set<String> packages) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PACKAGES, gson.toJson(packages))
            .apply();
    }

    public static void addTargetPackage(Context ctx, String pkg) {
        Set<String> packages = loadTargetPackages(ctx);
        packages.add(pkg);
        saveTargetPackages(ctx, packages);
    }

    public static void removeTargetPackage(Context ctx, String pkg) {
        Set<String> packages = loadTargetPackages(ctx);
        packages.remove(pkg);
        saveTargetPackages(ctx, packages);
    }
}
