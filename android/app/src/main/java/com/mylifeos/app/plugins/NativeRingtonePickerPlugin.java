package com.mylifeos.app.plugins;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.media.RingtoneManager;
import android.net.Uri;
import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

@CapacitorPlugin(name = "NativeRingtonePicker")
public class NativeRingtonePickerPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        String title = call.getString("title", "Choose alarm sound");
        String existingUri = call.getString("existingUri", null);

        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE,
                RingtoneManager.TYPE_ALARM | RingtoneManager.TYPE_RINGTONE | RingtoneManager.TYPE_NOTIFICATION);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, title);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        if (existingUri != null && !existingUri.isEmpty()) {
            try {
                intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(existingUri));
            } catch (Throwable ignored) {}
        }

        startActivityForResult(call, intent, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            ret.put("uri", JSObject.NULL);
            ret.put("title", JSObject.NULL);
            call.resolve(ret);
            return;
        }
        Uri uri = result.getData().getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        if (uri == null) {
            ret.put("uri", JSObject.NULL);
            ret.put("title", JSObject.NULL);
            call.resolve(ret);
            return;
        }
        String title = null;
        try {
            android.media.Ringtone r = RingtoneManager.getRingtone(getContext(), uri);
            if (r != null) title = r.getTitle(getContext());
        } catch (Throwable ignored) {}
        ret.put("uri", uri.toString());
        ret.put("title", title != null ? title : "Ringtone");
        call.resolve(ret);
    }

    @PluginMethod
    public void listSystemRingtones(PluginCall call) {
        JSArray arr = new JSArray();
        try {
            RingtoneManager rm = new RingtoneManager(getContext());
            rm.setType(RingtoneManager.TYPE_ALARM | RingtoneManager.TYPE_RINGTONE | RingtoneManager.TYPE_NOTIFICATION);
            Cursor c = rm.getCursor();
            while (c.moveToNext()) {
                String title = c.getString(RingtoneManager.TITLE_COLUMN_INDEX);
                Uri uri = rm.getRingtoneUri(c.getPosition());
                JSObject o = new JSObject();
                o.put("uri", uri != null ? uri.toString() : "");
                o.put("title", title != null ? title : "");
                arr.put(o);
            }
        } catch (Throwable t) {
            // ignore — return whatever we collected
        }
        JSObject ret = new JSObject();
        try {
            ret.put("ringtones", arr);
        } catch (Throwable ignored) {}
        call.resolve(ret);
    }
}
