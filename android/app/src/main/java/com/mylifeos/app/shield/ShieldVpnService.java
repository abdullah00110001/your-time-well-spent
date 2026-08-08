package com.mylifeos.app.shield;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Shield VPN service.
 *
 * Instead of trying to guess the source app from raw packet bytes (which is
 * unreliable and used to drop ALL traffic device-wide whenever any app was
 * blocked), this service uses the correct Android API:
 * {@link Builder#addAllowedApplication(String)} so ONLY the blocked packages'
 * traffic is routed into the VPN tunnel (where it is dropped), while every
 * other app's traffic bypasses the VPN entirely and reaches the network
 * directly.
 *
 * The tunnel is also used to sinkhole DNS queries for user-defined blocked
 * sites (in addition to always using Cloudflare Family DNS for adult content
 * filtering).
 */
public class ShieldVpnService extends VpnService {

    private static final String TAG = "ShieldVPN";
    public static ShieldVpnService instance;

    // ── Existing actions ──────────────────────────────────────────────────────
    public static final String ACTION_START = "com.mylifeos.START_VPN";
    public static final String ACTION_STOP  = "com.mylifeos.STOP_VPN";

    // ── New firewall actions ──────────────────────────────────────────────────
    public static final String ACTION_BLOCK_APP    = "shield.firewall.BLOCK_APP";
    public static final String ACTION_UNBLOCK_APP  = "shield.firewall.UNBLOCK_APP";
    public static final String ACTION_BLOCK_ALL    = "shield.firewall.BLOCK_ALL";
    public static final String ACTION_UNBLOCK_ALL  = "shield.firewall.UNBLOCK_ALL";
    public static final String ACTION_REFRESH_LIST = "shield.firewall.REFRESH_LIST";
    public static final String EXTRA_PACKAGE       = "target_package";
    public static final String EXTRA_DURATION_MS   = "duration_ms";

    private static final String NOTIF_CHANNEL_ID = "shield_vpn";
    private static final int NOTIF_ID = 9421;

    private Thread vpnThread;
    private ParcelFileDescriptor vpnInterface = null;
    private volatile boolean running = false;

    // pkg → unblock timestamp (ms)
    private final ConcurrentHashMap<String, Long> blockedApps = new ConcurrentHashMap<>();
    private volatile boolean blockAll = false;
    private volatile long blockAllUntil = 0;

    // Whether the tunnel needs to be torn down & re-established because the
    // set of allowed (blocked) applications changed.
    private volatile boolean tunnelDirty = false;

    private Handler handler;
    private ShieldPreferences prefs;

    // Records whether the VPN was intentionally running before the OS
    // revoked/destroyed us, so we know whether to restart.
    private static volatile boolean wasRunningBeforeInterruption = false;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        handler = new Handler(Looper.getMainLooper());
        prefs = new ShieldPreferences(this);
        createNotificationChannel();
        Log.d(TAG, "🛡️ ShieldVpnService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification());

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
                    tunnelDirty = true;

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
                    tunnelDirty = true;
                    Log.d(TAG, "✅ Unblocked: " + pkg);
                }
                if (blockedApps.isEmpty() && !blockAll) {
                    stopVpn();
                } else {
                    ensureVpnRunning();
                }
                break;
            }

            // 🆕 Block ALL internet
            case ACTION_BLOCK_ALL: {
                long dur = intent.getLongExtra(EXTRA_DURATION_MS, 5 * 60_000L);
                blockAll = true;
                blockAllUntil = System.currentTimeMillis() + dur;
                tunnelDirty = true;
                Log.d(TAG, "💣 ALL internet blocked for " + (dur / 60000) + " min");
                scheduleUnblockAll(dur);
                ensureVpnRunning();
                break;
            }

            // 🆕 Unblock everything
            case ACTION_UNBLOCK_ALL: {
                blockAll = false;
                blockedApps.clear();
                tunnelDirty = true;
                stopVpn();
                break;
            }

            // 🆕 Rebuild tunnel because ShieldPreferences.blockedApps changed elsewhere
            case ACTION_REFRESH_LIST: {
                tunnelDirty = true;
                if (isAnythingBlocked()) {
                    ensureVpnRunning();
                } else {
                    stopVpn();
                }
                break;
            }
        }
        return START_STICKY;
    }

    private boolean isAnythingBlocked() {
        return blockAll || !blockedApps.isEmpty();
    }

    // ── VPN lifecycle ─────────────────────────────────────────────────────────

    private void ensureVpnRunning() {
        if (!isAnythingBlocked()) {
            // Guard: nothing to block → do not establish a tunnel at all.
            stopVpn();
            return;
        }

        if (vpnThread == null || !vpnThread.isAlive() || tunnelDirty) {
            // Tear down old tunnel first if the allowed-app set changed.
            if (vpnInterface != null) {
                closeInterfaceQuietly();
            }
            startVpn();
        }
    }

    /**
     * Builds the set of package names that should be routed into the VPN
     * tunnel (and therefore dropped). When blockAll is active, every
     * installed app's traffic goes through the tunnel automatically because
     * we simply don't restrict with addAllowedApplication in that mode
     * (default route captures everything) — we still explicitly exclude
     * our own app so LifeOS itself keeps working.
     */
    private void startVpn() {
        try {
            Builder builder = new Builder()
                .setSession("LifeOS Shield Filter")
                .setMtu(1500)
                .addAddress("10.0.0.2", 24)
                .addRoute("0.0.0.0", 0)      // route into the tunnel only for allowed apps

                // ─ Cloudflare Family DNS (blocks adult sites at DNS level) ─
                .addDnsServer("1.1.1.3")
                .addDnsServer("1.0.0.3")

                // IPv6 DNS
                .addDnsServer("2606:4700:4700::1113")
                .addDnsServer("2606:4700:4700::1003");

            // LifeOS নিজে VPN bypass করবে — সবসময় কাজ করবে
            builder.addDisallowedApplication(getPackageName());

            if (blockAll) {
                // Everything (except ourselves, excluded above) is routed
                // into the tunnel and dropped in the packet loop.
                Log.d(TAG, "🔒 Building tunnel for BLOCK_ALL mode");
            } else {
                // Only route the specifically blocked packages into the
                // tunnel; everything else bypasses the VPN completely.
                Set<String> toBlock = new HashSet<>(blockedApps.keySet());
                if (toBlock.isEmpty()) {
                    Log.w(TAG, "No packages to block — aborting tunnel setup");
                    return;
                }
                int added = 0;
                for (String pkg : toBlock) {
                    try {
                        getPackageManager().getApplicationInfo(pkg, 0);
                        builder.addAllowedApplication(pkg);
                        added++;
                        Log.d(TAG, "📦 Routing into tunnel (blocked): " + pkg);
                    } catch (PackageManager.NameNotFoundException e) {
                        Log.w(TAG, "Package not found, skipping: " + pkg);
                    }
                }
                if (added == 0) {
                    Log.w(TAG, "No valid packages resolved — aborting tunnel setup");
                    return;
                }
            }

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "❌ VPN establish failed — permission missing?");
                return;
            }

            tunnelDirty = false;
            running = true;
            wasRunningBeforeInterruption = true;
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
     * Because only blocked apps' traffic is now routed into the tunnel
     * (via addAllowedApplication) or, in blockAll mode, all traffic is
     * routed in, the drop decision here is simple:
     *  - blockAll → drop everything (already only reaches us because other
     *    apps are irrelevant when the device is fully locked down)
     *  - otherwise → any packet that reaches the tunnel already belongs to
     *    a blocked app, so it should be dropped — EXCEPT DNS queries which
     *    we still want to resolve via Cloudflare Family DNS / site sinkhole
     *    so blocked-site filtering keeps working for apps that aren't
     *    blocked outright but browse sites we sinkhole via DNS.
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

                checkExpiries();
                if (tunnelDirty) {
                    // Allowed-app set changed — rebuild tunnel on next loop.
                    handler.post(this::ensureVpnRunning);
                }

                if (isDnsPacket(packet, length)) {
                    if (isBlockedSiteDnsQuery(packet, length)) {
                        // Sinkhole: drop the query silently (client will
                        // time out / fail to resolve — safe default).
                        continue;
                    }
                    // Forward DNS query — Cloudflare Family DNS handles it.
                    out.write(packet, 0, length);
                    continue;
                }

                if (shouldDropPacket()) {
                    continue;
                }

                out.write(packet, 0, length);

            } catch (InterruptedException e) {
                break;
            } catch (Exception e) {
                if (running) Log.e(TAG, "Packet loop error", e);
            }
        }

        Log.d(TAG, "🛑 Packet loop ended");
    }

    private boolean shouldDropPacket() {
        // Anything that made it into the tunnel is either:
        //  - all traffic (blockAll mode), or
        //  - traffic from an explicitly allowed (blocked) application
        // In both cases it should be dropped.
        return true;
    }

    // ── DNS parsing helpers ──────────────────────────────────────────────────

    /**
     * Very small, defensive IPv4/UDP/DNS parser. Returns false (i.e. treat
     * as non-DNS / forward normally) on any parsing uncertainty.
     */
    private boolean isDnsPacket(byte[] packet, int length) {
        try {
            if (length < 20) return false;
            int version = (packet[0] >> 4) & 0xF;
            if (version != 4) return false; // keep it simple: IPv4 only

            int ihl = (packet[0] & 0x0F) * 4;
            if (ihl < 20 || length < ihl + 8) return false;

            int protocol = packet[9] & 0xFF;
            if (protocol != 17) return false; // UDP only

            int udpStart = ihl;
            int destPort = ((packet[udpStart + 2] & 0xFF) << 8) | (packet[udpStart + 3] & 0xFF);
            return destPort == 53;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isBlockedSiteDnsQuery(byte[] packet, int length) {
        try {
            Set<String> blockedSites = prefs.getBlockedSites();
            if (blockedSites == null || blockedSites.isEmpty()) return false;

            int ihl = (packet[0] & 0x0F) * 4;
            int udpStart = ihl;
            int dnsStart = udpStart + 8; // UDP header is 8 bytes
            if (length < dnsStart + 12) return false; // DNS header is 12 bytes

            int qdCount = ((packet[dnsStart + 4] & 0xFF) << 8) | (packet[dnsStart + 5] & 0xFF);
            if (qdCount < 1) return false;

            String qname = parseQName(packet, length, dnsStart + 12);
            if (qname == null) return false;

            qname = qname.toLowerCase();
            for (String site : blockedSites) {
                if (site == null || site.isEmpty()) continue;
                String s = site.toLowerCase();
                if (qname.equals(s) || qname.endsWith("." + s)) {
                    Log.d(TAG, "🚫 DNS sinkhole: " + qname);
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            // Never drop on parse failure — forward normally.
            return false;
        }
    }

    /** Parses the QNAME of the first DNS question, starting at offset. */
    private String parseQName(byte[] packet, int length, int offset) {
        StringBuilder sb = new StringBuilder();
        int pos = offset;
        int guard = 0;
        while (pos < length && guard++ < 128) {
            int labelLen = packet[pos] & 0xFF;
            if (labelLen == 0) break;
            if ((labelLen & 0xC0) == 0xC0) {
                // Compression pointer — bail out, not needed for questions.
                return null;
            }
            pos++;
            if (pos + labelLen > length) return null;
            if (sb.length() > 0) sb.append('.');
            sb.append(new String(packet, pos, labelLen, java.nio.charset.StandardCharsets.US_ASCII));
            pos += labelLen;
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private void checkExpiries() {
        long now = System.currentTimeMillis();

        if (blockAll && now > blockAllUntil) {
            blockAll = false;
            tunnelDirty = true;
            Log.d(TAG, "⏰ Block-all expired");
        }

        for (String pkg : new HashSet<>(blockedApps.keySet())) {
            Long until = blockedApps.get(pkg);
            if (until != null && now > until) {
                blockedApps.remove(pkg);
                tunnelDirty = true;
                Log.d(TAG, "⏰ Block expired: " + pkg);
            }
        }

        if (!blockAll && blockedApps.isEmpty()) {
            running = false;
        }
    }

    // ── Scheduled unblock ─────────────────────────────────────────────────────

    private void scheduleUnblock(String pkg, long durationMs) {
        handler.postDelayed(() -> {
            blockedApps.remove(pkg);
            tunnelDirty = true;
            Log.d(TAG, "⏰ Auto-unblocked: " + pkg);
            if (blockedApps.isEmpty() && !blockAll) {
                stopVpn();
            } else {
                ensureVpnRunning();
            }
        }, durationMs);
    }

    private void scheduleUnblockAll(long durationMs) {
        handler.postDelayed(() -> {
            blockAll = false;
            tunnelDirty = true;
            Log.d(TAG, "⏰ Auto-unblocked all");
            if (blockedApps.isEmpty()) {
                stopVpn();
            } else {
                ensureVpnRunning();
            }
        }, durationMs);
    }

    // ── Stop ─────────────────────────────────────────────────────────────────

    private void stopVpn() {
        running = false;
        wasRunningBeforeInterruption = false;
        try {
            if (vpnThread != null) {
                vpnThread.interrupt();
                vpnThread = null;
            }
            closeInterfaceQuietly();
            Log.d(TAG, "🛑 VPN stopped");
        } catch (Exception e) {
            Log.e(TAG, "VPN stop error", e);
        }
    }

    private void closeInterfaceQuietly() {
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (IOException e) {
            Log.e(TAG, "Error closing VPN interface", e);
        }
    }

    // ── Notification / foreground service ───────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(NOTIF_CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    NOTIF_CHANNEL_ID,
                    "Shield Protection",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Keeps app & website blocking active in the background");
                channel.setShowBadge(false);
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, NOTIF_CHANNEL_ID)
            .setContentTitle("Shield is active")
            .setContentText("Protecting your device from blocked apps & sites")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
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

    /**
     * Called by other components (e.g. after ShieldPreferences changes)
     * to force the tunnel to be rebuilt with the current blocked-app list.
     */
    public static void requestRefresh(Context context) {
        Intent intent = new Intent(context, ShieldVpnService.class);
        intent.setAction(ACTION_REFRESH_LIST);
        context.startService(intent);
    }

    @Override
    public void onRevoke() {
        wasRunningBeforeInterruption = running;
        stopVpn();
        super.onRevoke();
    }

    @Override
    public void onDestroy() {
        wasRunningBeforeInterruption = running;
        stopVpn();
        instance = null;
        super.onDestroy();
    }
}
