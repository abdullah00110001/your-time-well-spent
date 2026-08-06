package com.mylifeos.app.shield;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

/**
 * Escalating block timer per app.
 *
 * Offense count → block duration:
 *   1st  →  base minutes        (default 5)
 *   2nd  →  base × 2           (10)
 *   3rd+ →  base × 6           (30, capped)
 *
 * Counter resets after 24 hours of no offense.
 * User can increase base, never decrease.
 */
public class ShieldEscalationManager {

    private static final String TAG = "ShieldEscalation";
    private static final String PREFS_NAME = "shield_escalation";

    // Keys: per-package
    private static final String KEY_OFFENSE_COUNT = "_offense_count";
    private static final String KEY_BLOCK_UNTIL   = "_block_until_ms";
    private static final String KEY_LAST_OFFENSE  = "_last_offense_ms";

    // Global
    private static final String KEY_BASE_MINUTES  = "base_minutes";

    private static final long RESET_AFTER_MS = 24 * 60 * 60 * 1000L; // 24h

    private final SharedPreferences prefs;

    public ShieldEscalationManager(Context context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // ── Base duration ──────────────────────────────────────────────────────────

    /** Get base block minutes. Minimum 5. */
    public int getBaseMinutes() {
        return Math.max(5, prefs.getInt(KEY_BASE_MINUTES, 5));
    }

    /**
     * Set base block minutes. Can only increase, never decrease.
     * @return true if updated, false if rejected (new value < current)
     */
    public boolean setBaseMinutes(int minutes) {
        int current = getBaseMinutes();
        if (minutes < current) {
            Log.w(TAG, "Rejected base minutes decrease: " + minutes + " < " + current);
            return false;
        }
        prefs.edit().putInt(KEY_BASE_MINUTES, Math.max(5, minutes)).apply();
        return true;
    }

    // ── Offense management ────────────────────────────────────────────────────

    /**
     * Register one offense for a package.
     * Calculates new block duration and stores block-until timestamp.
     */
    public void registerOffense(String pkg) {
        long now = System.currentTimeMillis();

        // Auto-reset if 24h has passed since last offense
        long lastOffense = prefs.getLong(pkg + KEY_LAST_OFFENSE, 0);
        int count = prefs.getInt(pkg + KEY_OFFENSE_COUNT, 0);
        if (now - lastOffense > RESET_AFTER_MS) {
            count = 0;
            Log.d(TAG, "⏰ Counter reset for " + pkg + " (24h passed)");
        }

        count++;
        long blockDurationMs = calculateBlockDurationMs(count);
        long blockUntil = now + blockDurationMs;

        prefs.edit()
            .putInt(pkg + KEY_OFFENSE_COUNT, count)
            .putLong(pkg + KEY_BLOCK_UNTIL, blockUntil)
            .putLong(pkg + KEY_LAST_OFFENSE, now)
            .apply();

        Log.d(TAG, "🚫 Offense #" + count + " for " + pkg
            + " → blocked for " + (blockDurationMs / 60000) + " min"
            + " until " + blockUntil);
    }

    /**
     * Calculate block duration in milliseconds based on offense count.
     *
     * 1st  → base
     * 2nd  → base × 2
     * 3rd+ → base × 6  (cap)
     */
    private long calculateBlockDurationMs(int offenseCount) {
        int base = getBaseMinutes();
        int minutes;
        if (offenseCount == 1) {
            minutes = base;
        } else if (offenseCount == 2) {
            minutes = base * 2;
        } else {
            minutes = base * 6; // cap at 30 min with default base=5
        }
        return (long) minutes * 60 * 1000L;
    }

    // ── Block status ──────────────────────────────────────────────────────────

    /** Is this package currently in escalation block? */
    public boolean isAppBlocked(String pkg) {
        long blockUntil = prefs.getLong(pkg + KEY_BLOCK_UNTIL, 0);
        return System.currentTimeMillis() < blockUntil;
    }

    /** Remaining block time in milliseconds. 0 if not blocked. */
    public long getRemainingMs(String pkg) {
        long blockUntil = prefs.getLong(pkg + KEY_BLOCK_UNTIL, 0);
        long remaining = blockUntil - System.currentTimeMillis();
        return Math.max(0, remaining);
    }

    /** Offense count for this package (resets every 24h). */
    public int getOffenseCount(String pkg) {
        return prefs.getInt(pkg + KEY_OFFENSE_COUNT, 0);
    }

    /** Next block duration if offense happens now (for UI display). */
    public long getNextBlockDurationMs(String pkg) {
        long now = System.currentTimeMillis();
        long lastOffense = prefs.getLong(pkg + KEY_LAST_OFFENSE, 0);
        int count = prefs.getInt(pkg + KEY_OFFENSE_COUNT, 0);
        if (now - lastOffense > RESET_AFTER_MS) count = 0;
        return calculateBlockDurationMs(count + 1);
    }

    // ── Manual control ────────────────────────────────────────────────────────

    /** Clear block for a package (admin override). */
    public void clearBlock(String pkg) {
        prefs.edit()
            .remove(pkg + KEY_BLOCK_UNTIL)
            .remove(pkg + KEY_OFFENSE_COUNT)
            .remove(pkg + KEY_LAST_OFFENSE)
            .apply();
        Log.d(TAG, "✅ Block cleared for " + pkg);
    }

    /** Clear all blocks. */
    public void clearAll() {
        prefs.edit().clear().apply();
        Log.d(TAG, "✅ All escalation blocks cleared");
    }
}