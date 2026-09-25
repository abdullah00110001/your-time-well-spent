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
import com.mylifeos.app.shield.core.BlockingOverlay;

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


    /** [SHIELD-CARD] "keyword" for user-defined keywords, otherwise "adult". */
    private volatile String pendingBlockKind = "adult";
    private String lastBlockedUrl = "";
    private long lastScanTime = 0;

    private static final long SCAN_COOLDOWN_MS = 1500;

    /**
     * De-duplication window for the block screen. This is NOT a cooldown that
     * lets an app through: enforcement (leaving the blocked app) always runs,
     * this only stops us from stacking identical block activities when Android
     * emits several window events for the same launch.
     */
    private static final long BLOCK_SCREEN_DEDUPE_MS = 700;
    private final java.util.HashMap<String, Long> lastBlockScreenAt = new java.util.HashMap<>();

    /**
     * Throttle for enforcement driven by TYPE_WINDOW_CONTENT_CHANGED, which can
     * fire dozens of times per second. Per package so a genuine app switch is
     * never swallowed by another app's throttle.
     */
    private static final long CONTENT_ENFORCE_THROTTLE_MS = 400;
    private final java.util.HashMap<String, Long> lastContentEnforceAt = new java.util.HashMap<>();

    /**
     * Rate-limits the PureShield foreground signal: at most one per package
     * change, and never more than one every 1.5s for the same package.
     */
    private static final long PURESHIELD_SIGNAL_THROTTLE_MS = 1500;
    private String lastPureShieldPkg = null;
    private long lastPureShieldSignalAt = 0L;

    private boolean allowPureShieldSignal(String pkg) {
        long now = android.os.SystemClock.elapsedRealtime();
        if (pkg != null && pkg.equals(lastPureShieldPkg)
            && now - lastPureShieldSignalAt < PURESHIELD_SIGNAL_THROTTLE_MS) {
            return false;
        }
        lastPureShieldPkg = pkg;
        lastPureShieldSignalAt = now;
        return true;
    }

    private boolean allowContentEnforce(String pkg) {
        long now = android.os.SystemClock.elapsedRealtime();
        Long prev = lastContentEnforceAt.get(pkg);
        if (prev != null && now - prev < CONTENT_ENFORCE_THROTTLE_MS) return false;
        lastContentEnforceAt.put(pkg, now);
        return true;
    }

    /** True when a fresh block screen should be shown for this package now. */

    private boolean allowBlockScreen(String pkg) {
        long now = android.os.SystemClock.elapsedRealtime();
        Long prev = lastBlockScreenAt.get(pkg);
        if (prev != null && now - prev < BLOCK_SCREEN_DEDUPE_MS) return false;
        lastBlockScreenAt.put(pkg, now);
        return true;
    }

    /**
     * Live handle on the running accessibility service.
     *
     * Root cause this fixes: {@link com.mylifeos.app.shield.core.ForegroundGuardService}
     * used a HOME *intent* to pull the user out of a blocked app. On Android 10+
     * background activity starts from a service are silently dropped, so the
     * poll-driven enforcement path never actually left the blocked app — the
     * lock "looked active" but nothing happened. Accessibility services are
     * exempt from that restriction, so route the action through here when the
     * service is connected.
     */
    private static volatile ShieldAccessibilityService instance = null;

    public static boolean goHomeViaAccessibility() {
        ShieldAccessibilityService svc = instance;
        if (svc == null) return false;
        try { return svc.performGlobalAction(GLOBAL_ACTION_HOME); }
        catch (Throwable t) { return false; }
    }

    /**
     * Launch a blocking activity from the actual bound accessibility service.
     * Android treats this context differently from an ordinary foreground
     * service when applying background-activity launch restrictions.
     */
    public static boolean launchBlockActivity(Intent intent) {
        ShieldAccessibilityService svc = instance;
        if (svc == null || intent == null) return false;
        try {
            svc.startActivity(intent);
            return true;
        } catch (Throwable t) {
            Log.w(TAG, "Accessibility block-screen launch rejected", t);
            return false;
        }
    }

    public static void scheduleBlockingOverlay(boolean sleepToRise, boolean rise,
                                               String title, String message, Runnable onHome) {
        ShieldAccessibilityService svc = instance;
        if (svc == null) return;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            ShieldAccessibilityService current = instance;
            if (current != null) {
                BlockingOverlay.show(current, sleepToRise, rise, title, message, onHome);
            }
        }, 450);
    }

    public static boolean showBlockingOverlay(boolean sleepToRise, boolean rise,
                                              String title, String message, Runnable onHome) {
        ShieldAccessibilityService svc = instance;
        return svc != null && BlockingOverlay.show(svc, sleepToRise, rise, title, message, onHome);
    }

    public static void dismissBlockingOverlay() { BlockingOverlay.hide(); }

    /** [SHIELD-CARD] Draws the shared Shield block card as an accessibility overlay. */
    public static boolean showShieldCard(com.mylifeos.app.shield.core.ShieldBlockCard.Spec spec, Runnable onHome) {
        ShieldAccessibilityService svc = instance;
        return svc != null && BlockingOverlay.showCard(svc, spec, onHome);
    }

    public static void refreshContentConfiguration() {
        ShieldAccessibilityService svc = instance;
        if (svc != null) svc.loadMonitoredApps();
    }

    public static boolean isConnected() { return instance != null; }

    /** Immediately leaves the blocked app so its content is never usable. */
    private void leaveBlockedApp() {
        // Used only if the dedicated block activity could not be presented.
        // Do not queue BACK after HOME: a delayed BACK can land on a newly
        // opened block activity and make the screen appear to never launch.
        try { performGlobalAction(GLOBAL_ACTION_HOME); } catch (Throwable ignored) {}
    }


    private Set<String> adultKeywordsSet = new HashSet<>();
    /** Bengali adult keywords (bn_keywords.txt). Shipped for a long time, never read until now. */
    private Set<String> bnKeywordsSet    = new HashSet<>();
    private Set<String> adultSitesList   = new HashSet<>();
    private Set<String> monitoredApps    = new HashSet<>();

    /** Cached Telegram Guard config; refreshed via {@link #refreshContentConfiguration()}. */
    private volatile com.mylifeos.app.shield.core.TelegramGuard.Config telegramConfig =
        new com.mylifeos.app.shield.core.TelegramGuard.Config();
    private static final long TELEGRAM_INSPECT_THROTTLE_MS = 350;
    private long lastTelegramInspectAt = 0;

    /**
     * Union of every keyword source: built-in English, built-in Bengali and the
     * user's own custom words. Used for typed text, on-screen content, URLs and
     * Telegram inspection so a custom word is enforced everywhere, not only
     * while typing.
     */
    private Set<String> allKeywords() {
        Set<String> all = new HashSet<>(adultKeywordsSet);
        all.addAll(bnKeywordsSet);
        if (preferences != null) {
            Set<String> custom = preferences.getBlockedKeywords();
            if (custom != null) all.addAll(custom);
        }
        return all;
    }

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
        "youjizz", "mofos", "teamskeet", "realitykings", "naughtyamerica",
        // Moved here from adult_keywords.txt: these are site/brand names, not
        // generic content words, so they belong in domain/URL matching only —
        // free chat/typed text should never trigger on a brand-name collision.
        "21sextury", "3movs", "69games", "adameve",
        "adultfriendfinder", "adulttime", "alohatube", "americansexdolls",
        "analgalore", "anyshemale", "ashemaletube", "assoass",
        "avn", "babepedia", "badjojo", "badoinkvr",
        "bangstars", "bdsmstreak", "bellesa", "bemyhole",
        "besttrannypornsites", "bigassporn", "bigporn", "boyfriendtv",
        "camsfinder", "camsoda", "camsodaai", "camster",
        "candyai", "chaturbate.lat", "clips4sale", "colliderporn",
        "czechvr", "digitalplayground", "dondiai", "dorcelclub",
        "elegantangel", "eporner", "eroticbeauties", "fakku",
        "findafuckbuddy", "flingster", "flirtcamai", "forhertube",
        "forum.adultdvdtalk", "freelocalsex", "freeones", "frolicme",
        "fyptt", "gamcore", "gamesofdesire", "gay0day",
        "gaymaletube", "gayxo", "gelbooru", "girlsway",
        "gptgirlfriend", "grannytube", "handjobhub", "hentaigasm",
        "highreply", "homemadegalore", "homepornking", "hotmilfsfuck",
        "hotporntubes", "hqporn", "ichatonline", "imlive",
        "iporntv", "ixxx", "jav.guru", "javhd",
        "jerkmate", "jerkroulette", "joylovedolls", "lesbify",
        "lesbosland", "lobstertube", "lovehomeporn", "machotube",
        "madeporn", "maturetube", "megatube", "melonstube",
        "milfmovs", "milfporn", "mopoga", "myfreecams",
        "mypornbible", "myporngay", "myspicyvanilla", "newsensations",
        "nutaku", "penispictures", "perfectgirls", "pichunter",
        "playboy", "porcore", "porn.biz", "porn300",
        "porn7", "porndoe", "porngames", "porngameshub",
        "pornhat", "pornhub", "pornid", "pornmd",
        "pornone", "pornpic", "pornplanner", "pornprosnetwork",
        "pornworks", "pussyspace", "qorno", "rabbitscams",
        "rat.xxx", "rawrides", "realsexdoll", "rosetoy",
        "royalcamslive", "rule34", "secretsai", "sexlikereal",
        "sexmessenger", "sexvid", "sexyai", "sexymeet",
        "sexyrealsexdolls", "skyprivate", "smutr", "spicychat",
        "spizoo", "stasyq", "stripchatvr", "sugarlab",
        "superporn", "sweepsex", "sxyprn", "teenmegaworld",
        "theyarehuge", "tiava", "tikporn", "tubebdsm",
        "tubegalore", "tubepornstars", "tubev", "twistys",
        "videosz", "viewgals", "vipwank", "vjav",
        "voyeur-house", "vrbangers", "vrporn", "vrsmash",
        "wankzvr", "xanimu", "xbabe", "xcafe",
        "xgroovy", "xtease", "xvideos", "xxxbunker",
        "xxxfollow", "xxxtik", "youporngay", "yourdoll",
        "youx", "zbporn", "zenra", "zzztube",
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
        // Telegram forks — same rendered UI as official Telegram, so typed-keyword
        // blocking (Feature 5) and screen-content scanning must cover them too.
        // Keep in sync with TelegramGuard.TELEGRAM_PACKAGES.
        "org.telegram.messenger.web", "org.telegram.messenger.beta",
        "org.telegram.plus", "org.thunderdog.challegram",
        "nekox.messenger", "tw.nekomimi.nekogram",
        "com.iMe.android", "org.telegram.BifToGram",
        "ir.ilmili.telegraph", "org.mmessenger.messenger",
    };

    // Known in-app-webview hosts: apps that embed a WebView and can render arbitrary URLs.
    private static final String[] IN_APP_WEBVIEW_PACKAGES = new String[]{
        "com.facebook.katana", "com.instagram.android", "org.telegram.messenger",
        "com.twitter.android", "com.reddit.frontpage", "com.zhiliaoapp.musically",
        // Telegram forks — kept in sync with CONTENT_SCAN_PACKAGES above.
        "org.telegram.messenger.web", "org.telegram.messenger.beta",
        "org.telegram.plus", "org.thunderdog.challegram",
        "nekox.messenger", "tw.nekomimi.nekogram",
        "com.iMe.android", "org.telegram.BifToGram",
        "ir.ilmili.telegraph", "org.mmessenger.messenger",
    };

    // ==========================================
    // Lifecycle
    // ==========================================

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        // Publish the instance FIRST. Everything below is best-effort: if any
        // init step throws (a missing asset, an OEM receiver restriction), the
        // service must still be able to enforce blocks instead of dying and
        // leaving the lock "active but doing nothing".
        instance = this;
        try {
            preferences      = new ShieldPreferences(this);
            escalationManager = new ShieldEscalationManager(this);
            firewall         = new ShieldAppFirewall(this);
            loopGuard        = new BlockLoopGuard(this);
            timerManager     = new ShieldTimerManager(this);
        } catch (Throwable t) {
            Log.e(TAG, "Shield init failed", t);
        }

        try { loadAdultKeywordsFromAssets(); } catch (Throwable t) { Log.w(TAG, "keywords", t); }
        try { loadAdultSitesFromAssets(); }   catch (Throwable t) { Log.w(TAG, "sites", t); }
        try { loadMonitoredApps(); }          catch (Throwable t) { Log.w(TAG, "monitored", t); }
        try { refreshResolvedBrowserPackages(); } catch (Throwable t) { Log.w(TAG, "browsers", t); }
        try { registerPackageAddedReceiver(); } catch (Throwable t) { Log.w(TAG, "receiver", t); }
        // Service just connected: apply the real state immediately instead of
        // waiting out the throttle window in sync().
        try { com.mylifeos.app.shield.core.ForegroundGuardService.forceSync(this); }
        catch (Throwable t) { Log.w(TAG, "guard sync", t); }
        try { com.mylifeos.app.nighttorise.NightToRiseManager.invalidateSafetyCache(); }
        catch (Throwable ignored) {}
        Log.d(TAG, "🛡️ Shield Connected — keywords: " + adultKeywordsSet.size()
            + ", sites: " + adultSitesList.size()
            + ", browsers: " + getAllBrowserPackages().size());
    }

    @Override
    public boolean onUnbind(Intent intent) {
        instance = null;
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        instance = null;
        BlockingOverlay.hide();
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
                if (loopGuard != null) loopGuard.refreshLauncherPackage();
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_PACKAGE_ADDED);
        filter.addDataScheme("package");
        // Android 14+ (targetSdk 34/35) throws when the export flag is missing.
        androidx.core.content.ContextCompat.registerReceiver(
            this, packageAddedReceiver, filter,
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED);
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
        try { telegramConfig = preferences.getTelegramGuardConfig(); }
        catch (Throwable t) { Log.w(TAG, "telegram config", t); }
        Log.d(TAG, "📱 Monitored apps: " + monitoredApps.size());
    }

    private void loadAdultKeywordsFromAssets() {
        loadKeywordAsset("adult_keywords.txt", adultKeywordsSet);
        loadKeywordAsset("bn_keywords.txt", bnKeywordsSet);
        Log.d(TAG, "Keywords loaded — en: " + adultKeywordsSet.size() + ", bn: " + bnKeywordsSet.size());
    }

    private void loadKeywordAsset(String asset, Set<String> into) {
        try {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(getAssets().open(asset), "UTF-8"));
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim().toLowerCase();
                if (!trimmed.isEmpty() && !trimmed.startsWith("#")) into.add(trimmed);
            }
            reader.close();
        } catch (IOException e) {
            Log.e(TAG, "Error loading " + asset, e);
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

        // Sleep to Rise + Shield app blocking run through the same enforcer for
        // both state and content events. Several OEMs only emit content changes
        // for cold app launches; limiting this to state changes made Sleep to
        // Rise silently miss those launches.
        boolean sharedEnforceEvent = type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
        if (!sharedEnforceEvent
            && type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            && allowContentEnforce(packageName)) {
            sharedEnforceEvent = true;
        }
        if (sharedEnforceEvent) {
            com.mylifeos.app.shield.core.BlockEnforcer.noteForeground(packageName);
            com.mylifeos.app.shield.core.ForegroundGuardService.sync(this);
            com.mylifeos.app.shield.core.BlockEnforcer.Result r =
                com.mylifeos.app.shield.core.BlockEnforcer.enforce(this, packageName, this::leaveBlockedApp);
            if (r.blocked) return;
        }

        // PureShield foreground signal
        //
        // SAFETY-CRITICAL (device reboot): this fired startService() for EVERY
        // window-content and scroll event — dozens of ActivityManager binder
        // transactions per second while simply scrolling a feed. Combined with
        // the guard-service sync above it flooded system_server, whose watchdog
        // then restarts it (indistinguishable from a phone reboot). The signal
        // only carries a package name, so send it on real changes only.
        if ((type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            || type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            || type == AccessibilityEvent.TYPE_VIEW_SCROLLED)
            && allowPureShieldSignal(packageName)) {
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
        //
        // FIX: enforcement used to run ONLY on TYPE_WINDOW_STATE_CHANGED. On
        // MIUI / OneUI / HyperOS many app launches surface as
        // TYPE_WINDOW_CONTENT_CHANGED only, so blocked apps opened normally.
        // Both event types now enforce; content-changed is throttled per
        // package so we don't walk the tree on every frame.
        // ==========================================
        boolean enforceEvent = type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
        if (!enforceEvent
            && type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            && allowContentEnforce(packageName)) {
            enforceEvent = true;
        }

        if (enforceEvent) {
            if (escalationManager.isAppBlocked(packageName)) {
                long remaining = escalationManager.getRemainingMs(packageName);
                showEscalationBlockScreen(packageName, remaining);
                return;
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
                checkAndBlockUrl(url, packageName);
            }
        }

        // ==========================================
        // Feature 3b: Telegram Guard — chats, search, invite links, media.
        // Telegram exposes no URL, so the rendered tree is the only signal.
        // ==========================================
        if (com.mylifeos.app.shield.core.TelegramGuard.isTelegram(packageName)
            && telegramConfig != null && telegramConfig.enabled
            && preferences.isAdultFilterEnabled()
            && (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
                type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
                type == AccessibilityEvent.TYPE_VIEW_SCROLLED)) {
            long nowTg = android.os.SystemClock.elapsedRealtime();
            if (nowTg - lastTelegramInspectAt >= TELEGRAM_INSPECT_THROTTLE_MS) {
                lastTelegramInspectAt = nowTg;
                try {
                    com.mylifeos.app.shield.core.TelegramGuard.Verdict v =
                        com.mylifeos.app.shield.core.TelegramGuard.inspect(
                            getRootInActiveWindow(), allKeywords(), telegramConfig);
                    if (v.block) {
                        Log.d(TAG, "✈️ " + v.reason);
                        triggerAdultBlock(v.reason, packageName);
                        return;
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "Telegram inspect failed", t);
                }
            }
        }

        // ==========================================
        // Feature 4: Content Scan (screen text) — scoped to browsers + monitored apps only.
        // Runs on open, on content updates AND while scrolling (feeds load lazily,
        // so a scan only at window-open time missed everything below the fold).
        // ==========================================
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
            type == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
            long now = System.currentTimeMillis();
            if (now - lastScanTime >= SCAN_COOLDOWN_MS && isContentScanTarget(packageName)) {
                lastScanTime = now;
                AccessibilityNodeInfo rootNode = getRootInActiveWindow();
                if (rootNode != null) {
                    String host = isBrowser(packageName) ? extractDomain(lastBlockedUrl) : null;
                    if (preferences.isAdultFilterEnabled()) {
                        if (scanForAdultContent(rootNode, 0, host)) {
                            triggerAdultBlock("Adult Screen Content", packageName);
                            return;
                        }
                        if (scanForKeywordContent(rootNode, 0, bnKeywordsSet)) {
                            triggerAdultBlock("Adult Screen Content (bn)", packageName);
                            return;
                        }
                    }
                    Set<String> customKeywords = preferences.getBlockedKeywords();
                    if (scanForKeywordContent(rootNode, 0, customKeywords)) {
                        preferences.incrementBlockedAttempts();
                        triggerAdultBlock("Custom keyword on screen", packageName);
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

                if (preferences.isAdultFilterEnabled()
                    && (ContentMatcher.matchesKeyword(typed, adultKeywordsSet)
                        || ContentMatcher.matchesKeyword(typed, bnKeywordsSet))) {
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


    // Sleep to Rise has no site/keyword model anymore — enforcement is
    // allowlist-only at the package level (see onAccessibilityEvent).


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
        Set<String> blockedKeywords = preferences.getBlockedKeywords();
        if (blockedKeywords != null
            && ContentMatcher.matchesKeyword(url, blockedKeywords)) {
            lastBlockedUrl = url;
            preferences.incrementBlockedAttempts();
            triggerAdultBlock("Custom keyword in URL", packageName);
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
    /**
     * Short, ambiguous tokens ("sex", "adult", ...) live inside perfectly innocent
     * hostnames (sussex.ac.uk, adultlearning.org). They only count as a hit when they
     * are a whole token of the label, i.e. delimited by a non-letter character.
     * Distinctive brand tokens ("xhamster", "brazzers", ...) may match as substrings.
     */
    private static final Set<String> GENERIC_DOMAIN_TOKENS = new HashSet<>(java.util.Arrays.asList(
        "porn", "xxx", "sex", "nude", "naked", "hentai", "erotic", "adult", "nsfw"
    ));

    private boolean hasAdultDomainSubstringPattern(String host) {
        if (host == null || host.isEmpty()) return false;
        String[] labels = host.toLowerCase(java.util.Locale.ROOT).split("\\.");
        for (String label : labels) {
            // Split each label into letter-runs, so "xxx-tube" / "sex1" / "hd_porn"
            // still yield the bare token while "sussex" stays a single run.
            String[] tokens = label.split("[^a-z]+");
            for (String pattern : ADULT_DOMAIN_PATTERNS) {
                boolean generic = GENERIC_DOMAIN_TOKENS.contains(pattern);
                for (String token : tokens) {
                    if (token.isEmpty()) continue;
                    if (generic ? token.equals(pattern) : token.contains(pattern)) return true;
                }
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

            if (packageName != null && !packageName.isEmpty()) {
                escalationManager.registerOffense(packageName);
                long blockDurationMs = escalationManager.getRemainingMs(packageName);
                firewall.blockApp(packageName, blockDurationMs);
            }

            // Cover the screen FIRST, then leave the app underneath — this way the
            // flagged content (or a flash of whatever is behind it) is never visible,
            // even for a moment. Previously BACK fired immediately but the block
            // screen only appeared ~150ms later, leaving a visible gap.
            pendingBlockKind = classifyBlockKind(reason);
            showBlockScreen(packageName, true);
            performGlobalAction(GLOBAL_ACTION_BACK);
            return;
        }

        if (loopGuard.shouldSoftBlock(packageName)) {
            Log.d(TAG, "🟡 SOFT BLOCK | " + reason + " | pkg: " + packageName);
            loopGuard.registerTrigger(packageName);
            preferences.incrementBlockedAttempts();
            performGlobalAction(GLOBAL_ACTION_BACK);

            String toastMessage = "Blocked content avoided";
            if (packageName != null && !packageName.isEmpty()) {
                try {
                    long remainingMs = escalationManager.getRemainingMs(packageName);
                    long remainingMin = Math.max(1, remainingMs / 60_000);
                    if (remainingMs > 0) {
                        toastMessage = "App blocked for " + remainingMin + " min";
                    }
                } catch (Throwable ignored) {
                    // Fall back to the generic message if escalation state isn't available yet.
                }
            }
            final String finalToastMessage = toastMessage;
            new Handler(Looper.getMainLooper()).postDelayed(() ->
                Toast.makeText(getApplicationContext(), finalToastMessage, Toast.LENGTH_SHORT).show(), 150);
            return;
        }

        // Neither soft nor hard is allowed right now (cooldown/backoff active) — do nothing,
        // this is intentional: it breaks accidental infinite back-loops.
        Log.d(TAG, "⏸️ Trigger suppressed by BlockLoopGuard | " + reason + " | pkg: " + packageName);
    }

    private void triggerAdultBlock(String reason) {
        triggerAdultBlock(reason, null);
    }

    /** [SHIELD-CARD] User-defined keyword reasons all start with "Custom". */
    private static String classifyBlockKind(String reason) {
        if (reason == null) return "adult";
        return reason.toLowerCase(java.util.Locale.ROOT).startsWith("custom") ? "keyword" : "adult";
    }

    /** [SHIELD-CARD] Overlay-first; falls back to the activity inside BlockEnforcer.presentShield. */
    private void presentBlock(Intent intent) {
        try {
            com.mylifeos.app.shield.core.BlockEnforcer.presentShield(this, intent, null);
        } catch (Throwable t) {
            Log.w(TAG, "presentShield failed, starting activity", t);
            try { startActivity(intent); } catch (Throwable ignored) {}
        }
    }

    // ==========================================
    // Block Screens
    // ==========================================
    private void showBlockScreen(String packageName, boolean isAdultBlock) {
        Intent intent = new Intent(this, ShieldBlockActivity.class);
        if (packageName != null) intent.putExtra("BLOCKED_PACKAGE", packageName);
        intent.putExtra("IS_ADULT_BLOCK", isAdultBlock);
        intent.putExtra("BLOCK_KIND", pendingBlockKind);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS |
            Intent.FLAG_ACTIVITY_NO_ANIMATION);
        presentBlock(intent);
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
            presentBlock(intent);
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

    private boolean scanForKeywordContent(AccessibilityNodeInfo node, int depth, Set<String> keywords) {
        if (node == null || depth > 12 || keywords == null || keywords.isEmpty()) return false;
        if (node.isPassword()) return false;
        CharSequence text = node.getText();
        CharSequence description = node.getContentDescription();
        if ((text != null && ContentMatcher.matchesKeyword(text.toString(), keywords))
            || (description != null && ContentMatcher.matchesKeyword(description.toString(), keywords))) {
            return true;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            if (scanForKeywordContent(node.getChild(i), depth + 1, keywords)) return true;
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

