package com.mylifeos.app.shield;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Log;
import android.widget.Toast;
import android.os.Handler;
import android.os.Looper;
import android.os.Bundle;

import com.mylifeos.app.shield.core.BlockLoopGuard;
import com.mylifeos.app.shield.core.ContentMatcher;

import java.util.Set;
import java.util.List;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.HashSet;

public class ShieldAccessibilityService extends AccessibilityService {

    private static final String TAG = "ShieldAccessibility";

    private ShieldPreferences preferences;
    private ShieldEscalationManager escalationManager;
    private ShieldAppFirewall firewall;
    private BlockLoopGuard loopGuard;
    private ShieldTimerManager timerManager;


    private String lastBlockedPackage = "";
    private String lastBlockedUrl = "";
    private long lastScanTime = 0;

    private static final long SCAN_COOLDOWN_MS = 1500;

    private Set<String> adultKeywordsSet = new HashSet<>();
    private Set<String> adultSitesList   = new HashSet<>();
    private Set<String> monitoredApps    = new HashSet<>();

    // Dynamically-resolved set of packages that can handle http:// links, refreshed on
    // package-added broadcasts. The hardcoded list below is kept ONLY as a union fallback
    // for the (rare) case resolution fails on a locked-down device.
    private final Set<String> resolvedBrowserPackages = new HashSet<>();
    private BroadcastReceiver packageAddedReceiver;

    private static final String[] ADULT_DOMAIN_PATTERNS = new String[]{
        "porn", "xxx", "sex", "nude", "naked", "hentai", "erotic",
        "adult", "nsfw", "cam4", "onlyfans", "chaturbate", "stripchat",
        "xvideo", "xhamster", "redtube", "youporn", "tube8", "spankbang",
        "brazzers", "bangbros", "livejasmin", "camgirl", "webcamgirl",
        "freecam", "dirtygirl", "slutload", "slutroulette", "faphouse",
        "cumlouder", "beeg", "xnxx", "fuq", "tnaflix", "4tube",
        "youjizz", "mofos", "teamskeet", "realitykings", "naughtyamerica"
    };

    // Fallback-only hardcoded browser list (union with dynamically resolved packages).
    private static final String[] BROWSER_PACKAGES_FALLBACK = new String[]{
        "com.android.chrome", "com.chrome.beta", "com.chrome.dev",
        "org.mozilla.firefox", "com.brave.browser", "com.opera.browser",
        "com.microsoft.emmx", "com.sec.android.app.sbrowser",
        "com.duckduckgo.mobile.android"
    };

    // Apps (beyond browsers) whose in-app content/typing should be scanned for adult content.
    private static final String[] CONTENT_SCAN_PACKAGES = new String[]{
        "com.google.android.youtube",
        "com.facebook.katana", "com.instagram.android",
        "com.zhiliaoapp.musically", "com.ss.android.ugc.trill",
        "org.telegram.messenger", "com.twitter.android",
        "com.reddit.frontpage",
    };

    // Known in-app-webview hosts: apps that embed a WebView and can render arbitrary URLs.
    private static final String[] IN_APP_WEBVIEW_PACKAGES = new String[]{
        "com.facebook.katana", "com.instagram.android", "org.telegram.messenger",
        "com.twitter.android", "com.reddit.frontpage", "com.zhiliaoapp.musically",
    };

    // ==========================================
    // Lifecycle
    // ==========================================

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        preferences      = new ShieldPreferences(this);
        escalationManager = new ShieldEscalationManager(this);
        firewall         = new ShieldAppFirewall(this);
        loopGuard        = new BlockLoopGuard(this);
        timerManager     = new ShieldTimerManager(this);

        loadAdultKeywordsFromAssets();
        loadAdultSitesFromAssets();
        loadMonitoredApps();
        refreshResolvedBrowserPackages();
        registerPackageAddedReceiver();
        Log.d(TAG, "🛡️ Shield Connected — keywords: " + adultKeywordsSet.size()
            + ", sites: " + adultSitesList.size()
            + ", browsers: " + getAllBrowserPackages().size());
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            if (packageAddedReceiver != null) unregisterReceiver(packageAddedReceiver);
        } catch (Throwable ignored) {}
    }

    private void registerPackageAddedReceiver() {
        packageAddedReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                refreshResolvedBrowserPackages();
                loopGuard.refreshLauncherPackage();
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_PACKAGE_ADDED);
        filter.addDataScheme("package");
        registerReceiver(packageAddedReceiver, filter);
    }

    /** Queries PackageManager for every activity that can handle an http:// VIEW intent. */
    private void refreshResolvedBrowserPackages() {
        try {
            resolvedBrowserPackages.clear();
            PackageManager pm = getPackageManager();
            Intent viewIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("http://example.com"));
            List<ResolveInfo> resolveInfos = pm.queryIntentActivities(viewIntent, PackageManager.MATCH_ALL);
            if (resolveInfos != null) {
                for (ResolveInfo info : resolveInfos) {
                    if (info.activityInfo != null && info.activityInfo.packageName != null) {
                        resolvedBrowserPackages.add(info.activityInfo.packageName);
                    }
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to resolve browser packages", t);
        }
    }

    private Set<String> getAllBrowserPackages() {
        Set<String> all = new HashSet<>(resolvedBrowserPackages);
        for (String b : BROWSER_PACKAGES_FALLBACK) all.add(b);
        return all;
    }

    private void loadMonitoredApps() {
        monitoredApps.clear();
        Set<String> saved = preferences.getMonitoredApps();
        if (saved != null) monitoredApps.addAll(saved);
        monitoredApps.addAll(getAllBrowserPackages());
        for (String p : CONTENT_SCAN_PACKAGES) monitoredApps.add(p);
        Log.d(TAG, "📱 Monitored apps: " + monitoredApps.size());
    }

    private void loadAdultKeywordsFromAssets() {
        try {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(getAssets().open("adult_keywords.txt")));
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim().toLowerCase();
                if (!trimmed.isEmpty()) adultKeywordsSet.add(trimmed);
            }
            reader.close();
        } catch (IOException e) {
            Log.e(TAG, "Error loading adult keywords", e);
        }
    }

    private void loadAdultSitesFromAssets() {
        try {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(getAssets().open("adult_sites_lists.txt")));
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = ContentMatcher.cleanHost(line.trim());
                if (!trimmed.isEmpty() && !line.trim().startsWith("#")) adultSitesList.add(trimmed);
            }
            reader.close();
            Log.d(TAG, "✅ Adult sites loaded: " + adultSitesList.size());
        } catch (IOException e) {
            Log.e(TAG, "Error loading adult sites", e);
        }
    }

    // ==========================================
    // Main Event Handler
    // ==========================================

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString();

        // Never act on our own app or the block screens (breaks self-triggering loops).
        if (packageName.equals(getPackageName())
            || packageName.contains("ShieldBlock")
            || packageName.contains("NightToRise")) return;

        int type = event.getEventType();

        // Night to Rise
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            try {
                com.mylifeos.app.nighttorise.NightToRiseManager n2r =
                    new com.mylifeos.app.nighttorise.NightToRiseManager(this);
                com.mylifeos.app.nighttorise.NightToRiseManager.Decision d =
                    n2r.decide(System.currentTimeMillis(), packageName);
                if (d.shouldBlock) {
                    Intent i = new Intent(this,
                        com.mylifeos.app.nighttorise.NightToRiseBlockActivity.class);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    i.putExtra(com.mylifeos.app.nighttorise.NightToRiseBlockActivity.EXTRA_MESSAGE, d.message);
                    i.putExtra(com.mylifeos.app.nighttorise.NightToRiseBlockActivity.EXTRA_END_MS, d.endTimeMs);
                    i.putExtra(com.mylifeos.app.nighttorise.NightToRiseBlockActivity.EXTRA_STRICT, n2r.prefs().strictMode());
                    startActivity(i);
                    return;
                }
                // Lock window is over — drop any pending strict-unlock request.
                if (n2r.prefs().strictUnlockRequestedAt() > 0
                    && d.phase != com.mylifeos.app.nighttorise.NightToRiseManager.Phase.SLEEP_LOCK
                    && d.phase != com.mylifeos.app.nighttorise.NightToRiseManager.Phase.RISE_LOCK) {
                    n2r.prefs().clearStrictUnlockRequest();
                }
            } catch (Throwable t) { Log.w(TAG, "NightToRise check failed", t); }
        }

        // PureShield foreground signal
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            try {
                com.mylifeos.app.shield.vision.PureShieldService svc =
                    com.mylifeos.app.shield.vision.PureShieldService.instance;
                if (svc != null && svc.isPureShieldRunning()) {
                    Intent pureShieldIntent = new Intent(this,
                        com.mylifeos.app.shield.vision.PureShieldService.class);
                    pureShieldIntent.setAction(
                        com.mylifeos.app.shield.vision.PureShieldService.Actions.FOREGROUND_APP_CHANGED);
                    pureShieldIntent.putExtra(
                        com.mylifeos.app.shield.vision.PureShieldService.Actions.EXTRA_PACKAGE, packageName);
                    startService(pureShieldIntent);
                }
            } catch (Throwable ignored) {}
        }

        if (preferences == null) return;

        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && monitoredApps.isEmpty()) {
            loadMonitoredApps();
        }

        // ==========================================
        // Feature 1: Escalation + App Block
        // ==========================================
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (escalationManager.isAppBlocked(packageName)) {
                long remaining = escalationManager.getRemainingMs(packageName);
                showEscalationBlockScreen(packageName, remaining);
                return;
            }

            Set<String> blockedApps = preferences.getBlockedApps();
            if (blockedApps != null && blockedApps.contains(packageName)) {
                if (!packageName.equals(lastBlockedPackage)) {
                    lastBlockedPackage = packageName;
                    preferences.incrementBlockedAttempts();
                    showBlockScreen(packageName, false);
                }
                return;
            } else {
                lastBlockedPackage = "";
            }

            // ==========================================
            // Feature 1b: Daily time limits (real enforcement)
            // Throttled + block-rate limited inside ShieldTimerManager, so a user
            // reopening a limited app can never be trapped in a relaunch loop.
            // ==========================================
            try {
                if (timerManager != null && timerManager.enforce(packageName)) return;
            } catch (Throwable t) {
                Log.w(TAG, "Daily limit enforcement failed", t);
            }
        }


        // ==========================================
        // Feature 2: Hardcore Protection
        // ==========================================
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && isSystemUI(packageName)) {
            if (preferences.isBlockRecentAppsEnabled() &&
                (packageName.contains("recents") || packageName.contains("launcher"))) {
                triggerHomeAction("Recent Apps Blocked!");
                return;
            }
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) {
                if (preferences.isBlockSplitScreenEnabled() &&
                    scanForTextFast(root, "Split screen", 0)) {
                    triggerBackAction("Split Screen Blocked!");
                    return;
                }
                if (preferences.isBlockPowerOffEnabled() &&
                    (scanForTextFast(root, "Power off", 0) ||
                     scanForTextFast(root, "Restart", 0))) {
                    triggerBackAction("Power Menu Blocked!");
                    return;
                }
            }
        }

        // ==========================================
        // Feature 3: URL Blocking
        // ==========================================
        if (isBrowser(packageName) &&
            (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
             type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
             type == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED ||
             type == AccessibilityEvent.TYPE_VIEW_SCROLLED)) {
            String url = extractUrlFromBrowser(packageName, getRootInActiveWindow());
            if (url != null && !url.isEmpty() && !url.equals(lastBlockedUrl)) {
                // PHASE 2 — Night to Rise site/keyword blocking inside lock windows.
                if (checkNightToRiseUrl(url)) return;
                checkAndBlockUrl(url, packageName);
            }
        }

        // ==========================================
        // Feature 4: Content Scan (screen text) — scoped to browsers + monitored apps only.
        // ==========================================
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            long now = System.currentTimeMillis();
            if (now - lastScanTime < SCAN_COOLDOWN_MS) return;
            if (!isContentScanTarget(packageName)) return;

            lastScanTime = now;
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            if (rootNode != null) {
                String host = isBrowser(packageName) ? extractDomain(lastBlockedUrl) : null;
                if (scanForAdultContent(rootNode, 0, host)) {
                    triggerAdultBlock("Adult Screen Content", packageName);
                    return;
                }
                if (preferences.isReelsBlockEnabled() &&
                    isSocialMediaApp(packageName) &&
                    scanForReelsFast(rootNode, 0)) {
                    triggerBackActionWithToast("Shorts / Reels Blocked 🚫");
                    return;
                }
            }
        }

        // ==========================================
        // Feature 5: Keyword Typing Block — scoped to monitored apps, never on passwords.
        // ==========================================
        if (type == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
            if (!isContentScanTarget(packageName)) return;

            AccessibilityNodeInfo source = event.getSource();
            if (source != null) {
                try {
                    if (source.isPassword()) return;
                } finally {
                    source.recycle();
                }
            }

            CharSequence text = event.getText() != null && !event.getText().isEmpty()
                ? event.getText().get(0) : null;
            if (text != null && text.length() > 0) {
                String typed = text.toString();

                if (ContentMatcher.matchesKeyword(typed, adultKeywordsSet)) {
                    clearFocusedInput(packageName);
                    triggerAdultBlock("Typed Adult Keyword", packageName);
                    return;
                }

                Set<String> blockedKeywords = preferences.getBlockedKeywords();
                if (blockedKeywords != null) {
                    Set<String> hit = ContentMatcher.findKeywordHits(typed, blockedKeywords);
                    if (!hit.isEmpty()) {
                        preferences.incrementBlockedAttempts();
                        clearFocusedInput(packageName);
                        triggerAdultBlock("Custom Keyword: " + hit.iterator().next(), packageName);
                        return;
                    }
                }
            }
        }
    }


    // ==========================================
    // PHASE 2: Night to Rise — site / keyword blocking inside lock windows
    // ==========================================
    private boolean checkNightToRiseUrl(String url) {
        try {
            com.mylifeos.app.nighttorise.NightToRiseManager n2r =
                new com.mylifeos.app.nighttorise.NightToRiseManager(this);
            com.mylifeos.app.nighttorise.NightToRiseManager.Decision d =
                n2r.decide(System.currentTimeMillis(), null);
            if (d.phase != com.mylifeos.app.nighttorise.NightToRiseManager.Phase.SLEEP_LOCK
                && d.phase != com.mylifeos.app.nighttorise.NightToRiseManager.Phase.RISE_LOCK) return false;

            String host = extractDomain(url);
            boolean hit = ContentMatcher.matchesDomain(host, n2r.prefs().blockedSites());
            if (!hit) {
                hit = ContentMatcher.matchesKeyword(url, n2r.prefs().blockedKeywords());
            }
            if (!hit) return false;

            lastBlockedUrl = url;
            Intent i = new Intent(this, com.mylifeos.app.nighttorise.NightToRiseBlockActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            i.putExtra(com.mylifeos.app.nighttorise.NightToRiseBlockActivity.EXTRA_MESSAGE, d.message);
            i.putExtra(com.mylifeos.app.nighttorise.NightToRiseBlockActivity.EXTRA_END_MS, d.endTimeMs);
            i.putExtra(com.mylifeos.app.nighttorise.NightToRiseBlockActivity.EXTRA_STRICT, n2r.prefs().strictMode());
            startActivity(i);
            resetLastBlockedUrl();
            return true;
        } catch (Throwable t) {
            Log.w(TAG, "NightToRise url check failed", t);
            return false;
        }
    }

    // ==========================================
    // URL Block
    // ==========================================
    private void checkAndBlockUrl(String url, String packageName) {
        String host = extractDomain(url);

        if (ContentMatcher.matchesDomain(host, java.util.Arrays.asList(ADULT_DOMAIN_PATTERNS))
            || hasAdultDomainSubstringPattern(host)) {
            lastBlockedUrl = url;
            doubleBack();
            triggerAdultBlock("Adult Domain Pattern: " + host, packageName);
            resetLastBlockedUrl();
            return;
        }
        if (ContentMatcher.matchesDomain(host, adultSitesList)) {
            lastBlockedUrl = url;
            doubleBack();
            triggerAdultBlock("Adult Site List: " + host, packageName);
            resetLastBlockedUrl();
            return;
        }
        if (ContentMatcher.shouldBlockByKeyword(url, adultKeywordsSet, host, currentSensitivity())) {
            lastBlockedUrl = url;
            doubleBack();
            triggerAdultBlock("Adult Keyword in URL", packageName);
            resetLastBlockedUrl();
            return;
        }
        String lowerUrl = url.toLowerCase();
        if (preferences.isReelsBlockEnabled() &&
            (lowerUrl.contains("/shorts") || lowerUrl.contains("/reels") ||
             lowerUrl.contains("youtube.com/shorts"))) {
            lastBlockedUrl = url;
            triggerBackActionWithToast("Shorts / Reels Blocked 🚫");
            resetLastBlockedUrl();
            return;
        }
        Set<String> blockedSites = preferences.getBlockedSites();
        if (blockedSites != null && ContentMatcher.matchesDomain(host, blockedSites)) {
            lastBlockedUrl = url;
            preferences.incrementBlockedAttempts();
            triggerBackActionWithToast("Site Blocked 🛡️");
            resetLastBlockedUrl();
            return;
        }
    }

    /**
     * ADULT_DOMAIN_PATTERNS are short generic tokens ("porn", "sex", ...). A plain
     * matchesDomain() suffix check on a full host is too strict for these (they are not
     * whole hostnames themselves), so we specifically look for the pattern as a full
     * dot-delimited label of the host — never a raw substring of the whole host string.
     */
    private boolean hasAdultDomainSubstringPattern(String host) {
        if (host == null || host.isEmpty()) return false;
        String[] labels = host.split("\\.");
        for (String label : labels) {
            for (String pattern : ADULT_DOMAIN_PATTERNS) {
                if (label.equals(pattern) || label.contains(pattern)) return true;
            }
        }
        return false;
    }

    private ContentMatcher.Sensitivity currentSensitivity() {
        return preferences.isStrictMode()
            ? ContentMatcher.Sensitivity.STRICT
            : ContentMatcher.Sensitivity.BALANCED;
    }

    // ==========================================
    // Adult Block — soft-first escalation
    // ==========================================
    private void triggerAdultBlock(String reason, String packageName) {
        boolean strict = preferences.isStrictMode();

        boolean hard = strict
            ? loopGuard.shouldForceHardBlock(packageName)
            : loopGuard.shouldHardBlock(packageName);

        if (hard) {
            Log.d(TAG, "🔞 HARD BLOCK | " + reason + " | pkg: " + packageName);
            loopGuard.registerTrigger(packageName);
            preferences.incrementBlockedAttempts();
            performGlobalAction(GLOBAL_ACTION_BACK);

            if (packageName != null && !packageName.isEmpty()) {
                escalationManager.registerOffense(packageName);
                long blockDurationMs = escalationManager.getRemainingMs(packageName);
                firewall.blockApp(packageName, blockDurationMs);
            }

            new Handler(Looper.getMainLooper()).postDelayed(
                () -> showBlockScreen(packageName, true), 150);
            return;
        }

        if (loopGuard.shouldSoftBlock(packageName)) {
            Log.d(TAG, "🟡 SOFT BLOCK | " + reason + " | pkg: " + packageName);
            loopGuard.registerTrigger(packageName);
            preferences.incrementBlockedAttempts();
            performGlobalAction(GLOBAL_ACTION_BACK);
            new Handler(Looper.getMainLooper()).postDelayed(() ->
                Toast.makeText(getApplicationContext(), "Blocked content avoided", Toast.LENGTH_SHORT).show(), 150);
            return;
        }

        // Neither soft nor hard is allowed right now (cooldown/backoff active) — do nothing,
        // this is intentional: it breaks accidental infinite back-loops.
        Log.d(TAG, "⏸️ Trigger suppressed by BlockLoopGuard | " + reason + " | pkg: " + packageName);
    }

    private void triggerAdultBlock(String reason) {
        triggerAdultBlock(reason, null);
    }

    // ==========================================
    // Block Screens
    // ==========================================
    private void showBlockScreen(String packageName, boolean isAdultBlock) {
        Intent intent = new Intent(this, ShieldBlockActivity.class);
        if (packageName != null) intent.putExtra("BLOCKED_PACKAGE", packageName);
        intent.putExtra("IS_ADULT_BLOCK", isAdultBlock);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS |
            Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
    }

    private void showEscalationBlockScreen(String packageName, long remainingMs) {
        if (!loopGuard.shouldForceHardBlock(packageName)) return;
        loopGuard.registerTrigger(packageName);
        performGlobalAction(GLOBAL_ACTION_BACK);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Intent intent = new Intent(this, ShieldBlockActivity.class);
            intent.putExtra("BLOCKED_PACKAGE", packageName);
            intent.putExtra("IS_ADULT_BLOCK", true);
            intent.putExtra("ESCALATION_REMAINING_MS", remainingMs);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS |
                Intent.FLAG_ACTIVITY_NO_ANIMATION);
            startActivity(intent);
        }, 150);
    }

    // ==========================================
    // Detection Helpers
    // ==========================================

    /** Scoped to browsers + explicitly monitored apps only — never a global "scan everything". */
    private boolean isContentScanTarget(String pkg) {
        if (pkg == null) return false;
        if (pkg.equals(getPackageName()) || pkg.contains("ShieldBlock") || pkg.contains("NightToRise")) {
            return false;
        }
        return isBrowser(pkg) || monitoredApps.contains(pkg);
    }

    private String extractDomain(String url) {
        return ContentMatcher.cleanHost(url);
    }

    private void clearFocusedInput(String packageName) {
        // Never manipulate input outside a monitored app — avoids side effects in random apps.
        if (!isContentScanTarget(packageName)) return;
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;
            AccessibilityNodeInfo input = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (input != null) {
                if (input.isPassword()) return;
                Bundle args = new Bundle();
                args.putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                boolean cleared = input.performAction(
                    AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                if (!cleared) {
                    input.performAction(AccessibilityNodeInfo.ACTION_SELECT);
                    performGlobalAction(GLOBAL_ACTION_BACK);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "clearFocusedInput failed", e);
        }
    }

    private void doubleBack() {
        performGlobalAction(GLOBAL_ACTION_BACK);
        new Handler(Looper.getMainLooper()).postDelayed(
            () -> performGlobalAction(GLOBAL_ACTION_BACK), 300);
    }

    private void resetLastBlockedUrl() {
        new Handler(Looper.getMainLooper()).postDelayed(() -> lastBlockedUrl = "", 2000);
    }

    private boolean scanForAdultContent(AccessibilityNodeInfo node, int depth, String host) {
        if (node == null || depth > 10) return false;
        if (node.isPassword()) return false;
        CharSequence text = node.getText();
        if (text != null && ContentMatcher.shouldBlockByKeyword(
                text.toString(), adultKeywordsSet, host, currentSensitivity())) {
            return true;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            if (scanForAdultContent(node.getChild(i), depth + 1, host)) return true;
        }
        return false;
    }

    private String extractUrlFromBrowser(String pkg, AccessibilityNodeInfo root) {
        if (root == null) return null;
        String[] urlBarIds = new String[]{
            pkg + ":id/url_bar",
            pkg + ":id/mozac_browser_toolbar_url_view",
            pkg + ":id/url_field",
            pkg + ":id/location_bar_edit_text",
            pkg + ":id/addressbarEdit",
            pkg + ":id/url_bar_title",
            pkg + ":id/search_box_text",
        };
        for (String viewId : urlBarIds) {
            try {
                List<AccessibilityNodeInfo> nodes =
                    root.findAccessibilityNodeInfosByViewId(viewId);
                if (nodes != null && !nodes.isEmpty()) {
                    AccessibilityNodeInfo node = nodes.get(0);
                    if (node.getText() != null && !node.getText().toString().isEmpty()) {
                        return node.getText().toString();
                    }
                }
            } catch (Exception ignored) {}
        }
        return extractUrlByTreeScan(root, 0);
    }

    // Broadened URL heuristic: common TLDs, IP literals, punycode ("xn--"), and text on
    // nodes that are notImportantForAccessibility (address bars are frequently marked this
    // way by browsers that still expose text via getText()).
    private static final java.util.regex.Pattern IPV4_PATTERN =
        java.util.regex.Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}(:\\d+)?(/.*)?$");
    private static final String[] COMMON_TLDS = new String[]{
        ".com", ".net", ".org", ".io", ".xyz", ".co", ".info", ".biz", ".me",
        ".tv", ".cc", ".online", ".site", ".club", ".app", ".dev", ".gg",
        ".to", ".cn", ".ru", ".in", ".uk", ".us", ".ca", ".de", ".fr", ".es",
        ".jp", ".br", ".xn--"
    };

    private String extractUrlByTreeScan(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 10) return null;
        if (!node.isPassword()) {
            CharSequence text = node.getText();
            if (text != null) {
                String t = text.toString().toLowerCase().trim();
                if (looksLikeUrl(t)) return t;
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            String found = extractUrlByTreeScan(node.getChild(i), depth + 1);
            if (found != null) return found;
        }
        return null;
    }

    private boolean looksLikeUrl(String t) {
        if (t.isEmpty() || t.length() < 4 || t.contains(" ")) return false;
        if (t.startsWith("http://") || t.startsWith("https://")) return true;
        if (IPV4_PATTERN.matcher(t).matches()) return true;
        for (String tld : COMMON_TLDS) {
            if (t.contains(tld)) return true;
        }
        return false;
    }

    private boolean isBrowser(String pkg) {
        if (pkg == null) return false;
        if (getAllBrowserPackages().contains(pkg)) return true;
        for (String webviewHost : IN_APP_WEBVIEW_PACKAGES) if (webviewHost.equals(pkg)) return true;
        return false;
    }

    private boolean scanForTextFast(AccessibilityNodeInfo node, String targetText, int depth) {
        if (node == null || depth > 10) return false;
        CharSequence text = node.getText();
        if (text != null && text.toString().toLowerCase()
            .contains(targetText.toLowerCase())) return true;
        for (int i = 0; i < node.getChildCount(); i++) {
            if (scanForTextFast(node.getChild(i), targetText, depth + 1)) return true;
        }
        return false;
    }

    private boolean scanForReelsFast(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 10) return false;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        if (text != null) {
            String t = text.toString().toLowerCase().trim();
            if (t.equals("shorts") || t.equals("reels")) return true;
        }
        if (desc != null) {
            String d = desc.toString().toLowerCase().trim();
            if (d.equals("shorts") || d.equals("reels")) return true;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            if (scanForReelsFast(node.getChild(i), depth + 1)) return true;
        }
        return false;
    }

    private boolean isSystemUI(String pkg) {
        return pkg.equals("com.android.systemui") || pkg.equals("android") || pkg.contains("launcher");
    }

    private boolean isSocialMediaApp(String pkg) {
        return pkg.contains("youtube") || pkg.contains("facebook") ||
               pkg.contains("instagram") || pkg.contains("tiktok") ||
               pkg.contains("orca") || pkg.contains("telegram") ||
               pkg.contains("whatsapp");
    }

    private void triggerBackAction(String reason) {
        performGlobalAction(GLOBAL_ACTION_BACK);
        preferences.incrementBlockedAttempts();
    }

    private void triggerHomeAction(String reason) {
        performGlobalAction(GLOBAL_ACTION_HOME);
        preferences.incrementBlockedAttempts();
    }

    private void triggerBackActionWithToast(String message) {
        performGlobalAction(GLOBAL_ACTION_BACK);
        preferences.incrementBlockedAttempts();
        new Handler(Looper.getMainLooper()).postDelayed(() ->
            Toast.makeText(getApplicationContext(), message, Toast.LENGTH_LONG).show(), 150);
    }

    @Override
    public void onInterrupt() {
        Log.e(TAG, "Shield Accessibility Service Interrupted");
    }
}
