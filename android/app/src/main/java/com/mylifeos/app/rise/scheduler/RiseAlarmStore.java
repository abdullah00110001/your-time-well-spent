package com.mylifeos.app.rise.scheduler;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * RiseAlarmStore — native mirror of every scheduled alarm shot.
 *
 * The old boot restore read a Capacitor localStorage blob that never contained
 * the sound / loudness / weekday of a shot, so reboots either lost alarms or
 * restored them wrong. Every shot scheduled through RiseAlarmScheduler is now
 * persisted here with the full payload, which is what BootReceiver replays.
 */
public final class RiseAlarmStore {

    private static final String TAG   = "RiseAlarmStore";
    private static final String PREFS = "rise_native_shots";
    private static final String KEY   = "shots"; // JSONObject: id -> shot

    private RiseAlarmStore() {}

    public static class Shot {
        public int     id;
        public long    timeInMillis;
        public String  uuid;
        public String  title;
        public String  body;
        public String  soundUri;
        public boolean extraLoud;
        /** 0=Sun..6=Sat for recurring weekly shots, -1 for one-shot alarms. */
        public int     dayOfWeek = -1;

        JSONObject toJson() throws Exception {
            JSONObject o = new JSONObject();
            o.put("id", id);
            o.put("timeInMillis", timeInMillis);
            o.put("uuid", uuid);
            o.put("title", title);
            o.put("body", body);
            if (soundUri != null) o.put("soundUri", soundUri);
            o.put("extraLoud", extraLoud);
            o.put("dayOfWeek", dayOfWeek);
            return o;
        }

        static Shot fromJson(JSONObject o) {
            Shot s = new Shot();
            s.id           = o.optInt("id", 0);
            s.timeInMillis = o.optLong("timeInMillis", 0L);
            s.uuid         = o.optString("uuid", String.valueOf(s.id));
            s.title        = o.optString("title", "Rise Alarm");
            s.body         = o.optString("body", "Wake up!");
            String sound   = o.optString("soundUri", "");
            s.soundUri     = sound.isEmpty() || "null".equals(sound) ? null : sound;
            s.extraLoud    = o.optBoolean("extraLoud", false);
            s.dayOfWeek    = o.optInt("dayOfWeek", -1);
            return s;
        }
    }

    private static SharedPreferences sp(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject readAll(Context ctx) {
        try {
            String raw = sp(ctx).getString(KEY, "{}");
            return new JSONObject(raw == null || raw.isEmpty() ? "{}" : raw);
        } catch (Throwable t) {
            return new JSONObject();
        }
    }

    public static synchronized void save(Context ctx, Shot shot) {
        try {
            JSONObject all = readAll(ctx);
            all.put(String.valueOf(shot.id), shot.toJson());
            sp(ctx).edit().putString(KEY, all.toString()).apply();
        } catch (Throwable t) {
            Log.w(TAG, "save failed for id=" + shot.id, t);
        }
    }

    public static synchronized void remove(Context ctx, int id) {
        try {
            JSONObject all = readAll(ctx);
            all.remove(String.valueOf(id));
            sp(ctx).edit().putString(KEY, all.toString()).apply();
        } catch (Throwable t) {
            Log.w(TAG, "remove failed for id=" + id, t);
        }
    }

    public static synchronized Shot get(Context ctx, int id) {
        try {
            JSONObject all = readAll(ctx);
            JSONObject o = all.optJSONObject(String.valueOf(id));
            return o == null ? null : Shot.fromJson(o);
        } catch (Throwable t) {
            return null;
        }
    }

    public static synchronized List<Shot> all(Context ctx) {
        List<Shot> out = new ArrayList<>();
        JSONObject all = readAll(ctx);
        for (Iterator<String> it = all.keys(); it.hasNext(); ) {
            JSONObject o = all.optJSONObject(it.next());
            if (o != null) out.add(Shot.fromJson(o));
        }
        return out;
    }
}
