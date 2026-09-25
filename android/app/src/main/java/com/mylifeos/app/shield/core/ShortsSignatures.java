package com.mylifeos.app.shield.core;

import android.view.accessibility.AccessibilityNodeInfo;

/**
 * ShortsSignatures — ALL short-form-feed detection knowledge lives here.
 *
 * YouTube / Instagram / Facebook rename their internal view ids on almost every
 * app update, which is the single most common reason "block Shorts" silently
 * stops working. When that happens, ONLY this file needs updating — the
 * accessibility service just asks {@link #isShortFormFeed}.
 *
 * Detection is deliberately layered so no single fragile id can break it:
 *   1. resource-id fragments (fastest, most precise)
 *   2. content-description / text fragments (survives id renames)
 *   3. structural hint: a full-screen vertically-scrollable video pager
 */
public final class ShortsSignatures {

    private ShortsSignatures() {}

    /** Substrings matched against `getViewIdResourceName()` (lower-cased). */
    public static final String[] VIEW_ID_FRAGMENTS = {
        // YouTube Shorts (2023 → 2026 ids)
        "reel_recycler",
        "reel_player",
        "reel_progress",
        "reel_watch",
        "reel_time_bar",
        "shorts_player",
        "shorts_video_container",
        "shorts_while_watching",
        "id/reel_",
        // Instagram Reels
        "clips_viewer",
        "clips_video_container",
        "reels_tray",
        "reel_viewer",
        // Facebook Reels / Watch shorts
        "video_reels",
        "reels_viewer",
        "short_form_video",
        // Snapchat Spotlight
        "spotlight_",
    };

    /** Substrings matched against text / contentDescription (lower-cased). */
    public static final String[] LABEL_FRAGMENTS = {
        "shorts",
        "short video",
        "reel",
        "reels",
        "spotlight",
        "moj",
        "for you feed",
    };

    /**
     * Exact labels that only ever mean the feed itself (tab buttons, headers).
     * Kept separate because these are safe to match without extra structure.
     */
    public static final String[] EXACT_LABELS = {
        "shorts", "reels", "reel", "spotlight",
    };

    private static final int MAX_DEPTH = 14;

    /**
     * @return true when the current node tree looks like a short-form video feed.
     */
    public static boolean isShortFormFeed(AccessibilityNodeInfo root) {
        return scan(root, 0);
    }

    private static boolean scan(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > MAX_DEPTH) return false;

        String id = safeLower(node.getViewIdResourceName());
        if (id != null) {
            for (String frag : VIEW_ID_FRAGMENTS) {
                if (id.contains(frag)) return true;
            }
        }

        String text = safeLower(node.getText());
        String desc = safeLower(node.getContentDescription());

        // Exact tab/header labels — "Shorts", "Reels".
        for (String label : EXACT_LABELS) {
            if (text != null && text.trim().equals(label)) return true;
            if (desc != null && desc.trim().equals(label)) return true;
        }

        // Looser label match, only trusted when combined with a plausible
        // short-form container (avoids blocking a chat message saying "reel").
        if (looksLikeVerticalVideoPager(node)) {
            for (String frag : LABEL_FRAGMENTS) {
                if (text != null && text.contains(frag)) return true;
                if (desc != null && desc.contains(frag)) return true;
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            if (scan(node.getChild(i), depth + 1)) return true;
        }
        return false;
    }

    /** Structural fallback: scrollable pager-ish container. */
    private static boolean looksLikeVerticalVideoPager(AccessibilityNodeInfo node) {
        if (!node.isScrollable()) return false;
        CharSequence cls = node.getClassName();
        if (cls == null) return false;
        String c = cls.toString().toLowerCase();
        return c.contains("recyclerview") || c.contains("viewpager") || c.contains("pager");
    }

    private static String safeLower(CharSequence cs) {
        if (cs == null) return null;
        String s = cs.toString();
        return s.isEmpty() ? null : s.toLowerCase();
    }

    private static String safeLower(String s) {
        return s == null || s.isEmpty() ? null : s.toLowerCase();
    }
}
