package com.mylifeos.app.plugins;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String TAG = "AppUpdatePlugin";
    private long downloadId = -1;
    private PluginCall savedCall = null;
    private BroadcastReceiver downloadReceiver = null;

    @PluginMethod()
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "lifeos-update.apk");

        if (url == null || url.isEmpty()) {
            call.reject("Download URL is required");
            return;
        }

        try {
            // Clean up any previous receiver
            unregisterReceiver();

            savedCall = call;

            // Delete old APK if exists
            File oldFile = new File(
                getContext().getExternalFilesDir(null),
                fileName
            );
            if (oldFile.exists()) {
                oldFile.delete();
            }

            // Set up DownloadManager
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("Life OS Update");
            request.setDescription("Downloading the latest version...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
            request.setDestinationInExternalFilesDir(getContext(), null, fileName);
            request.setMimeType("application/vnd.android.package-archive");

            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) {
                call.reject("DownloadManager not available");
                return;
            }

            downloadId = dm.enqueue(request);
            Log.d(TAG, "Download started with ID: " + downloadId);

            // Notify frontend that download started
            JSObject progressObj = new JSObject();
            progressObj.put("status", "downloading");
            progressObj.put("downloadId", downloadId);
            notifyListeners("updateProgress", progressObj);

            // Register broadcast receiver for download completion
            downloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id != downloadId) return;

                    Log.d(TAG, "Download completed for ID: " + id);

                    DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm == null) {
                        rejectSavedCall("DownloadManager unavailable after download");
                        return;
                    }

                    DownloadManager.Query query = new DownloadManager.Query();
                    query.setFilterById(downloadId);
                    Cursor cursor = dm.query(query);

                    if (cursor != null && cursor.moveToFirst()) {
                        int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                        int status = cursor.getInt(statusIndex);

                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            // Get the downloaded file path
                            int uriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                            String localUri = cursor.getString(uriIndex);
                            
                            Log.d(TAG, "APK downloaded to: " + localUri);

                            try {
                                installApk(context, fileName);

                                JSObject result = new JSObject();
                                result.put("status", "installing");
                                notifyListeners("updateProgress", result);

                                if (savedCall != null) {
                                    JSObject res = new JSObject();
                                    res.put("success", true);
                                    res.put("message", "APK download complete, installer triggered");
                                    savedCall.resolve(res);
                                    savedCall = null;
                                }
                            } catch (Exception e) {
                                Log.e(TAG, "Install error: " + e.getMessage(), e);
                                rejectSavedCall("Failed to install: " + e.getMessage());
                            }
                        } else {
                            int reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
                            int reason = cursor.getInt(reasonIndex);
                            Log.e(TAG, "Download failed with status " + status + " reason " + reason);
                            rejectSavedCall("Download failed. Status: " + status + " Reason: " + reason);
                        }
                        cursor.close();
                    } else {
                        rejectSavedCall("Could not query download status");
                    }

                    unregisterReceiver();
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(
                    downloadReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_EXPORTED
                );
            } else {
                getContext().registerReceiver(
                    downloadReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
                );
            }

        } catch (Exception e) {
            Log.e(TAG, "downloadAndInstall error: " + e.getMessage(), e);
            call.reject("Download failed: " + e.getMessage());
        }
    }

    private void installApk(Context context, String fileName) {
        File apkFile = new File(
            getContext().getExternalFilesDir(null),
            fileName
        );

        if (!apkFile.exists()) {
            throw new RuntimeException("APK file not found at: " + apkFile.getAbsolutePath());
        }

        Uri apkUri;
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            // Android 7.0+ requires FileProvider
            apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
            );
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            apkUri = Uri.fromFile(apkFile);
        }

        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        
        Log.d(TAG, "Launching installer for: " + apkUri.toString());
        context.startActivity(intent);
    }

    @PluginMethod()
    public void getDownloadProgress(PluginCall call) {
        if (downloadId == -1) {
            JSObject result = new JSObject();
            result.put("progress", -1);
            result.put("status", "idle");
            call.resolve(result);
            return;
        }

        try {
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(downloadId);
            Cursor cursor = dm.query(query);

            if (cursor != null && cursor.moveToFirst()) {
                int bytesDownloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                int bytesTotalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);

                long bytesDownloaded = cursor.getLong(bytesDownloadedIdx);
                long bytesTotal = cursor.getLong(bytesTotalIdx);
                int status = cursor.getInt(statusIdx);

                int progress = bytesTotal > 0 ? (int) ((bytesDownloaded * 100) / bytesTotal) : 0;

                JSObject result = new JSObject();
                result.put("progress", progress);
                result.put("bytesDownloaded", bytesDownloaded);
                result.put("bytesTotal", bytesTotal);
                result.put("status", statusToString(status));
                call.resolve(result);

                cursor.close();
            } else {
                JSObject result = new JSObject();
                result.put("progress", -1);
                result.put("status", "unknown");
                call.resolve(result);
            }
        } catch (Exception e) {
            call.reject("Failed to get progress: " + e.getMessage());
        }
    }

    private String statusToString(int status) {
        switch (status) {
            case DownloadManager.STATUS_PENDING: return "pending";
            case DownloadManager.STATUS_RUNNING: return "downloading";
            case DownloadManager.STATUS_PAUSED: return "paused";
            case DownloadManager.STATUS_SUCCESSFUL: return "completed";
            case DownloadManager.STATUS_FAILED: return "failed";
            default: return "unknown";
        }
    }

    private void rejectSavedCall(String message) {
        if (savedCall != null) {
            savedCall.reject(message);
            savedCall = null;
        }
        JSObject errorObj = new JSObject();
        errorObj.put("status", "error");
        errorObj.put("message", message);
        notifyListeners("updateProgress", errorObj);
    }

    private void unregisterReceiver() {
        if (downloadReceiver != null) {
            try {
                getContext().unregisterReceiver(downloadReceiver);
            } catch (Exception ignored) {}
            downloadReceiver = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        unregisterReceiver();
        super.handleOnDestroy();
    }
}
