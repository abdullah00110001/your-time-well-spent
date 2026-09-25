package com.mylifeos.app.plugins;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * PhotoPickerPlugin — Android system photo picker (ACTION_PICK_IMAGES).
 *
 * The wallpaper picker previously went through Capacitor Camera, which asks for
 * the obsolete READ_MEDIA_IMAGES permission on Android 13+; when the user denied
 * it (or the OEM blocked it) the picker silently failed. The system photo picker
 * needs NO permission at all, so this is the primary path and Capacitor Camera
 * stays only as a fallback for older devices.
 *
 * Returns a downscaled JPEG data URL, ready to persist with the alarm record.
 */
@CapacitorPlugin(name = "PhotoPicker")
public class PhotoPickerPlugin extends Plugin {

    private static final String TAG = "PhotoPickerPlugin";
    private static final int MAX_EDGE = 1080;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", systemPickerAvailable());
        call.resolve(ret);
    }

    private boolean systemPickerAvailable() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return false;
        try {
            Intent i = new Intent(MediaStore.ACTION_PICK_IMAGES);
            i.setType("image/*");
            return i.resolveActivity(getContext().getPackageManager()) != null;
        } catch (Throwable t) {
            return false;
        }
    }

    @PluginMethod
    public void pickImage(PluginCall call) {
        try {
            Intent intent;
            if (systemPickerAvailable()) {
                intent = new Intent(MediaStore.ACTION_PICK_IMAGES);
                intent.setType("image/*");
            } else {
                // Document picker — still permission-free, unlike READ_MEDIA_IMAGES.
                intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
            }
            startActivityForResult(call, intent, "onPicked");
        } catch (Throwable t) {
            Log.e(TAG, "pickImage failed", t);
            call.reject("Could not open the photo picker");
        }
    }

    @ActivityCallback
    private void onPicked(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (call == null) return;

        if (result == null || result.getResultCode() != Activity.RESULT_OK) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (uri == null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        try {
            String dataUrl = toDataUrl(uri);
            if (dataUrl == null) { call.reject("That image could not be decoded"); return; }
            JSObject ret = new JSObject();
            ret.put("cancelled", false);
            ret.put("dataUrl", dataUrl);
            call.resolve(ret);
        } catch (Throwable t) {
            Log.e(TAG, "decode failed", t);
            call.reject("That image could not be read");
        }
    }

    private String toDataUrl(Uri uri) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(in, null, bounds);
        }
        int longest = Math.max(bounds.outWidth, bounds.outHeight);
        int sample = 1;
        while (longest / sample > MAX_EDGE) sample *= 2;

        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;

        Bitmap bmp;
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            bmp = BitmapFactory.decodeStream(in, null, opts);
        }
        if (bmp == null) return null;

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, 72, out);
        bmp.recycle();
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
}
