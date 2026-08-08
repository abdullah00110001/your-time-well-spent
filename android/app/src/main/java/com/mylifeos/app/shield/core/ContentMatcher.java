package com.mylifeos.app.shield.core;

import android.text.TextUtils;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Static, unit-testable text/host matching utility used by the Shield accessibility
 * pipeline. Deliberately has no Android dependency beyond android.text.TextUtils so it
 * can be exercised in plain JUnit tests.
 *
 * Goals:
 *  - Defeat trivial obfuscation (leetspeak, diacritics, zero-width chars, repeated chars,
 *    cyrillic look-alikes) without becoming so aggressive that legitimate words collide.
 *  - Never use naive contains() for keyword/domain matching — always word-boundary /
 *    dot-boundary matching to avoid false positives like "essexcollege" or
 *    "sex education" on Wikipedia.
 */
public final class ContentMatcher {

    private ContentMatcher() {}

    /** Sensitivity controls how many distinct keyword hits are required to trigger a block. */
    public enum Sensitivity {
        /** Any single keyword hit blocks, even on allowlisted educational/health domains. */
        STRICT,
        /** Single hit blocks, but allowlisted domains suppress keyword-only triggers. */
        BALANCED,
        /** Requires >= 2 distinct keyword hits before triggering; allowlist suppresses. */
        LENIENT
    }

    // Zero-width / invisible / bidi control characters commonly used to break up words.
    private static final Pattern INVISIBLE_CHARS = Pattern.compile(
        "[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF\\u00AD]");

    // Collapse 3+ repeated identical characters down to 2 ("poooorn" -> "poorn").
    private static final Pattern REPEATED_CHARS = Pattern.compile("(.)\\1{2,}");

    // Cyrillic / Greek homoglyphs mapped to their latin look-alike before leet mapping.
    private static final String HOMOGLYPH_SRC =
        "аеорсхуkіΑΒΕΗΙΚΜΝΟΡΤΧΥаеорсух";
    private static final String HOMOGLYPH_DST =
        "aeopcxykiabehikmnoptxyaeopcyx";

    /**
     * Normalizes text for keyword matching: lowercases, strips diacritics/invisible chars,
     * maps homoglyphs + leetspeak substitutions to their base latin letters, and collapses
     * repeated characters.
     */
    public static String normalize(String input) {
        if (TextUtils.isEmpty(input)) return "";

        String s = input.toLowerCase(Locale.ROOT);

        // NFKD decompose then strip combining marks (diacritics).
        s = Normalizer.normalize(s, Normalizer.Form.NFKD);
        StringBuilder noDiacritics = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            int type = Character.getType(c);
            if (type != Character.NON_SPACING_MARK) noDiacritics.append(c);
        }
        s = noDiacritics.toString();

        // Strip zero-width / invisible / bidi control characters.
        s = INVISIBLE_CHARS.matcher(s).replaceAll("");

        // Map common homoglyphs to their latin equivalent.
        StringBuilder homo = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            int idx = HOMOGLYPH_SRC.indexOf(c);
            homo.append(idx >= 0 ? HOMOGLYPH_DST.charAt(idx) : c);
        }
        s = homo.toString();

        // Leetspeak substitution.
        StringBuilder leet = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '0': leet.append('o'); break;
                case '1': leet.append('i'); break;
                case '3': leet.append('e'); break;
                case '4': leet.append('a'); break;
                case '5': leet.append('s'); break;
                case '7': leet.append('t'); break;
                case '@': leet.append('a'); break;
                case '$': leet.append('s'); break;
                default: leet.append(c);
            }
        }
        s = leet.toString();

        // Collapse repeated characters (poooorn -> poorn) — do this last so leet mapping
        // above already normalized digits/symbols.
        s = REPEATED_CHARS.matcher(s).replaceAll("$1$1");

        return s;
    }

    /**
     * Word-boundary keyword matching against normalized text. Returns true if ANY keyword
     * matches as a whole word/token — never a naive substring match.
     */
    public static boolean matchesKeyword(String text, Set<String> keywords) {
        return findKeywordHits(text, keywords).size() > 0;
    }

    /** Returns the distinct set of keywords that hit, using word-boundary matching. */
    public static Set<String> findKeywordHits(String text, Set<String> keywords) {
        Set<String> hits = new HashSet<>();
        if (TextUtils.isEmpty(text) || keywords == null || keywords.isEmpty()) return hits;
        String normalizedText = normalize(text);
        if (normalizedText.isEmpty()) return hits;

        for (String rawKeyword : keywords) {
            if (rawKeyword == null || rawKeyword.trim().isEmpty()) continue;
            String kw = normalize(rawKeyword);
            if (kw.isEmpty()) continue;
            if (hasWordBoundaryMatch(normalizedText, kw)) hits.add(rawKeyword);
        }
        return hits;
    }

    /** Manual boundary check: keyword must not be immediately preceded/followed by a letter/digit. */
    private static boolean hasWordBoundaryMatch(String normalizedText, String normalizedKeyword) {
        int from = 0;
        while (true) {
            int idx = normalizedText.indexOf(normalizedKeyword, from);
            if (idx == -1) return false;
            boolean leftOk = idx == 0 || !isWordChar(normalizedText.charAt(idx - 1));
            int endIdx = idx + normalizedKeyword.length();
            boolean rightOk = endIdx >= normalizedText.length() || !isWordChar(normalizedText.charAt(endIdx));
            if (leftOk && rightOk) return true;
            from = idx + 1;
        }
    }

    private static boolean isWordChar(char c) {
        return Character.isLetterOrDigit(c);
    }

    /**
     * Applies a sensitivity policy on top of matchesKeyword/findKeywordHits: decides whether
     * enough distinct keyword hits occurred, and whether the allowlist should suppress the
     * result for a given host (host may be null if not applicable, e.g. typed text).
     */
    public static boolean shouldBlockByKeyword(String text, Set<String> keywords, String host, Sensitivity sensitivity) {
        Set<String> hits = findKeywordHits(text, keywords);
        if (hits.isEmpty()) return false;

        boolean allowlisted = host != null && isAllowlistedHost(host);

        switch (sensitivity) {
            case STRICT:
                // Strict never respects the allowlist for keyword hits.
                return true;
            case LENIENT:
                if (allowlisted) return false;
                return hits.size() >= 2;
            case BALANCED:
            default:
                if (allowlisted) return false;
                return hits.size() >= 1;
        }
    }

    /**
     * Cleans a raw URL/host string down to a bare host: strips scheme, "www.", port, path,
     * query, and fragment.
     */
    public static String cleanHost(String rawUrlOrHost) {
        if (TextUtils.isEmpty(rawUrlOrHost)) return "";
        String s = rawUrlOrHost.trim().toLowerCase(Locale.ROOT);
        s = s.replaceFirst("^[a-z][a-z0-9+.-]*://", ""); // strip scheme
        // drop path/query/fragment
        int cut = indexOfAny(s, '/', '?', '#');
        if (cut >= 0) s = s.substring(0, cut);
        // drop userinfo
        int at = s.indexOf('@');
        if (at >= 0) s = s.substring(at + 1);
        // drop port (but keep IPv6 brackets intact)
        if (!s.startsWith("[")) {
            int colon = s.indexOf(':');
            if (colon >= 0) s = s.substring(0, colon);
        }
        if (s.startsWith("www.")) s = s.substring(4);
        return s;
    }

    private static int indexOfAny(String s, char... chars) {
        for (int i = 0; i < s.length(); i++) {
            for (char c : chars) if (s.charAt(i) == c) return i;
        }
        return -1;
    }

    /**
     * Proper host matching: exact equality or suffix match on a dot boundary. Never a
     * substring match (so "notxvideos.com.evil.tld" or "xvideos.com.fake.net" tricks fail
     * appropriately, and "myxvideos.com" won't false-match "videos.com").
     */
    public static boolean matchesDomain(String host, Iterable<String> patterns) {
        if (TextUtils.isEmpty(host) || patterns == null) return false;
        String cleanedHost = cleanHost(host);
        if (cleanedHost.isEmpty()) return false;
        for (String pattern : patterns) {
            if (pattern == null || pattern.trim().isEmpty()) continue;
            String p = cleanHost(pattern);
            if (p.isEmpty()) continue;
            if (cleanedHost.equals(p) || cleanedHost.endsWith("." + p)) return true;
        }
        return false;
    }

    public static boolean matchesDomainSingle(String host, String pattern) {
        Set<String> single = new HashSet<>();
        single.add(pattern);
        return matchesDomain(host, single);
    }

    // ==========================================
    // Allowlist — suppresses keyword-only blocks on known-safe educational/health/SERP hosts.
    // Explicit domain blocklist entries always win regardless of this allowlist.
    // ==========================================
    private static final Set<String> ALLOWLISTED_HOSTS = new HashSet<>();
    static {
        ALLOWLISTED_HOSTS.add("wikipedia.org");
        ALLOWLISTED_HOSTS.add("wikimedia.org");
        ALLOWLISTED_HOSTS.add("who.int");
        ALLOWLISTED_HOSTS.add("nhs.uk");
        ALLOWLISTED_HOSTS.add("mayoclinic.org");
        ALLOWLISTED_HOSTS.add("plannedparenthood.org");
        ALLOWLISTED_HOSTS.add("webmd.com");
        ALLOWLISTED_HOSTS.add("healthline.com");
        ALLOWLISTED_HOSTS.add("cdc.gov");
        ALLOWLISTED_HOSTS.add("nih.gov");
        ALLOWLISTED_HOSTS.add("medlineplus.gov");
        ALLOWLISTED_HOSTS.add("khanacademy.org");
        ALLOWLISTED_HOSTS.add("britannica.com");
        // Search-engine result pages themselves are not adult content; the pages they
        // link to are checked independently when navigated to.
        ALLOWLISTED_HOSTS.add("google.com");
        ALLOWLISTED_HOSTS.add("bing.com");
        ALLOWLISTED_HOSTS.add("duckduckgo.com");
    }

    public static boolean isAllowlistedHost(String host) {
        return matchesDomain(host, ALLOWLISTED_HOSTS);
    }

    /** Allows callers (e.g. tests, or admin config) to extend the allowlist at runtime. */
    public static void addAllowlistedHost(String host) {
        String cleaned = cleanHost(host);
        if (!cleaned.isEmpty()) ALLOWLISTED_HOSTS.add(cleaned);
    }
}
