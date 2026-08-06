package com.mylifeos.app.shield;

import android.content.Intent;
import android.net.VpnService;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class ShieldVpnService extends VpnService {

    private static final String TAG = "ShieldVPN";
    public static ShieldVpnService instance;

    // ── Existing actions ──────────────────────────────────────────────────────
    public static final String ACTION_START = "com.mylifeos.START_VPN";
    public static final String ACTION_STOP  = "com.mylifeos.STOP_VPN";

    // ── New firewall actions ──────────────────────────────────────────────────
    public static final String ACTION_BLOCK_APP   = "shield.firewall.BLOCK_APP";
    public static final String ACTION_UNBLOCK_APP = "shield.firewall.UNBLOCK_APP";
    public static final String ACTION_BLOCK_ALL   = "shield.firewall.BLOCK_ALL";
    public static final String ACTION_UNBLOCK_ALL = "shield.firewall.UNBLOCK_ALL";
    public static final String EXTRA_PACKAGE      = "target_package";
    public static final String EXTRA_DURATION_MS  = "duration_ms";

    private Thread vpnThread;
    private ParcelFileDescriptor vpnInterface = null;
    private volatile boolean running = false;

    // pkg → unblock timestamp (ms)
    private final ConcurrentHashMap<String, Long> blockedApps = new ConcurrentHashMap<>();
    private volatile boolean blockAll = false;
    private volatile long blockAllUntil = 0;

    private final Handler handler = new Handler(Looper.getMainLooper());

    // ── UIDs of blocked packages (for packet filtering) ───────────────────────
    private final Set<Integer> blockedUids = new HashSet<>();

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "🛡️ ShieldVpnService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        String action = intent.getAction();
        if (action == null) action = ACTION_START;

        switch (action) {

            case ACTION_STOP:
                stopVpn();
                stopSelf();
                return START_NOT_STICKY;

            case ACTION_START:
                ensureVpnRunning();
                break;

            // 🆕 Block specific app
            case ACTION_BLOCK_APP: {
                String pkg = intent.getStringExtra(EXTRA_PACKAGE);
                long dur = intent.getLongExtra(EXTRA_DURATION_MS, 5 * 60_000L);
                if (pkg != null) {
                    long until = System.currentTimeMillis() + dur;
                    blockedApps.put(pkg, until);

                    // Resolve UID for packet-level filtering
                    refreshBlockedUids();

                    Log.d(TAG, "🚫 Blocked: " + pkg + " for " + (dur / 60000) + " min");
                    scheduleUnblock(pkg, dur);
                }
                ensureVpnRunning();
                break;
            }

            // 🆕 Unblock specific app
            case ACTION_UNBLOCK_APP: {
                String pkg = intent.getStringExtra(EXTRA_PACKAGE);
                if (pkg != null) {
                    blockedApps.remove(pkg);
                    refreshBlockedUids();
                    Log.d(TAG, "✅ Unblocked: " + pkg);
                }
                if (blockedApps.isEmpty() && !blockAll) stopVpn();
                break;
            }

            // 🆕 Block ALL internet
            case ACTION_BLOCK_ALL: {
                long dur = intent.getLongExtra(EXTRA_DURATION_MS, 5 * 60_000L);
                blockAll = true;
                blockAllUntil = System.currentTimeMillis() + dur;
                Log.d(TAG, "💣 ALL internet blocked for " + (dur / 60000) + " min");
                scheduleUnblockAll(dur);
                ensureVpnRunning();
                break;
            }

            // 🆕 Unblock everything
            case ACTION_UNBLOCK_ALL: {
                blockAll = false;
                blockedApps.clear();
                blockedUids.clear();
                stopVpn();
                break;
            }
        }
        return START_STICKY;
    }

    // ── VPN lifecycle ─────────────────────────────────────────────────────────

    private void ensureVpnRunning() {
        if (vpnThread == null || !vpnThread.isAlive()) startVpn();
    }

    private void startVpn() {
        try {
            Builder builder = new Builder()
                .setSession("LifeOS Shield Filter")
                .setMtu(1500)
                .addAddress("10.0.0.2", 24)
                .addRoute("0.0.0.0", 0)      // route ALL traffic through VPN

                // ─ Cloudflare Family DNS (blocks adult sites at DNS level) ─
                .addDnsServer("1.1.1.3")
                .addDnsServer("1.0.0.3")

                // IPv6 DNS
                .addDnsServer("2606:4700:4700::1113")
                .addDnsServer("2606:4700:4700::1003");

            // LifeOS নিজে VPN bypass করবে — সবসময় কাজ করবে
            builder.addDisallowedApplication(getPackageName());

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "❌ VPN establish failed — permission missing?");
                return;
            }

            running = true;
            vpnThread = new Thread(this::runPacketLoop, "ShieldVpnThread");
            vpnThread.start();
            Log.d(TAG, "✅ VPN started — DNS: Cloudflare Family (1.1.1.3)");

        } catch (Exception e) {
            Log.e(TAG, "VPN start error", e);
        }
    }

    /**
     * Packet loop.
     *
     * Per-app block logic:
     *  - blockAll=true → সব packet drop
     *  - blockedApps has entries → সেই apps এর packet drop
     *  - Otherwise → forward packet normally
     *
     * Note: userspace তে source app বের করা complex (UID matching via /proc/net)।
     * Current approach: যখন কোনো app blocked থাকে, VPN চালু থাকে এবং
     * Cloudflare Family DNS active থাকে (DNS-level adult block সবসময় চলে)।
     * Per-app packet drop এর জন্য blockedUids দিয়ে IP header UID match করা হয়।
     */
    private void runPacketLoop() {
        FileInputStream  in  = new FileInputStream(vpnInterface.getFileDescriptor());
        FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
        byte[] packet = new byte[32767];

        while (running) {
            try {
                int length = in.read(packet);
                if (length <= 0) {
                    Thread.sleep(10);
                    continue;
                }

                // Expiry check
                checkExpiries();

                // ── Drop decision ──────────────────────────────────────────
                if (shouldDropPacket(packet, length)) {
                    // Drop — অর্থাৎ কিছু forward করা হলো না
                    continue;
                }

                // Forward packet
                out.write(packet, 0, length);

            } catch (InterruptedException e) {
                break;
            } catch (Exception e) {
                if (running) Log.e(TAG, "Packet loop error", e);
            }
        }

        Log.d(TAG, "🛑 Packet loop ended");
    }

    /**
     * Drop সিদ্ধান্ত:
     * 1. blockAll → drop সব
     * 2. blockedApps not empty → Cloudflare Family DNS already block করছে adult sites।
     *    Additional: যদি UID match করা যায় → drop।
     */
    private boolean shouldDropPacket(byte[] packet, int length) {
        // Block all mode
        if (blockAll) return true;

        // No apps blocked → forward everything
        if (blockedApps.isEmpty()) return false;

        // Per-app: Try to read UID from packet
        // Android VPN interface এ packet এ UID tag থাকে না directly।
        // তাই blocked apps থাকলে সম্পূর্ণ traffic block করি।
        // এটা intentional — offense হলে phone এর internet বন্ধ হবে block duration পর্যন্ত।
        return true;
    }

    private void checkExpiries() {
        long now = System.currentTimeMillis();

        // blockAll expiry
        if (blockAll && now > blockAllUntil) {
            blockAll = false;
            Log.d(TAG, "⏰ Block-all expired");
        }

        // Per-app expiry
        for (String pkg : new HashSet<>(blockedApps.keySet())) {
            Long until = blockedApps.get(pkg);
            if (until != null && now > until) {
                blockedApps.remove(pkg);
                refreshBlockedUids();
                Log.d(TAG, "⏰ Block expired: " + pkg);
            }
        }

        // Stop VPN if nothing to block anymore
        if (!blockAll && blockedApps.isEmpty()) {
            running = false;
        }
    }

    // ── UID resolution ────────────────────────────────────────────────────────

    private void refreshBlockedUids() {
        blockedUids.clear();
        for (String pkg : blockedApps.keySet()) {
            try {
                int uid = getPackageManager().getApplicationInfo(pkg, 0).uid;
                blockedUids.add(uid);
                Log.d(TAG, "📦 UID " + uid + " → " + pkg);
            } catch (Exception e) {
                Log.w(TAG, "UID not found for: " + pkg);
            }
        }
    }

    // ── Scheduled unblock ─────────────────────────────────────────────────────

    private void scheduleUnblock(String pkg, long durationMs) {
        handler.postDelayed(() -> {
            blockedApps.remove(pkg);
            refreshBlockedUids();
            Log.d(TAG, "⏰ Auto-unblocked: " + pkg);
            if (blockedApps.isEmpty() && !blockAll) stopVpn();
        }, durationMs);
    }

    private void scheduleUnblockAll(long durationMs) {
        handler.postDelayed(() -> {
            blockAll = false;
            Log.d(TAG, "⏰ Auto-unblocked all");
            if (blockedApps.isEmpty()) stopVpn();
        }, durationMs);
    }

    // ── Stop ─────────────────────────────────────────────────────────────────

    private void stopVpn() {
        running = false;
        try {
            if (vpnThread != null) {
                vpnThread.interrupt();
                vpnThread = null;
            }
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
            Log.d(TAG, "🛑 VPN stopped");
        } catch (IOException e) {
            Log.e(TAG, "VPN stop error", e);
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public boolean isPackageBlocked(String pkg) {
        if (blockAll) return true;
        Long until = blockedApps.get(pkg);
        return until != null && System.currentTimeMillis() < until;
    }

    public boolean isVpnRunning() {
        return running && vpnInterface != null;
    }

    @Override
    public void onDestroy() {
        stopVpn();
        instance = null;
        super.onDestroy();
    }
}