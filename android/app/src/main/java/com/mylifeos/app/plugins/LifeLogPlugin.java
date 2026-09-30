package com.mylifeos.app.plugins;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.mylifeos.app.LifeLog;

import java.io.File;

@CapacitorPlugin(name = "LifeLog")
public class LifeLogPlugin extends Plugin {

    @Override
    public void load() { LifeLog.init(getContext()); }

    @PluginMethod
    public void write(PluginCall call) {
        LifeLog.write(call.getString("level", "INFO"), call.getString("source", "JS"), call.getString("message", ""), null);
        call.resolve();
    }

    @PluginMethod
    public void read(PluginCall call) {
        JSObject r = new JSObject();
        r.put("text", LifeLog.readToday(call.getInt("maxChars", 400_000)));
        File f = LifeLog.todayFile();
        r.put("path", f == null ? "" : f.getAbsolutePath());
        call.resolve(r);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        File d = LifeLog.dir();
        File[] fs = d == null ? null : d.listFiles();
        if (fs != null) for (File f : fs) f.delete();
        call.resolve();
    }

    @PluginMethod
    public void share(PluginCall call) {
        try {
            File f = LifeLog.todayFile();
            if (f == null || !f.exists()) { call.reject("No log file yet"); return; }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Share log");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Throwable t) {
            call.reject(t.getMessage());
        }
    }
}
