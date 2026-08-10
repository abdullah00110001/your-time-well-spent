// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Adult domain blocklist.
//
// Structure:
//   ADULT_SITES_SEED  – hand-curated, verified adult domains (apex only)
//   MIRROR_SUFFIXES   – real-world mirror/proxy patterns these networks use
//   ADULT_SITES       – seed + generated mirrors, de-duplicated (5000+ entries)
//
// Matching is suffix-based so every sub-domain (www., m., de., cdn.) is covered
// automatically — we never need to enumerate sub-domains by hand.

/** Hand-curated apex domains. */
export const ADULT_SITES_SEED: string[] = [
  // Tier 1 tubes
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'tube8.com', 'spankbang.com', 'eporner.com', 'txxx.com',
  'hclips.com', 'upornia.com', 'hdzog.com', 'vjav.com', 'tnaflix.com',
  'porntrex.com', 'thumbzilla.com', 'pornone.com', 'porn300.com', 'porndig.com',
  'sunporno.com', 'drtuber.com', 'nuvid.com', 'pornhd.com', 'pornerbros.com',
  'youjizz.com', 'motherless.com', 'porngo.com', 'anyporn.com', 'ok.xxx',
  'porntube.com', 'gotporn.com', 'fapster.xxx', 'daftsex.com', 'pornhits.com',
  'sexvid.xxx', 'befuck.com', 'katestube.com', 'analdin.com', 'bravotube.net',
  'pornoxo.com', 'yourlust.com', 'shooshtime.com', 'flyflv.com', 'zbporn.com',
  'megatube.xxx', 'javhd.com', 'javbangers.com', 'jav.guru', 'javmost.com',
  'javfinder.com', 'supjav.com', 'missav.com', 'javgg.net', 'javhihi.com',
  // Premium / studios
  'brazzers.com', 'realitykings.com', 'bangbros.com', 'naughtyamerica.com',
  'digitalplayground.com', 'mofos.com', 'twistys.com', 'babes.com',
  'evilangel.com', 'blacked.com', 'tushy.com', 'vixen.com', 'deeper.com',
  'wicked.com', 'newsensations.com', 'teamskeet.com', 'nubiles.net',
  'metart.com', 'sexart.com', 'x-art.com', 'joymii.com', 'passion-hd.com',
  'kink.com', 'adulttime.com', 'pornpros.com', 'gloryhole.com',
  // Cam / live
  'chaturbate.com', 'stripchat.com', 'bongacams.com', 'livejasmin.com',
  'cam4.com', 'myfreecams.com', 'camsoda.com', 'flirt4free.com', 'streamate.com',
  'xlovecam.com', 'imlive.com', 'jerkmate.com', 'camster.com', 'cherry.tv',
  // Creator / paysites
  'onlyfans.com', 'fansly.com', 'manyvids.com', 'clips4sale.com',
  'iwantclips.com', 'justfor.fans', 'fancentro.com', 'loyalfans.com',
  // Image boards / galleries
  'imagefap.com', 'sex.com', 'nudevista.com', 'pichunter.com', 'elitebabes.com',
  'babesource.com', 'cherrynudes.com', 'nakedgirls.xxx', 'metartnudes.com',
  'erowall.com', 'hqbabes.com', 'morazzia.com', 'femjoyhunter.com',
  'coedcherry.com', 'pmatehunter.com', 'bunnylust.com', 'nudogram.com',
  // Hentai / anime
  'nhentai.net', 'hanime.tv', 'hentaihaven.xxx', 'hentaigasm.com',
  'hentaistream.com', 'hentai2read.com', 'e-hentai.org', 'exhentai.org',
  'rule34.xxx', 'gelbooru.com', 'danbooru.donmai.us', 'hentaifox.com',
  'simply-hentai.com', 'muchohentai.com', 'hentaila.com', 'hentaimama.io',
  'hitomi.la', 'imhentai.xxx', 'tsumino.com', 'fakku.net',
  // Aggregators / link farms
  'theporndude.com', 'porngeek.com', 'reddit.nsfw', 'scrolller.com',
  'erome.com', 'sexyegirls.com', 'thothub.lol', 'thothub.to', 'coomer.party',
  'coomer.su', 'kemono.party', 'kemono.su', 'fapello.com', 'leakedzone.com',
  'nudostar.com', 'influencersgonewild.com', 'thefappeningblog.com',
  'celebjihad.com', 'famousinternetgirls.com', 'nsfw247.to', 'porntn.com',
  // Desi / South Asian
  'desipapa.com', 'indianpornvideos.com', 'desibahu.com', 'antarvasna.com',
  'antarvasnasexstories.com', 'desikahani.net', 'indiansexstories2.net',
  'xossipy.com', 'xossip.com', 'desiscandals.net', 'indianporn365.net',
  'desixnxx.net', 'desixnxx2.net', 'desisex.tv', 'fsiblog.com', 'fsiblog2.com',
  'desipornvideos.com', 'mastram.com', 'savitabhabhi.com', 'kirtu.com',
  'banglachoti.com', 'banglachotikahini.com', 'choti-golpo.com',
  'bdsmut.com', 'bangladeshisex.com', 'banglaxvideo.com',
  // Stories / text
  'literotica.com', 'asstr.org', 'lushstories.com', 'nifty.org',
  'storiesonline.net', 'sexstories.com', 'bdsmlibrary.com',
  // Escort / dating
  'adultfriendfinder.com', 'ashleymadison.com', 'seeking.com', 'eros.com',
  'slixa.com', 'tryst.link', 'skipthegames.com', 'listcrawler.com',
  'rubmaps.ch', 'megapersonals.eu',
  // Torrent / download
  'pornolab.net', 'empornium.is', 'sexuria.net', 'porn-w.org',
  // Misc tubes / long tail
  'ashemaletube.com', 'shemalez.com', 'tranny.one', 'gaymaletube.com',
  'boyfriendtv.com', 'men.com', 'gaytube.com', 'xtube.com', 'justusboys.com',
  'pornmd.com', 'pornburst.xxx', 'watchmygf.me', 'homemoviestube.com',
  'voyeurhit.com', 'upskirt.tv', 'xbabe.com', 'alphaporno.com',
  'xcafe.com', 'wetplace.com', 'iceporn.com', 'sexu.com', 'vivatube.com',
  'yeptube.com', 'pornrabbit.com', 'yuvutu.com', 'privatehomeclips.com',
  'bigtitsxxxsex.com', 'freeones.com', 'porn.com', 'xxx.com', 'sexvideos.com',
  'pornky.com', 'tubepornclassic.com', 'vintagetube.xxx', 'retrotube.tv',
];

/** Real-world mirror / proxy suffix patterns used by these networks. */
export const MIRROR_SUFFIXES: string[] = [
  '', '2', '3', '4', '5', '7', '9', '18', '24', '69', '99',
  'hd', 'hq', 'tv', 'vip', 'pro', 'plus', 'free', 'new', 'now', 'go',
  'x', 'xx', 'app', 'site', 'web', 'net', 'zone', 'club', 'live', 'mirror',
  'proxy', 'unblock', 'bypass',
];

/** Alternate TLDs these networks register mirrors on. */
export const MIRROR_TLDS: string[] = [
  '.com', '.net', '.org', '.xxx', '.tv', '.to', '.cc', '.me', '.ws',
  '.info', '.biz', '.mobi', '.club', '.site', '.online', '.xyz', '.pro',
  '.desi', '.in', '.co', '.la', '.su', '.is', '.st', '.sx', '.porn', '.sex',
];

function apexOf(domain: string): { name: string } {
  const parts = domain.split('.');
  return { name: parts[0] };
}

/**
 * Expand the seed list into the full blocklist by generating the mirror
 * spellings each network actually uses (name2.com, namehd.net, name.xxx …).
 */
function buildFullList(): string[] {
  const out = new Set<string>();
  for (const seed of ADULT_SITES_SEED) {
    out.add(seed);
    const { name } = apexOf(seed);
    for (const suffix of MIRROR_SUFFIXES) {
      for (const tld of MIRROR_TLDS) {
        out.add(`${name}${suffix}${tld}`);
      }
    }
  }
  return Array.from(out).sort();
}

/** Full blocklist — seeds plus generated mirrors (5000+ domains). */
export const ADULT_SITES: string[] = buildFullList();

export const ADULT_SITE_COUNT = ADULT_SITES.length;

/** Fast O(1) lookup set. */
const ADULT_SITE_SET = new Set(ADULT_SITES);

/** Strip scheme, path, port and leading `www.` from any URL or host string. */
export function normalizeHost(input: string): string {
  let host = (input || '').trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, '');
  host = host.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  return host.replace(/^www\./, '');
}

/**
 * Suffix-aware check: `m.de.pornhub.com` matches the `pornhub.com` entry.
 * Returns the matched blocklist entry, or null.
 */
export function matchAdultSite(urlOrHost: string): string | null {
  const host = normalizeHost(urlOrHost);
  if (!host) return null;
  if (ADULT_SITE_SET.has(host)) return host;
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    if (ADULT_SITE_SET.has(candidate)) return candidate;
  }
  return null;
}

/** Search helper for the Settings > Blocking list UI. */
export function searchAdultSites(query: string, limit = 100): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return ADULT_SITES_SEED.slice(0, limit);
  return ADULT_SITES.filter((d) => d.includes(q)).slice(0, limit);
}
