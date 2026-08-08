package com.mylifeos.app.shield.core;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Unit tests for {@link ContentMatcher}.
 *
 * Focus: normalization (obfuscation defeat) and word-boundary matching, because those
 * two rules are what stop false-positive blocks on safe text like "essexcollege" or
 * "sex education" while still catching "p0rn" / "pörn" / zero-width-split words.
 *
 * Robolectric is used only because ContentMatcher calls android.text.TextUtils.
 */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 33)
public class ContentMatcherTest {

    private static Set<String> keywords(String... kw) {
        return new HashSet<>(Arrays.asList(kw));
    }

    // ─────────────────────────────────────────────────────────────
    // normalize()
    // ─────────────────────────────────────────────────────────────

    @Test
    public void normalize_nullAndEmpty_returnEmptyString() {
        assertEquals("", ContentMatcher.normalize(null));
        assertEquals("", ContentMatcher.normalize(""));
        assertEquals("", ContentMatcher.normalize("\u200B\uFEFF"));
    }

    @Test
    public void normalize_lowercases() {
        assertEquals("porn", ContentMatcher.normalize("PORN"));
        assertEquals("porn", ContentMatcher.normalize("PoRn"));
    }

    @Test
    public void normalize_stripsDiacritics() {
        assertEquals("porn", ContentMatcher.normalize("pörn"));
        assertEquals("porn", ContentMatcher.normalize("pórn"));
        assertEquals("naive", ContentMatcher.normalize("naïve"));
    }

    @Test
    public void normalize_stripsInvisibleAndBidiChars() {
        assertEquals("porn", ContentMatcher.normalize("p\u200Bo\u200Cr\u200Dn"));
        assertEquals("porn", ContentMatcher.normalize("po\u00ADrn"));
        assertEquals("porn", ContentMatcher.normalize("\u202Eporn\u202C"));
    }

    @Test
    public void normalize_mapsLeetspeak() {
        assertEquals("porn", ContentMatcher.normalize("p0rn"));
        assertEquals("sextape", ContentMatcher.normalize("$3xt4pe"));
        assertEquals("tits", ContentMatcher.normalize("717s"));
        assertEquals("anal", ContentMatcher.normalize("4n@l"));
    }

    @Test
    public void normalize_mapsCyrillicHomoglyphs() {
        // Cyrillic р (U+0440) and о (U+043E) look identical to latin p / o.
        assertEquals("porn", ContentMatcher.normalize("\u0440\u043Ern"));
        assertEquals("pop", ContentMatcher.normalize("\u0440o\u0440"));
        assertEquals("cxy", ContentMatcher.normalize("\u0441\u0445\u0443"));
    }

    @Test
    public void normalize_collapsesRepeatedCharsToTwo() {
        assertEquals("poorn", ContentMatcher.normalize("poooorn"));
        assertEquals("hell", ContentMatcher.normalize("hell"));
        assertEquals("aab", ContentMatcher.normalize("aaaaab"));
    }

    @Test
    public void normalize_isIdempotent() {
        String once = ContentMatcher.normalize("P\u200B0\u0155N");
        assertEquals(once, ContentMatcher.normalize(once));
    }

    // ─────────────────────────────────────────────────────────────
    // Word-boundary matching — the false-positive guard
    // ─────────────────────────────────────────────────────────────

    @Test
    public void matchesKeyword_doesNotMatchInsideLongerWord() {
        Set<String> kw = keywords("sex");
        assertFalse(ContentMatcher.matchesKeyword("essexcollege admissions", kw));
        assertFalse(ContentMatcher.matchesKeyword("Middlesex University", kw));
        assertFalse(ContentMatcher.matchesKeyword("sexagenarian", kw));
        assertFalse(ContentMatcher.matchesKeyword("homosexuality article", kw));
    }

    @Test
    public void matchesKeyword_matchesStandaloneToken() {
        Set<String> kw = keywords("sex");
        assertTrue(ContentMatcher.matchesKeyword("sex education", kw));
        assertTrue(ContentMatcher.matchesKeyword("safe sex", kw));
        assertTrue(ContentMatcher.matchesKeyword("SEX!", kw));
        assertTrue(ContentMatcher.matchesKeyword("(sex)", kw));
        assertTrue(ContentMatcher.matchesKeyword("sex", kw));
    }

    @Test
    public void matchesKeyword_boundaryHonoursPunctuationAndUnderscoreDigits() {
        Set<String> kw = keywords("porn");
        assertTrue(ContentMatcher.matchesKeyword("free-porn-videos", kw));
        assertTrue(ContentMatcher.matchesKeyword("watch porn.now", kw));
        assertFalse(ContentMatcher.matchesKeyword("pornographyx", kw));
        assertFalse(ContentMatcher.matchesKeyword("1porn2", kw));
    }

    @Test
    public void matchesKeyword_findsObfuscatedStandaloneToken() {
        Set<String> kw = keywords("porn");
        assertTrue(ContentMatcher.matchesKeyword("free p0rn here", kw));
        assertTrue(ContentMatcher.matchesKeyword("free pörn here", kw));
        assertTrue(ContentMatcher.matchesKeyword("free p\u200Born here", kw));
        assertTrue(ContentMatcher.matchesKeyword("free \u0440\u043Ern here", kw));
    }

    @Test
    public void matchesKeyword_multiWordKeywordIsSupported() {
        Set<String> kw = keywords("adult video");
        assertTrue(ContentMatcher.matchesKeyword("best adult video site", kw));
        assertFalse(ContentMatcher.matchesKeyword("adult education video", kw));
    }

    @Test
    public void matchesKeyword_emptyInputsNeverMatch() {
        assertFalse(ContentMatcher.matchesKeyword("", keywords("sex")));
        assertFalse(ContentMatcher.matchesKeyword(null, keywords("sex")));
        assertFalse(ContentMatcher.matchesKeyword("sex", null));
        assertFalse(ContentMatcher.matchesKeyword("sex", Collections.<String>emptySet()));
        // Blank/whitespace keywords must not match everything.
        assertFalse(ContentMatcher.matchesKeyword("perfectly safe text", keywords("", "   ")));
    }

    @Test
    public void findKeywordHits_returnsOriginalKeywordSpellingAndDistinctCount() {
        Set<String> kw = keywords("porn", "sex", "nude");
        Set<String> hits = ContentMatcher.findKeywordHits("p0rn and nude pics", kw);
        assertEquals(2, hits.size());
        assertTrue(hits.contains("porn"));
        assertTrue(hits.contains("nude"));
        assertFalse(hits.contains("sex"));
    }

    @Test
    public void findKeywordHits_repeatedSameKeywordCountsOnce() {
        Set<String> hits = ContentMatcher.findKeywordHits("porn porn porn", keywords("porn"));
        assertEquals(1, hits.size());
    }

    // ─────────────────────────────────────────────────────────────
    // Sensitivity policy + allowlist
    // ─────────────────────────────────────────────────────────────

    @Test
    public void shouldBlock_strictIgnoresAllowlist() {
        assertTrue(ContentMatcher.shouldBlockByKeyword(
            "sex education", keywords("sex"), "en.wikipedia.org", ContentMatcher.Sensitivity.STRICT));
    }

    @Test
    public void shouldBlock_balancedSuppressesOnAllowlistedHost() {
        assertFalse(ContentMatcher.shouldBlockByKeyword(
            "sex education", keywords("sex"), "en.wikipedia.org", ContentMatcher.Sensitivity.BALANCED));
        assertTrue(ContentMatcher.shouldBlockByKeyword(
            "sex education", keywords("sex"), "randomtube.example", ContentMatcher.Sensitivity.BALANCED));
    }

    @Test
    public void shouldBlock_lenientRequiresTwoDistinctHits() {
        Set<String> kw = keywords("porn", "nude");
        assertFalse(ContentMatcher.shouldBlockByKeyword(
            "porn", kw, "randomtube.example", ContentMatcher.Sensitivity.LENIENT));
        assertTrue(ContentMatcher.shouldBlockByKeyword(
            "porn nude", kw, "randomtube.example", ContentMatcher.Sensitivity.LENIENT));
    }

    @Test
    public void shouldBlock_noHitsNeverBlocksEvenInStrict() {
        assertFalse(ContentMatcher.shouldBlockByKeyword(
            "essexcollege admissions", keywords("sex"), null, ContentMatcher.Sensitivity.STRICT));
    }

    @Test
    public void shouldBlock_nullHostIsTreatedAsNotAllowlisted() {
        assertTrue(ContentMatcher.shouldBlockByKeyword(
            "porn", keywords("porn"), null, ContentMatcher.Sensitivity.BALANCED));
    }

    // ─────────────────────────────────────────────────────────────
    // Host cleaning + domain matching (dot-boundary, never substring)
    // ─────────────────────────────────────────────────────────────

    @Test
    public void cleanHost_stripsSchemePortPathAndWww() {
        assertEquals("example.com", ContentMatcher.cleanHost("https://www.example.com:8443/a/b?c=1#d"));
        assertEquals("example.com", ContentMatcher.cleanHost("EXAMPLE.com"));
        assertEquals("example.com", ContentMatcher.cleanHost("http://user:pw@example.com/path"));
        assertEquals("", ContentMatcher.cleanHost(null));
    }

    @Test
    public void matchesDomain_exactAndSubdomainOnly() {
        Set<String> patterns = keywords("xvideos.com");
        assertTrue(ContentMatcher.matchesDomain("xvideos.com", patterns));
        assertTrue(ContentMatcher.matchesDomain("https://m.xvideos.com/watch", patterns));
        assertFalse(ContentMatcher.matchesDomain("notxvideos.com", patterns));
        assertFalse(ContentMatcher.matchesDomain("xvideos.com.evil.tld", patterns));
        assertFalse(ContentMatcher.matchesDomain("myxvideos.community", patterns));
    }

    @Test
    public void allowlist_knownSafeHostsAndRuntimeAdditions() {
        assertTrue(ContentMatcher.isAllowlistedHost("https://en.wikipedia.org/wiki/Sex"));
        assertTrue(ContentMatcher.isAllowlistedHost("www.nhs.uk"));
        assertFalse(ContentMatcher.isAllowlistedHost("randomtube.example"));

        ContentMatcher.addAllowlistedHost("https://school.example/");
        assertTrue(ContentMatcher.isAllowlistedHost("portal.school.example"));
    }
}
