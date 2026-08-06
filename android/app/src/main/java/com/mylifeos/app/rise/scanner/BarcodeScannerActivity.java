package com.mylifeos.app.rise.scanner;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * BarcodeScannerActivity
 *
 * Native camera activity using CameraX + ML Kit.
 * External library dependency নেই — Google ML Kit free।
 *
 * Flow:
 * ──────────────────────────────────────────────
 * 1. Camera permission check করে
 * 2. CameraX দিয়ে preview দেখায়
 * 3. ML Kit দিয়ে barcode scan করে
 * 4. Result Intent দিয়ে return করে
 * ──────────────────────────────────────────────
 *
 * Intent extras (input):
 *   TARGET_BARCODE → যে barcode scan করতে হবে (optional)
 *   ANY_BARCODE    → true হলে যেকোনো barcode accept করবে
 *
 * Intent extras (output):
 *   SCAN_RESULT    → scanned barcode value
 *   SCAN_SUCCESS   → true/false
 *   ERROR_MESSAGE  → error থাকলে
 */
public class BarcodeScannerActivity extends AppCompatActivity {

    private static final String TAG = "BarcodeScannerActivity";
    private static final int CAMERA_PERMISSION_REQUEST = 100;

    // Intent keys — input
    public static final String EXTRA_TARGET_BARCODE = "TARGET_BARCODE";
    public static final String EXTRA_ANY_BARCODE    = "ANY_BARCODE";

    // Intent keys — output
    public static final String EXTRA_SCAN_RESULT    = "SCAN_RESULT";
    public static final String EXTRA_SCAN_SUCCESS   = "SCAN_SUCCESS";
    public static final String EXTRA_ERROR_MESSAGE  = "ERROR_MESSAGE";

    // Result codes
    public static final int RESULT_SCAN_SUCCESS = 200;
    public static final int RESULT_SCAN_FAILED  = 201;
    public static final int RESULT_CANCELLED    = 202;

    private PreviewView       previewView;
    private ExecutorService   cameraExecutor;
    private BarcodeScanner    barcodeScanner;
    private boolean           scanComplete = false;

    private String  targetBarcode;
    private boolean acceptAnyBarcode;

    // ──────────────────────────────────────────
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen dark layout
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        previewView = new PreviewView(this);
        previewView.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        root.addView(previewView);
        setContentView(root);

        // Intent extras পড়ো
        targetBarcode    = getIntent().getStringExtra(EXTRA_TARGET_BARCODE);
        acceptAnyBarcode = getIntent().getBooleanExtra(EXTRA_ANY_BARCODE, false);

        if (targetBarcode == null || targetBarcode.isEmpty()) {
            acceptAnyBarcode = true; // target না থাকলে যেকোনো barcode accept করো
        }

        Log.d(TAG, "Target: " + targetBarcode + " | AnyBarcode: " + acceptAnyBarcode);

        cameraExecutor = Executors.newSingleThreadExecutor();

        // ML Kit scanner setup
        BarcodeScannerOptions options = new BarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_QR_CODE,
                Barcode.FORMAT_EAN_13,
                Barcode.FORMAT_EAN_8,
                Barcode.FORMAT_CODE_128,
                Barcode.FORMAT_CODE_39,
                Barcode.FORMAT_UPC_A,
                Barcode.FORMAT_UPC_E,
                Barcode.FORMAT_DATA_MATRIX,
                Barcode.FORMAT_PDF417,
                Barcode.FORMAT_AZTEC
            )
            .build();
        barcodeScanner = BarcodeScanning.getClient(options);

        // Camera permission check
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.CAMERA},
                CAMERA_PERMISSION_REQUEST
            );
        }
    }

    // ──────────────────────────────────────────
    // Camera start
    // ──────────────────────────────────────────
    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> future =
            ProcessCameraProvider.getInstance(this);

        future.addListener(() -> {
            try {
                ProcessCameraProvider provider = future.get();
                bindCamera(provider);
            } catch (ExecutionException | InterruptedException e) {
                Log.e(TAG, "Camera provider failed", e);
                returnError("Camera initialization failed: " + e.getMessage());
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void bindCamera(ProcessCameraProvider provider) {
        // Preview
        Preview preview = new Preview.Builder().build();
        preview.setSurfaceProvider(previewView.getSurfaceProvider());

        // Image analysis for barcode scanning
        ImageAnalysis imageAnalysis = new ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build();

        imageAnalysis.setAnalyzer(cameraExecutor, this::analyzeImage);

        // Back camera use করো
        CameraSelector cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA;

        try {
            provider.unbindAll();
            provider.bindToLifecycle(this, cameraSelector, preview, imageAnalysis);
            Log.d(TAG, "Camera bound successfully");
        } catch (Exception e) {
            Log.e(TAG, "Camera bind failed", e);
            returnError("Camera bind failed: " + e.getMessage());
        }
    }

    // ──────────────────────────────────────────
    // Barcode analysis
    // ──────────────────────────────────────────
    @OptIn(markerClass = ExperimentalGetImage.class)
    private void analyzeImage(ImageProxy imageProxy) {
        if (scanComplete || imageProxy.getImage() == null) {
            imageProxy.close();
            return;
        }

        InputImage image = InputImage.fromMediaImage(
            imageProxy.getImage(),
            imageProxy.getImageInfo().getRotationDegrees()
        );

        barcodeScanner.process(image)
            .addOnSuccessListener(barcodes -> {
                if (!barcodes.isEmpty() && !scanComplete) {
                    processBarcodes(barcodes);
                }
            })
            .addOnFailureListener(e -> {
                Log.w(TAG, "Barcode scan failed", e);
            })
            .addOnCompleteListener(task -> imageProxy.close());
    }

    private void processBarcodes(List<Barcode> barcodes) {
        for (Barcode barcode : barcodes) {
            String value = barcode.getRawValue();
            if (value == null || value.isEmpty()) continue;

            Log.d(TAG, "Scanned: " + value);

            // Target barcode match করো
            if (acceptAnyBarcode) {
                returnSuccess(value);
                return;
            }

            // Case-insensitive match
            if (value.trim().equalsIgnoreCase(targetBarcode.trim())) {
                returnSuccess(value);
                return;
            } else {
                Log.d(TAG, "Barcode mismatch: got=" + value + " expected=" + targetBarcode);
                // Mismatch — continue scanning, don't return error yet
            }
        }
    }

    // ──────────────────────────────────────────
    // Result return
    // ──────────────────────────────────────────
    private void returnSuccess(String scannedValue) {
        if (scanComplete) return;
        scanComplete = true;

        Log.d(TAG, "✅ Scan success: " + scannedValue);

        Intent result = new Intent();
        result.putExtra(EXTRA_SCAN_RESULT,  scannedValue);
        result.putExtra(EXTRA_SCAN_SUCCESS, true);
        setResult(RESULT_SCAN_SUCCESS, result);
        finish();
    }

    private void returnError(String message) {
        if (scanComplete) return;
        scanComplete = true;

        Log.e(TAG, "❌ Scan error: " + message);

        Intent result = new Intent();
        result.putExtra(EXTRA_SCAN_SUCCESS,  false);
        result.putExtra(EXTRA_ERROR_MESSAGE, message);
        setResult(RESULT_SCAN_FAILED, result);
        finish();
    }

    // ──────────────────────────────────────────
    // Permission result
    // ──────────────────────────────────────────
    @Override
    public void onRequestPermissionsResult(int requestCode,
                                            @NonNull String[] permissions,
                                            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startCamera();
            } else {
                returnError("Camera permission denied");
            }
        }
    }

    @Override
    public void onBackPressed() {
        scanComplete = true;
        setResult(RESULT_CANCELLED);
        super.onBackPressed();
    }

    // ──────────────────────────────────────────
    // Cleanup
    // ──────────────────────────────────────────
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (cameraExecutor != null) cameraExecutor.shutdown();
        if (barcodeScanner != null) barcodeScanner.close();
    }
}
