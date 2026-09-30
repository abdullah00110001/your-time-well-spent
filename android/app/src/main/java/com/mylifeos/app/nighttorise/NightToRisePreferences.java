package com.mylifeos.app.nighttorise;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * NightToRisePreferences — persistent mirror of the JS NightToRiseConfig.
 * Written by NightToRisePlugin.setConfig (JSON) and read by NightToRiseManager.
 *
 * FIX (v2): added a "pending break" flag. When the user taps "Emergency
 * unlock" on the native block screen (NightToRiseBlockActivity), we can't
 * call back into JS directly (the app may not even be foregrounded), so we
 * just persist a timestamp here. The next time the JS layer is foregrounded,
 * it calls NightToRisePlugin.consumePendingBreak() to pick it up and reset
 * the streak correctly.
 *
 * FIX (v3): added the safety cap + emergency kill switch. See
 * safetyCapHours()/emergencyDisable() below.
 *
 * FIX (v4): mirrors the four new independent-guard fields from
 * NightToRiseConfig (types.ts): sleepGuardEnabled, riseGuardEnabled,
 * sleepGuardEndMode, sleepGuardDurationMinutes. Lets the user run Sleep
 * Guard and Rise Guard independently, and choose whether Sleep Guard ends
 * at the Rise alarm or auto-releases after a fixed duration.
 */
public class NightToRisePreferences {
    private static final String PREFS = "night_to_rise_prefs";

    private static final String K_ENABLED          = "enabled";
    private static final String K_CONFIGURED       = "configured";
    private static final String K_SLEEP_TIME       = "sleepTime";              // "HH:MM"
    private static final String K_SLEEP_BEFORE_MIN = "sleepLockMinutesBefore";
    private static final String K_RISE_AFTER_MIN   = "riseLockMinutesAfter";
    private static final String K_ALLOWED_PACKAGES = "allowedPackages";        // CSV
    private static final String K_SCHEDULE_MODE    = "scheduleMode";           // everyday|weekdays|custom
    private static final String K_SCHEDULE_DAYS    = "scheduleDays";           // CSV ints 0-6
    private static final String K_STRICT_MODE      = "strictMode";
    private static final String K_PAUSED_UNTIL_MS  = "pausedUntilMs";
    private static final String K_RISE_ALARM_MS    = "riseAlarmMs";
    private static final String K_RISE_ALARM_DAYS  = "riseAlarmDays";
    private static final String K_SLEEP_MSG        = "sleepBlockMessage";
    private static final String K_RISE_MSG         = "riseBlockMessage";
    private static final String K_PENDING_BREAK_TS = "pendingBreakTs"; // NEW
    private static final String K_BLOCKED_PACKAGES = "blockedPackages";        // CSV  (PHASE 2)
    private static final String K_BLOCKED_SITES    = "blockedSites";           // CSV  (PHASE 2)
    private static final String K_BLOCKED_KEYWORDS = "blockedKeywords";        // CSV  (PHASE 2)
    private static final String K_BLOCKLIST_MODE   = "blocklistMode";          // blocklist|allowlist
    private static final String K_STRICT_UNTIL_MS  = "strictModeLockedUntil";   // SECTION 4/5
    private static final String K_RAMP_SECONDS     = "alarmVolumeRampSeconds";  // SECTION 5
    private static final String K_CHRONOTYPE       = "chronotypeEstimate";      // SECTION 5

    // NEW (v3) — safety cap, independent of alarm state.
    private static final String K_SAFETY_CAP_HOURS = "safetyCapHours";
    private static final int    DEFAULT_SAFETY_CAP_HOURS = 10;

    // NEW (v4) — independent guard toggles + Sleep Guard end mode.
    private static final String K_SLEEP_GUARD_ENABLED = "sleepGuardEnabled";
    private static final String K_RISE_GUARD_ENABLED  = "riseGuardEnabled";
    private static final String K_SLEEP_END_MODE      = "sleepGuardEndMode";       // "until-alarm" | "duration"
    private static final String K_SLEEP_DURATION_MIN  = "sleepGuardDurationMinutes";

    private final SharedPreferences sp;

    public NightToRisePreferences(Context ctx) {
        this.sp = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void saveJsonConfig(String json) throws Exception {
        JSONObject o = new JSONObject(json);
        SharedPreferences.Editor e = sp.edit();
        e.putBoolean(K_ENABLED,          o.optBoolean("enabled", false));
        e.putBoolean(K_CONFIGURED,       o.optBoolean("configured", false));
        e.putString (K_SLEEP_TIME,       o.optString("sleepTime", "22:30"));
        e.putInt    (K_SLEEP_BEFORE_MIN, o.optInt("sleepLockMinutesBefore", 30));
        e.putInt    (K_RISE_AFTER_MIN,   o.optInt("riseLockMinutesAfter", 30));
        e.putString (K_SCHEDULE_MODE,    o.optString("scheduleMode", "everyday"));
        e.putBoolean(K_STRICT_MODE,      o.optBoolean("strictMode", false));
        e.putString (K_SLEEP_MSG,        o.optString("sleepBlockMessage", "Time to rest."));
        e.putString (K_RISE_MSG,         o.optString("riseBlockMessage", "Start your morning right."));
        // NEW (v3): safety cap, in hours. Falls back to a sane default so
        // existing configs saved before this field existed don't end up with 0.
        e.putInt    (K_SAFETY_CAP_HOURS, o.optInt("safetyCapHours", DEFAULT_SAFETY_CAP_HOURS));

        // NEW (v4): independent guard toggles + Sleep Guard end mode.
        e.putBoolean(K_SLEEP_GUARD_ENABLED, o.optBoolean("sleepGuardEnabled", true));
        e.putBoolean(K_RISE_GUARD_ENABLED,  o.optBoolean("riseGuardEnabled", true));
        String endMode = o.optString("sleepGuardEndMode", "until-alarm");
        e.putString (K_SLEEP_END_MODE, "duration".equals(endMode) ? "duration" : "until-alarm");
        e.putInt    (K_SLEEP_DURATION_MIN, o.optInt("sleepGuardDurationMinutes", 180));

        JSONArray days = o.optJSONArray("scheduleDays");
        StringBuilder dCsv = new StringBuilder();
        if (days != null) for (int i = 0; i < days.length(); i++) { if (i > 0) dCsv.append(","); dCsv.append(days.optInt(i)); }
        e.putString(K_SCHEDULE_DAYS, dCsv.toString());

        JSONArray apps = o.optJSONArray("allowedApps");
        StringBuilder aCsv = new StringBuilder();
        if (apps != null) for (int i = 0; i < apps.length(); i++) {
            JSONObject a = apps.optJSONObject(i);
            if (a == null) continue;
            String id = a.optString("id", "");
            if (id.isEmpty()) continue;
            if (aCsv.length() > 0) aCsv.append(",");
            aCsv.append(id);
        }
        e.putString(K_ALLOWED_PACKAGES, aCsv.toString());

        // Sleep to Rise is allowlist-only: legacy blocklist keys are cleared.
        e.remove(K_BLOCKLIST_MODE);
        e.remove(K_BLOCKED_PACKAGES);
        e.remove(K_BLOCKED_SITES);
        e.remove(K_BLOCKED_KEYWORDS);


        e.putInt   (K_RAMP_SECONDS, o.optInt("alarmRampSeconds", 45));
        e.putString(K_CHRONOTYPE,   o.optString("chronotype", ""));

        String strictUntil = o.optString("strictLockedUntil", null);
        if (strictUntil != null && !strictUntil.isEmpty() && !"null".equals(strictUntil)) {
            try { e.putLong(K_STRICT_UNTIL_MS, java.time.Instant.parse(strictUntil).toEpochMilli()); }
            catch (Throwable ignored) { e.remove(K_STRICT_UNTIL_MS); }
        } else {
            e.remove(K_STRICT_UNTIL_MS);
        }

        String paused = o.optString("pausedUntil", null);
        if (paused != null && !paused.isEmpty() && !"null".equals(paused)) {
            try { e.putLong(K_PAUSED_UNTIL_MS, java.time.Instant.parse(paused).toEpochMilli()); }
            catch (Throwable ignored) { e.remove(K_PAUSED_UNTIL_MS); }
        } else {
            e.remove(K_PAUSED_UNTIL_MS);
        }
        e.apply();
    }

    private static String joinStrings(JSONArray arr) {
        StringBuilder sb = new StringBuilder();
        if (arr == null) return "";
        for (int i = 0; i < arr.length(); i++) {
            String v = arr.optString(i, "").trim().toLowerCase();
            if (v.isEmpty()) continue;
            if (sb.length() > 0) sb.append(",");
            sb.append(v);
        }
        return sb.toString();
    }

    public void saveRiseAlarmMillis(long ms) { sp.edit().putLong(K_RISE_ALARM_MS, ms).apply(); }

    /**
     * Weekdays (0=Sun..6=Sat) the rise alarm actually rings on, stored as CSV.
     * Empty means "every day". Without this, Rise Guard used to repeat the
     * alarm's clock time every morning, locking the phone on days with no alarm.
     */
    public void saveRiseAlarmDays(java.util.Set<Integer> days) {
        StringBuilder sb = new StringBuilder();
        if (days != null) {
            for (Integer d : days) {
                if (d == null || d < 0 || d > 6) continue;
                if (sb.length() > 0) sb.append(",");
                sb.append(d);
            }
        }
        sp.edit().putString(K_RISE_ALARM_DAYS, sb.toString()).apply();
    }

    public java.util.Set<Integer> riseAlarmDays() {
        java.util.Set<Integer> out = new java.util.HashSet<>();
        String csv = sp.getString(K_RISE_ALARM_DAYS, "");
        if (csv == null || csv.trim().isEmpty()) return out;
        for (String part : csv.split(",")) {
            try {
                int d = Integer.parseInt(part.trim());
                if (d >= 0 && d <= 6) out.add(d);
            } catch (Throwable ignored) {}
        }
        return out;
    }

    public boolean isEnabled()        { return sp.getBoolean(K_ENABLED, false) && sp.getBoolean(K_CONFIGURED, false); }
    public String  sleepTime()        { return sp.getString(K_SLEEP_TIME, "22:30"); }
    public int     sleepBeforeMin()   { return sp.getInt(K_SLEEP_BEFORE_MIN, 30); }
    public int     riseAfterMin()     { return sp.getInt(K_RISE_AFTER_MIN, 30); }
    public String  scheduleMode()     { return sp.getString(K_SCHEDULE_MODE, "everyday"); }
    public String  sleepMessage()     { return sp.getString(K_SLEEP_MSG, "Time to rest."); }
    public String  riseMessage()      { return sp.getString(K_RISE_MSG, "Start your morning right."); }
    public boolean strictMode()       { return sp.getBoolean(K_STRICT_MODE, false); }
    public long    pausedUntilMs()    { return sp.getLong(K_PAUSED_UNTIL_MS, 0L); }
    public long    riseAlarmMs()      { return sp.getLong(K_RISE_ALARM_MS, 0L); }
    public long    strictLockedUntilMs() { return sp.getLong(K_STRICT_UNTIL_MS, 0L); }
    /** Native-side enforcement: reject settings writes while the 24h commit runs. */
    public boolean strictSettingsLocked() { return strictMode() && strictLockedUntilMs() > System.currentTimeMillis(); }
    public int     alarmRampSeconds() { return sp.getInt(K_RAMP_SECONDS, 45); }
    public String  chronotype()       { return sp.getString(K_CHRONOTYPE, ""); }

    /** NEW (v3): hard ceiling on how long Sleep Guard can run past its start,
     *  even with no/expired alarm. Prevents an indefinite lockout. */
    public int safetyCapHours() { return sp.getInt(K_SAFETY_CAP_HOURS, DEFAULT_SAFETY_CAP_HOURS); }

    /** NEW (v4): whether each guard is independently active. Both default true. */
    public boolean sleepGuardEnabled() { return sp.getBoolean(K_SLEEP_GUARD_ENABLED, true); }
    public boolean riseGuardEnabled()  { return sp.getBoolean(K_RISE_GUARD_ENABLED, true); }
    /** "until-alarm" (default) or "duration". */
    public String  sleepGuardEndMode() { return sp.getString(K_SLEEP_END_MODE, "until-alarm"); }
    /** Minutes Sleep Guard runs when sleepGuardEndMode() == "duration". Default 180 (3h). */
    public int     sleepGuardDurationMinutes() { return sp.getInt(K_SLEEP_DURATION_MIN, 180); }

    public Set<Integer> scheduleDays() {
        Set<Integer> out = new HashSet<>();
        String csv = sp.getString(K_SCHEDULE_DAYS, "0,1,2,3,4,5,6");
        for (String s : csv.split(",")) { try { out.add(Integer.parseInt(s.trim())); } catch (Throwable ignored) {} }
        return out;
    }




    private Set<String> csvSet(String key) {
        Set<String> out = new HashSet<>();
        String csv = sp.getString(key, "");
        for (String s : csv.split(",")) { String t = s.trim(); if (!t.isEmpty()) out.add(t); }
        return out;
    }

    public Set<String> allowedPackages() {
        Set<String> out = new HashSet<>();
        String csv = sp.getString(K_ALLOWED_PACKAGES, "");
        for (String s : csv.split(",")) { String t = s.trim(); if (!t.isEmpty()) out.add(t); }
        return out;
    }

    // ==========================================================
    // NEW: pending-break flag (native override -> JS streak sync)
    // ==========================================================

    // ==========================================================
    // PHASE 2: strict-mode delayed unlock request
    // ==========================================================
    private static final String K_STRICT_REQ_TS = "strictUnlockRequestedAt";
    /** 10 minute cool-down before strict mode allows an emergency unlock. */
    public static final long STRICT_UNLOCK_DELAY_MS = 10 * 60 * 1000L;

    public long strictUnlockRequestedAt() { return sp.getLong(K_STRICT_REQ_TS, 0L); }
    public void requestStrictUnlock()     { sp.edit().putLong(K_STRICT_REQ_TS, System.currentTimeMillis()).apply(); }
    public void clearStrictUnlockRequest(){ sp.edit().remove(K_STRICT_REQ_TS).apply(); }

    /** Called by NightToRiseBlockActivity when the user taps "Emergency unlock". */
    public void recordPendingBreak() {
        sp.edit().putLong(K_PENDING_BREAK_TS, System.currentTimeMillis()).apply();
    }

    // ==========================================================
    // NEW (v3): emergency kill switch
    // ==========================================================
    /**
     * KILL SWITCH — the one write path in this entire feature that does not
     * depend on JSON parsing, config validation, streak logic, or any other
     * code that could itself be the reason someone gets stuck. Called only
     * from the 7-tap gesture on the native block screen
     * (NightToRiseBlockActivity). Deliberately as small and dependency-free
     * as possible: it does exactly one thing, unconditionally.
     */
    public void emergencyDisable() {
        sp.edit().putBoolean(K_ENABLED, false).apply();
    }

    // ==========================================================
    // Blocked-attempt counters (drained by JS into night_to_rise_* logs)
    // ==========================================================
    private static final String K_ATTEMPTS      = "blockedAttempts";
    private static final String K_ATTEMPT_PKGS  = "blockedAttemptPackages"; // CSV "pkg|window"
    private static final int    MAX_ATTEMPT_PKGS = 40;

    /** Records one blocked foreground attempt during a lock window. */
    public synchronized void recordBlockedAttempt(String pkg, String windowType) {
        int count = sp.getInt(K_ATTEMPTS, 0) + 1;
        StringBuilder sb = new StringBuilder(sp.getString(K_ATTEMPT_PKGS, ""));
        String[] existing = sb.toString().split(",");
        if (existing.length >= MAX_ATTEMPT_PKGS) {
            sb = new StringBuilder();
            for (int i = existing.length - MAX_ATTEMPT_PKGS + 1; i < existing.length; i++) {
                if (existing[i].trim().isEmpty()) continue;
                if (sb.length() > 0) sb.append(",");
                sb.append(existing[i].trim());
            }
        }
        if (pkg != null && !pkg.isEmpty()) {
            if (sb.length() > 0) sb.append(",");
            sb.append(pkg).append("|").append(windowType == null ? "sleep" : windowType);
        }
        sp.edit().putInt(K_ATTEMPTS, count).putString(K_ATTEMPT_PKGS, sb.toString()).apply();
    }

    public int blockedAttempts() { return sp.getInt(K_ATTEMPTS, 0); }

    /** Returns pending "pkg|window" entries and clears the buffer. */
    public synchronized String[] drainBlockedAttempts() {
        String csv = sp.getString(K_ATTEMPT_PKGS, "");
        sp.edit().putInt(K_ATTEMPTS, 0).remove(K_ATTEMPT_PKGS).apply();
        if (csv.isEmpty()) return new String[0];
        return csv.split(",");
    }

    /**
     * Called by NightToRisePlugin.consumePendingBreak() when JS resumes.
     * Returns true (and clears the flag) exactly once per break event.
     */
    public boolean consumePendingBreak() {
        long ts = sp.getLong(K_PENDING_BREAK_TS, 0L);
        if (ts <= 0L) return false;
        sp.edit().remove(K_PENDING_BREAK_TS).apply();
        return true;
    }
}
