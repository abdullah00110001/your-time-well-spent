// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Bengali + Banglish 18+ keyword blocklist.
// Used for URL scanning AND page-title / search-query scanning.
// Keep terms lowercase for the Banglish half; Bengali script has no case.

/** Core Bengali script terms. */
export const BN_KEYWORDS_CORE: string[] = [
  'সেক্স', 'সেক্স ভিডিও', 'সেক্সি', 'সেক্স করা', 'সেক্স গল্প', 'সেক্স কাহিনী',
  'পর্ন', 'পর্নো', 'পর্ন ভিডিও', 'পর্ন সাইট', 'পর্ন মুভি', 'পর্নোগ্রাফি',
  'নগ্ন', 'নগ্নতা', 'নগ্ন ছবি', 'নগ্ন ভিডিও', 'অর্ধনগ্ন',
  'উলঙ্গ', 'উলঙ্গ ছবি', 'উলঙ্গ ভিডিও', 'বিবস্ত্র', 'ন্যাংটা', 'ল্যাংটা',
  'চটি', 'চটি গল্প', 'চটির গল্প', 'বাংলা চটি', 'চটি বই', 'নতুন চটি',
  'ধর্ষণ', 'ধর্ষণ ভিডিও', 'গণধর্ষণ', 'ধর্ষিতা',
  'মাগী', 'মাগির', 'খানকি', 'খানকির', 'বেশ্যা', 'বেশ্যালয়', 'পতিতা', 'পতিতালয়',
  'ব্লু ফিল্ম', 'ব্লু ভিডিও', 'নীল ছবি', 'নীল ফিল্ম',
  'হট ভিডিও', 'হট ছবি', 'হট গার্ল', 'হট ভাবি', 'হট সিন',
  'চোদা', 'চোদাচুদি', 'চুদা', 'চুদাচুদি', 'চুদি', 'চোদন', 'চোদার',
  'গুদ', 'গুদের', 'ভোদা', 'ভোদার', 'দুধ টিপা', 'মাই টিপা', 'বুকের ছবি',
  'ল্যাওড়া', 'নুনু', 'ধোন', 'বাড়া',
  'বাংলা সেক্স', 'দেশি সেক্স', 'ইন্ডিয়ান সেক্স', 'ভাবি সেক্স', 'বৌদি সেক্স',
  'ভাবির ভিডিও', 'বৌদির ভিডিও', 'কাজের মেয়ে সেক্স',
  'অশ্লীল', 'অশ্লীল ভিডিও', 'অশ্লীল ছবি', 'অশ্লীলতা', 'কামুক', 'কামনা ভিডিও',
  'যৌন', 'যৌনতা', 'যৌন মিলন', 'যৌন ভিডিও', 'যৌন উত্তেজক', 'যৌনাঙ্গ',
  'সহবাস', 'সঙ্গম', 'রতিক্রিয়া', 'কামসূত্র',
  'স্তন', 'স্তনের ছবি', 'নিতম্ব', 'ব্রা খোলা', 'জামা খোলা',
  'গোপন ক্যামেরা', 'গোপন ভিডিও', 'লিক ভিডিও', 'ভাইরাল লিংক', 'ভাইরাল ভিডিও লিংক',
  'এমএমএস', 'এম এম এস ভিডিও', 'স্ক্যান্ডাল', 'স্ক্যান্ডাল ভিডিও',
  'কল গার্ল', 'এসকর্ট সার্ভিস', 'রাতের সঙ্গী', 'ডেটিং হট',
  'সেক্স চ্যাট', 'সেক্স ভিডিও কল', 'লাইভ সেক্স', 'ক্যাম গার্ল',
  'ভার্জিন ভিডিও', 'প্রথম রাত ভিডিও', 'বাসর রাত ভিডিও',
  'হস্তমৈথুন', 'বীর্য', 'অর্গাজম', 'উত্তেজক ভিডিও',
  'সমকামী ভিডিও', 'গে ভিডিও', 'লেসবিয়ান ভিডিও',
  'নায়িকার গোসল', 'গোসলের ভিডিও', 'গোপন গোসল',
  'বিকিনি ছবি', 'সেক্সি ছবি', 'সেক্সি ড্যান্স', 'হট ড্যান্স', 'নাচের হট ভিডিও',
  'আঠারো প্লাস', '১৮+', '১৮ প্লাস ভিডিও', '১৮+ গল্প', '১৮+ ছবি',
  'প্রাপ্তবয়স্ক ভিডিও', 'প্রাপ্তবয়স্কদের জন্য',
];

/** Banglish / romanised Bengali spellings (lowercase). */
export const BN_KEYWORDS_BANGLISH: string[] = [
  'choti', 'chotigolpo', 'choti golpo', 'bangla choti', 'chotibook', 'chotisex',
  'choda', 'chudai', 'chodachudi', 'chudachudi', 'chuda', 'chodon',
  'magi', 'magir', 'khanki', 'khankir', 'beshya', 'potita',
  'bangla sex', 'bangla xxx', 'bangla porn', 'bangla hot', 'bangladeshi sex',
  'desi sex', 'desi porn', 'desi mms', 'desi bhabi', 'bhabi sex', 'boudi sex',
  'bhabhi hot', 'boudi hot', 'nudi', 'nangta', 'lengta', 'ulongo',
  'gud', 'guder', 'voda', 'vodar', 'dudh tipa', 'mai tipa',
  'noyon sex', 'jouno', 'jouno milon', 'sohobas', 'shongom',
  'blue film bangla', 'nil chobi', 'hot video bangla', 'hot chobi',
  'ostilo video', 'oslil video', 'oslil chobi',
  'dhorson video', 'dhorshon', 'gonodhorshon',
  'call girl dhaka', 'escort dhaka', 'escort service bd',
  'live sex bangla', 'sex chat bangla', 'cam girl bangla',
  'mms bangla', 'scandal bangla', 'leaked video bangla', 'viral link bangla',
  'hostomoithun', 'birjo', 'orgasm bangla',
  'gay bangla video', 'lesbian bangla',
  'nayika gosol', 'gosol video', 'bikini chobi', 'sexy chobi', 'sexy dance bangla',
  '18 plus bangla', '18+ bangla', 'adult bangla', 'adult golpo', 'adult story bangla',
  'x video bangla', 'xnx bangla', 'xxx bangla video', 'bf video bangla',
];

/** Everything, de-duplicated. 200+ entries. */
export const BN_KEYWORDS: string[] = Array.from(
  new Set([...BN_KEYWORDS_CORE, ...BN_KEYWORDS_BANGLISH].map((k) => k.trim()).filter(Boolean)),
);

export const BN_KEYWORD_COUNT = BN_KEYWORDS.length;

/** Case/space-insensitive haystack test for URLs, titles and search queries. */
export function matchesBnKeyword(text: string): string | null {
  if (!text) return null;
  const hay = text.toLowerCase().replace(/[_\-+]+/g, ' ');
  for (const kw of BN_KEYWORDS) {
    if (hay.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

/** Search helper for the Settings > Blocking list UI. */
export function searchBnKeywords(query: string, limit = 100): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return BN_KEYWORDS.slice(0, limit);
  return BN_KEYWORDS.filter((k) => k.toLowerCase().includes(q)).slice(0, limit);
}
