package com.mylifeos.app.plugins;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.mylifeos.app.rise.scanner.BarcodeScannerActivity;

/**
 * BarcodeScannerPlugin — Capacitor bridge।
 *
 * JS থেকে call করার উপায়:
 * ─────────────────────────────────────────────
 * import { BarcodeScanner } from '@/lib/capacitor/barcodeScannerBridge';
 *
 * // যেকোনো barcode
 * const result = await BarcodeScanner.scan();
 *
 * // নির্দিষ্ট barcode match
 * const result = await BarcodeScanner.scan({ targetBarcode: 'WAKE-UP' });
 *
 * // Result:
 * { success: true,  value: 'WAKE-UP' }
 * { success: false, error: 'cancelled' }
 * ─────────────────────────────────────────────
 */
@CapacitorPlugin(name = "NativeBarcodeScanner")
public class BarcodeScannerPlugin extends Plugin {

    private static final String TAG = "BarcodeScannerPlugin";

    @PluginMethod
    public void scan(PluginCall call) {
        String  targetBarcode    = call.getString("targetBarcode", null);
        boolean acceptAnyBarcode = call.getBoolean("anyBarcode", false);

        if (targetBarcode == null || targetBarcode.isEmpty()) {
            acceptAnyBarcode = true;
        }

        Log.d(TAG, "Starting scan. target=" + targetBarcode + " any=" + acceptAnyBarcode);

        Intent intent = new Intent(getContext(), BarcodeScannerActivity.class);
        intent.putExtra(BarcodeScannerActivity.EXTRA_TARGET_BARCODE, targetBarcode);
        intent.putExtra(BarcodeScannerActivity.EXTRA_ANY_BARCODE,    acceptAnyBarcode);

        startActivityForResult(call, intent, "scanResult");
    }

    @ActivityCallback
    private void scanResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        JSObject ret = new JSObject();

        if (result.getResultCode() == BarcodeScannerActivity.RESULT_SCAN_SUCCESS) {
            Intent data = result.getData();
            String value = data != null ?
                data.getStringExtra(BarcodeScannerActivity.EXTRA_SCAN_RESULT) : "";
            ret.put("success", true);
            ret.put("value",   value != null ? value : "");
            ret.put("error",   (Object) null);
            Log.d(TAG, "✅ Scan success: " + value);
            call.resolve(ret);

        } else if (result.getResultCode() == BarcodeScannerActivity.RESULT_CANCELLED
                || result.getResultCode() == Activity.RESULT_CANCELED) {
            ret.put("success", false);
            ret.put("value",   (Object) null);
            ret.put("error",   "cancelled");
            Log.d(TAG, "Scan cancelled");
            call.resolve(ret);

        } else {
            Intent data = result.getData();
            String err = data != null ?
                data.getStringExtra(BarcodeScannerActivity.EXTRA_ERROR_MESSAGE) : "Unknown error";
            ret.put("success", false);
            ret.put("value",   (Object) null);
            ret.put("error",   err);
            Log.e(TAG, "❌ Scan failed: " + err);
            call.resolve(ret);
        }
    }
}
