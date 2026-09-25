package com.mylifeos.app.shield.core;

import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * TelegramGuard — offline 18+ enforcement inside Telegram (and forks).
 *
 * Telegram never exposes a URL to block, so the only reliable offline signal is
 * the rendered accessibility tree. This class turns that tree into a verdict:
 *
 *  1. CHAT / GROUP / CHANNEL NAMES — the chat title, channel name and the chat
 *     list rows are matched with {@link ContentMatcher} (word-boundary,
 *     de-obfuscating) against the adult keyword set + the user's own keywords,
 *     in English and Bengali.
 *  2. SEARCH — Telegram's global search results ("Groups", "Channels",
 *     "Messages" sections) go through the same matcher, so searching for adult
 *     terms surfaces nothing usable before the block screen fires.
 *  3. JOIN VIA LINK — `t.me/…`, `t.me/+…`, `t.me/joinchat/…` links are parsed
 *     out of message text and out of the join-confirmation dialog. The slug
 *     itself is matched (adult invite slugs are almost always explicit), and in
 *     strict mode ANY join dialog is blocked.
 *  4. PHOTO / VIDEO — when the media viewer is on screen inside a chat that was
 *     just flagged (or always, if "block all Telegram media" is on), the viewer
 *     is treated as explicit. Face/skin level detection stays PureShield's job;
 *     this is the text/context tier that runs even when PureShield is off.
 *
 * Pure logic + AccessibilityNodeInfo reads only — no side effects, so the
 * calling service decides how to block.
 */
public final class TelegramGuard {

    private TelegramGuard() {}

    /** Telegram official + the popular forks that render the same UI. */
    private static final Set<String> TELEGRAM_PACKAGES = new HashSet<>(Arrays.asList(
        "org.telegram.messenger",
        "org.telegram.messenger.web",
        "org.telegram.messenger.beta",
        "org.telegram.plus",           // Plus Messenger
        "org.thunderdog.challegram",   // Telegram X
        "nekox.messenger",
        "tw.nekomimi.nekogram",
        "com.iMe.android",
        "org.telegram.BifToGram",
        "ir.ilmili.telegraph",
        "org.mmessenger.messenger"
    ));

    public static boolean isTelegram(String pkg) {
        if (pkg == null) return false;
        if (TELEGRAM_PACKAGES.contains(pkg)) return true;
        String lower = pkg.toLowerCase(Locale.ROOT);
        return lower.contains("telegram") || lower.contains("nekogram") || lower.contains("nekox");
    }

    /** t.me / telegram.me public links, invite links and joinchat hashes. */
    private static final Pattern TME_LINK = Pattern.compile(
        "(?:https?://)?(?:t\\.me|telegram\\.me|telegram\\.dog)/(?:joinchat/|\\+)?([a-zA-Z0-9_+\\-]{3,64})");

    /** Words Telegram uses on the invite / join confirmation sheet. */
    private static final String[] JOIN_MARKERS = new String[]{
        "join group", "join channel", "join chat", "do you want to join",
        "request to join", "join now", "গ্রুপে যোগ", "চ্যানেলে যোগ"
    };

    /** Markers of the full-screen photo/video viewer and of media attachments. */
    private static final String[] MEDIA_MARKERS = new String[]{
        "photo viewer", "video player", "play video", "gif", "sticker preview",
        "share photo", "save to gallery", "forward photo", "forward video"
    };

    /** Config mirrors the user-facing Telegram Guard toggles. */
    public static final class Config {
        public boolean enabled = true;
        public boolean blockChats = true;      // group/channel/chat names + messages
        public boolean blockSearch = true;     // in-app search results
        public boolean blockInviteLinks = true;// t.me / joinchat links
        public boolean blockAllInvites = false;// strict: any join sheet at all
        public boolean blockMedia = true;      // photo/video inside a flagged chat
        public boolean blockAllMedia = false;  // strict: any photo/video viewer
    }

    public static final class Verdict {
        public final boolean block;
        public final String reason;
        private Verdict(boolean block, String reason) { this.block = block; this.reason = reason; }
        static Verdict no() { return new Verdict(false, null); }
        static Verdict yes(String reason) { return new Verdict(true, reason); }
    }

    /** Remembers that the currently-open Telegram surface was flagged. */
    private static volatile long lastAdultHitAt = 0L;
    private static final long FLAGGED_WINDOW_MS = 90_000L;

    public static boolean isRecentlyFlagged() {
        return android.os.SystemClock.elapsedRealtime() - lastAdultHitAt < FLAGGED_WINDOW_MS;
    }

    public static void clearFlag() { lastAdultHitAt = 0L; }

    private static final int MAX_NODES = 500;
    private static final int MAX_DEPTH = 16;

    /**
     * Inspects the current Telegram screen.
     *
     * @param root     current window root (may be null)
     * @param keywords union of built-in adult keywords (EN + BN) and the user's own
     */
    public static Verdict inspect(AccessibilityNodeInfo root, Set<String> keywords, Config cfg) {
        if (root == null || cfg == null || !cfg.enabled) return Verdict.no();

        List<String> texts = new ArrayList<>();
        collect(root, 0, texts);
        if (texts.isEmpty()) return Verdict.no();

        boolean joinSheet = false;
        boolean mediaViewer = false;

        for (String raw : texts) {
            String lower = raw.toLowerCase(Locale.ROOT);

            for (String marker : JOIN_MARKERS) {
                if (lower.contains(marker)) { joinSheet = true; break; }
            }
            for (String marker : MEDIA_MARKERS) {
                if (lower.contains(marker)) { mediaViewer = true; break; }
            }

            // 1/2. Chat, group, channel, message and search-result text.
            if ((cfg.blockChats || cfg.blockSearch)
                && ContentMatcher.matchesKeyword(raw, keywords)) {
                flag();
                return Verdict.yes("Telegram 18+ content: \"" + trim(raw) + "\"");
            }

            // 3. Invite links — match the slug itself (adult invite slugs are explicit).
            if (cfg.blockInviteLinks) {
                Matcher m = TME_LINK.matcher(lower);
                while (m.find()) {
                    String slug = m.group(1);
                    String spaced = slug.replace('_', ' ').replace('-', ' ').replace('+', ' ');
                    if (ContentMatcher.matchesKeyword(spaced, keywords)) {
                        flag();
                        return Verdict.yes("Telegram invite link blocked: t.me/" + slug);
                    }
                }
            }
        }

        // 3a. Join sheet is open — scan the sheet's own name/description text directly.
        // This does NOT depend on a prior flagged screen: the group/channel name and
        // description rendered on the join-confirmation sheet are matched against the
        // same keyword set right here, so an adult group can be blocked the very first
        // time its join sheet is seen, before ever entering the chat.
        if (cfg.blockInviteLinks && joinSheet) {
            for (String raw : texts) {
                String lower = raw.toLowerCase(Locale.ROOT);
                boolean isMarkerLine = false;
                for (String marker : JOIN_MARKERS) {
                    if (lower.equals(marker) || lower.contains(marker)) { isMarkerLine = true; break; }
                }
                // Skip the marker line itself (e.g. "Join Group") — we want the
                // group's own name/description text, not the button/prompt text.
                if (isMarkerLine) continue;
                if (ContentMatcher.matchesKeyword(raw, keywords)) {
                    return Verdict.yes("Telegram join blocked: \"" + trim(raw) + "\"");
                }
            }
        }

        // 3b. Strict mode — no joining anything at all through a link.
        if (cfg.blockInviteLinks && cfg.blockAllInvites && joinSheet) {
            return Verdict.yes("Joining Telegram groups is blocked");
        }
        // Joining while the screen also carries flagged context.
        if (cfg.blockInviteLinks && joinSheet && isRecentlyFlagged()) {
            return Verdict.yes("Joining a flagged Telegram group is blocked");
        }

        // 4. Photo / video viewer.
        if (mediaViewer && (cfg.blockAllMedia || (cfg.blockMedia && isRecentlyFlagged()))) {
            return Verdict.yes("Telegram media blocked");
        }

        return Verdict.no();
    }

    private static void flag() {
        lastAdultHitAt = android.os.SystemClock.elapsedRealtime();
    }

    private static String trim(String s) {
        String t = s.trim().replaceAll("\\s+", " ");
        return t.length() > 40 ? t.substring(0, 40) + "…" : t;
    }

    private static void collect(AccessibilityNodeInfo node, int depth, List<String> out) {
        if (node == null || depth > MAX_DEPTH || out.size() >= MAX_NODES) return;
        try {
            if (node.isPassword()) return;
            CharSequence text = node.getText();
            if (text != null && text.length() > 0) out.add(text.toString());
            CharSequence desc = node.getContentDescription();
            if (desc != null && desc.length() > 0) out.add(desc.toString());
            for (int i = 0; i < node.getChildCount(); i++) {
                collect(node.getChild(i), depth + 1, out);
            }
        } catch (Throwable ignored) {}
    }
}

