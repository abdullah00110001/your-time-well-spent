package com.mylifeos.app.shield;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Log;
import android.widget.Toast;
import android.os.Handler;
import android.os.Looper;
import android.os.Bundle;

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

    private String lastBlockedPackage = "";
    private String lastBlockedUrl = "";
    private long lastActionTime = 0;
    private long lastScanTime = 0;
    private long lastBlockTime = 0; // ✅ Fix: block করার পর cooldown track করো

    // ✅ Fix 1: cooldown বাড়ানো হয়েছে — 300ms → 1500ms
    // false positive কমবে, loop বন্ধ হবে
    private static final long SCAN_COOLDOWN_MS  = 1500;

    // ✅ Fix 2: block করার পরে অন্তত ৩ সেকেন্ড আর কিছু block করা যাবে না
    // এটা loop বন্ধ করে (block screen → event → block → loop)
    private static final long POST_BLOCK_COOLDOWN_MS = 3000;

    private Set<String> adultKeywordsSet = new HashSet<>();
    private Set<String> adultSitesList   = new HashSet<>();
    private Set<String> monitoredApps    = new HashSet<>();

    private static final String[] ADULT_DOMAIN_PATTERNS = new String[]{
        "porn", "xxx", "sex", "nude", "naked", "hentai", "erotic",
        "adult", "nsfw", "cam4", "onlyfans", "chaturbate", "stripchat",
        "xvideo", "xhamster", "redtube", "youporn", "tube8", "spankbang",
        "brazzers", "bangbros", "livejasmin", "camgirl", "webcamgirl",
        "freecam", "dirtygirl", "slutload", "slutroulette", "faphouse",
        "cumlouder", "beeg", "xnxx", "fuq", "tnaflix", "4tube",
        "youjizz", "mofos", "teamskeet", "realitykings", "naughtyamerica"
    };

    private static final String[] BROWSER_PACKAGES = new String[]{
        "com.android.chrome", "com.chrome.beta", "com.chrome.dev",
        "org.mozilla.firefox", "com.brave.browser", "com.opera.browser",
        "com.microsoft.emmx", "com.sec.android.app.sbrowser",
        "com.duckduckgo.mobile.android"
    };

    // রেখে দেওয়া হলো (রিমুভ করা হয়নি), তবে সব অ্যাপে কাজ করার জন্য নিচে লজিক বদলানো হয়েছে
    private static final String[] CONTENT_SCAN_PACKAGES = new String[]{
        "com.android.chrome", "com.chrome.beta", "com.chrome.dev",
        "org.mozilla.firefox", "com.brave.browser", "com.opera.browser",
        "com.microsoft.emmx", "com.sec.android.app.sbrowser",
        "com.duckduckgo.mobile.android", "com.google.android.youtube",
        "com.facebook.katana", "com.instagram.android",
        "com.zhiliaoapp.musically", "com.ss.android.ugc.trill",
        "org.telegram.messenger", "com.twitter.android",
        "com.reddit.frontpage",
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
        loadAdultKeywordsFromAssets();
        loadAdultSitesFromAssets();
        loadMonitoredApps();
        Log.d(TAG, "🛡️ Shield Connected — keywords: " + adultKeywordsSet.size()
            + ", sites: " + adultSitesList.size());
    }

    private void loadMonitoredApps() {
        monitoredApps.clear();
        Set<String> saved = preferences.getMonitoredApps();
        if (saved != null) monitoredApps.addAll(saved);
        for (String b : BROWSER_PACKAGES) monitoredApps.add(b);
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
                String trimmed = line.trim().toLowerCase()
                    .replace("https://", "").replace("http://", "").replace("www.", "");
                if (trimmed.endsWith("/")) trimmed = trimmed.substring(0, trimmed.length() - 1);
                if (!trimmed.isEmpty() && !trimmed.startsWith("#")) adultSitesList.add(trimmed);
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

        // ✅ Fix 4: নিজের app এ কিছু করা যাবে না
        if (packageName.equals(getPackageName())) return;

        // ✅ Fix 5: block screen যেন নিজেই block না করে
        // ShieldBlockActivity বা NightToRiseBlockActivity থেকে event এলে ignore করো
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
                    pureShieldIntent.setAction("PureShield.FOREGROUND_APP_CHANGED");
                    pureShieldIntent.putExtra("package", packageName);
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
                checkAndBlockUrl(url, packageName);
            }
        }

        // ==========================================
        // Feature 4: Content Scan
        // ✅ এখন নির্দিষ্ট অ্যাপের বাইরেও সব অ্যাপেই কাজ করবে (নিজের অ্যাপ ও ব্লক স্ক্রিন বাদে)
        // ==========================================
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            long now = System.currentTimeMillis();

            // ✅ post-block cooldown — block করার ৩ সেকেন্ড পর আবার scan শুরু
            if (now - lastBlockTime < POST_BLOCK_COOLDOWN_MS) return;

            // ✅ scan cooldown — 1500ms এর আগে আবার scan নয়
            if (now - lastScanTime < SCAN_COOLDOWN_MS) return;

            // ✅ সব অ্যাপে স্ক্যান চালু করার জন্য চেকটি আপডেট করা হয়েছে
            if (!isContentScanTarget(packageName)) return;

            lastScanTime = now;
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            if (rootNode != null) {
                if (scanForAdultContent(rootNode, 0)) {
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
        // Feature 5: Keyword Typing Block
        // ==========================================
        if (type == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
            // সব অ্যাপে টাইপিং চেক করার জন্য monitoredApps চেকটি তুলে দেওয়া হলো বা বাইপাস করা হলো
            // if (!monitoredApps.contains(packageName) && !isBrowser(packageName)) return;

            CharSequence text = event.getText() != null && !event.getText().isEmpty()
                ? event.getText().get(0) : null;
            if (text != null && text.length() > 0) {
                String typed = text.toString().toLowerCase();

                for (String kw : adultKeywordsSet) {
                    if (typed.contains(kw)) {
                        if (hasStarEscape(typed, kw)) continue;
                        clearFocusedInput();
                        triggerAdultBlock("Typed Adult Keyword", packageName);
                        return;
                    }
                }

                Set<String> blockedKeywords = preferences.getBlockedKeywords();
                if (blockedKeywords != null) {
                    for (String kw : blockedKeywords) {
                        if (kw == null || kw.isEmpty()) continue;
                        if (typed.contains(kw.toLowerCase())) {
                            if (hasStarEscape(typed, kw.toLowerCase())) continue;
                            preferences.incrementBlockedAttempts();
                            clearFocusedInput();
                            triggerAdultBlock("Custom Keyword: " + kw, packageName);
                            return;
                        }
                    }
                }
            }
        }
    }

    // ==========================================
    // URL Block
    // ==========================================
    private void checkAndBlockUrl(String url, String packageName) {
        if (isAdultDomainPattern(url)) {
            lastBlockedUrl = url;
            doubleBack();
            triggerAdultBlock("Adult Domain Pattern: " + extractDomain(url), packageName);
            resetLastBlockedUrl();
            return;
        }
        if (isInAdultSitesList(url)) {
            lastBlockedUrl = url;
            doubleBack();
            triggerAdultBlock("Adult Site List: " + extractDomain(url), packageName);
            resetLastBlockedUrl();
            return;
        }
        if (hasAdultKeywordInUrl(url)) {
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
        if (blockedSites != null) {
            for (String site : blockedSites) {
                if (urlMatches(url, site)) {
                    lastBlockedUrl = url;
                    preferences.incrementBlockedAttempts();
                    triggerBackActionWithToast("Site Blocked 🛡️");
                    resetLastBlockedUrl();
                    return;
                }
            }
        }
    }

    // ==========================================
    // Adult Block
    // ==========================================
    private void triggerAdultBlock(String reason, String packageName) {
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastActionTime > 1500) {
            Log.d(TAG, "🔞 ADULT BLOCKED | " + reason + " | pkg: " + packageName);
            preferences.incrementBlockedAttempts();
            performGlobalAction(GLOBAL_ACTION_BACK);
            lastActionTime = currentTime;

            // ✅ Fix 7: block time record করো — post-block cooldown এর জন্য
            lastBlockTime = currentTime;

            if (packageName != null && !packageName.isEmpty()) {
                escalationManager.registerOffense(packageName);
                long blockDurationMs = escalationManager.getRemainingMs(packageName);
                firewall.blockApp(packageName, blockDurationMs);
            }

            new Handler(Looper.getMainLooper()).postDelayed(
                () -> showBlockScreen(packageName, true), 150);
        }
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
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastActionTime > 1000) {
            lastActionTime = currentTime;
            lastBlockTime  = currentTime; // ✅ escalation block ও track করো
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
    }

    // ==========================================
    // Detection Helpers
    // ==========================================

    // ✅ Fix 8: কনটেন্ট স্ক্যান এখন নির্দিষ্ট কোনো লিস্টে আটকে না থেকে সব অ্যাপেই কাজ করবে (নিজের অ্যাপ ও ব্লক স্ক্রিন বাদে)
    private boolean isContentScanTarget(String pkg) {
        if (pkg == null) return false;
        
        // নিজের অ্যাপ বা ব্লক স্ক্রিন হলে স্ক্যান করার দরকার নেই (লুপ এড়াতে)
        if (pkg.equals(getPackageName()) || 
            pkg.contains("ShieldBlock") || 
            pkg.contains("NightToRise")) {
            return false;
        }
        
        // বাকি যেকোনো অ্যাপের জন্যই true রিটার্ন করবে, অর্থাৎ সব অ্যাপে স্ক্যান করবে
        return true;
    }

    private boolean isAdultDomainPattern(String url) {
        if (url == null) return false;
        String domain = extractDomain(url);
        for (String pattern : ADULT_DOMAIN_PATTERNS) {
            if (domain.contains(pattern)) return true;
        }
        return false;
    }

    private boolean isInAdultSitesList(String url) {
        if (url == null || adultSitesList.isEmpty()) return false;
        String domain = extractDomain(url);
        if (adultSitesList.contains(domain)) return true;
        String[] parts = domain.split("\\.");
        if (parts.length > 2) {
            String rootDomain = parts[parts.length - 2] + "." + parts[parts.length - 1];
            if (adultSitesList.contains(rootDomain)) return true;
        }
        return false;
    }

    private boolean hasAdultKeywordInUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        for (String kw : adultKeywordsSet) {
            if (lower.contains(kw)) return true;
        }
        return false;
    }

    private String extractDomain(String url) {
        String clean = url.toLowerCase()
            .replace("https://", "").replace("http://", "").replace("www.", "");
        return clean.contains("/") ? clean.substring(0, clean.indexOf("/")) : clean;
    }

    private boolean hasStarEscape(String typed, String keyword) {
        int checkLen = Math.min(3, keyword.length());
        String prefix = keyword.substring(0, checkLen);
        int idx = typed.indexOf(prefix);
        if (idx == -1) return false;
        int afterPrefix = idx + prefix.length();
        if (afterPrefix < typed.length() && typed.charAt(afterPrefix) == '*') return true;
        if (typed.contains("*")) {
            for (int i = 1; i < keyword.length() - 1; i++) {
                String masked = keyword.substring(0, i) + "*" + keyword.substring(i + 1);
                if (typed.contains(masked)) return true;
            }
        }
        return false;
    }

    private void clearFocusedInput() {
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;
            AccessibilityNodeInfo input = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (input != null) {
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

    private boolean scanForAdultContent(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 10) return false;
        CharSequence text = node.getText();
        if (text != null) {
            String t = text.toString().toLowerCase();
            for (String kw : adultKeywordsSet) {
                if (t.contains(kw)) return true;
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            if (scanForAdultContent(node.getChild(i), depth + 1)) return true;
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

    private String extractUrlByTreeScan(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 8) return null;
        CharSequence text = node.getText();
        if (text != null) {
            String t = text.toString().toLowerCase().trim();
            if ((t.startsWith("http") || t.contains(".com") || t.contains(".net") ||
                 t.contains(".org") || t.contains(".io") || t.contains(".xyz")) &&
                t.length() > 4 && !t.contains(" ")) return t;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            String found = extractUrlByTreeScan(node.getChild(i), depth + 1);
            if (found != null) return found;
        }
        return null;
    }

    private boolean urlMatches(String url, String pattern) {
        if (url == null || pattern == null) return false;
        String cleanUrl = url.toLowerCase()
            .replace("https://", "").replace("http://", "").replace("www.", "");
        String cleanPattern = pattern.toLowerCase()
            .replace("https://", "").replace("http://", "").replace("www.", "").trim();
        return cleanUrl.equals(cleanPattern) ||
               cleanUrl.startsWith(cleanPattern + "/") ||
               cleanUrl.startsWith(cleanPattern + "?") ||
               cleanUrl.contains("." + cleanPattern);
    }

    private boolean isBrowser(String pkg) {
        for (String b : BROWSER_PACKAGES) if (b.equals(pkg)) return true;
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
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastActionTime > 1000) {
            preferences.incrementBlockedAttempts();
            performGlobalAction(GLOBAL_ACTION_BACK);
            lastActionTime = currentTime;
        }
    }

    private void triggerHomeAction(String reason) {
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastActionTime > 1000) {
            preferences.incrementBlockedAttempts();
            performGlobalAction(GLOBAL_ACTION_HOME);
            lastActionTime = currentTime;
        }
    }

    private void triggerBackActionWithToast(String message) {
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastActionTime > 1500) {
            preferences.incrementBlockedAttempts();
            performGlobalAction(GLOBAL_ACTION_BACK);
            lastActionTime = currentTime;
            lastBlockTime  = currentTime; // ✅ toast block ও track করো
            new Handler(Looper.getMainLooper()).postDelayed(() ->
                Toast.makeText(getApplicationContext(), message, Toast.LENGTH_LONG).show(), 150);
        }
    }

    @Override
    public void onInterrupt() {
        Log.e(TAG, "Shield Accessibility Service Interrupted");
    }
}
