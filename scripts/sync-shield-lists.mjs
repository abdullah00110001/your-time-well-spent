// Mirrors the Shield block-list text assets from the Android assets folder
// (source of truth) into `public/shield/` so the webview can fetch them at
// runtime — on web and offline inside the Capacitor app.
//
// Run after editing any list: `node scripts/sync-shield-lists.mjs`

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';

const SRC = 'android/app/src/main/assets/';
const DEST = 'public/shield/';

const FILES = [
  'adult_sites_seed.txt',
  'mirror_suffixes.txt',
  'mirror_tlds.txt',
  'bn_keywords.txt',
  'adult_keywords.txt',
];

mkdirSync(DEST, { recursive: true });

let copied = 0;
for (const file of FILES) {
  if (!existsSync(SRC + file)) {
    console.warn(`skip (missing): ${SRC}${file}`);
    continue;
  }
  copyFileSync(SRC + file, DEST + file);
  copied++;
}

console.log(`shield lists synced: ${copied}/${FILES.length}`);
