#!/usr/bin/env node
/**
 * apply_n2r_reboot_fix.mjs
 *
 * Fixes the Sleep-to-Rise reboot: opening a blocked app during a lock could
 * flash the block screen repeatedly and crash the device. Root cause: after
 * NightToRiseBlockActivity launched successfully, BlockEnforcer ALSO
 * unconditionally scheduled a second, independent overlay 450ms later
 * ("just in case"), regardless of whether the Activity was already showing.
 * Two full-screen surfaces landing on top of each other, with no
 * duplicate-instance guard on the Activity to stop it re-building itself in
 * a loop, produced the same class of rapid WindowManager churn that has
 * caused a reboot in this app before (see ForegroundGuardService's own
 * SAFETY-CRITICAL comment about its sync() fix).
 *
 * Three changes, all mirroring what ShieldBlockActivity / presentShield
 * already do safely:
 *   1. BlockEnforcer.launchBlockScreen(): stop scheduling the second overlay
 *      after a successful Activity launch. One presentation path, like Shield.
 *   2. NightToRiseBlockActivity: duplicate-instance guard + a rebind-loop
 *      breaker (mirrors ShieldBlockActivity's sInstanceActive / loop-breaker,
 *      including the ownsInstance fix so a rejected duplicate can't clear
 *      the flag out from under the real instance).
 *   3. BlockingOverlay.renderNightCard(): the same 30s failsafe Shield's
 *      card already has, reusing the existing cardHandler/CARD_FAILSAFE_MS.
 *
 * None of the emergency-unlock / kill-switch / strict-wait / allowed-chip /
 * keyword / site logic is touched by this script.
 *
 *   node apply_n2r_reboot_fix.mjs            install
 *   node apply_n2r_reboot_fix.mjs --check    verify only
 *   node apply_n2r_reboot_fix.mjs --dry-run  show the plan, write nothing
 *   node apply_n2r_reboot_fix.mjs --build    install, then Gradle/tsc check
 *   node apply_n2r_reboot_fix.mjs --rollback restore the newest backup
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const J = 'android/app/src/main/java/com/mylifeos/app';
const MARK = '[N2R-REBOOT-FIX]';
const BACKUP_ROOT = path.join(ROOT, '.n2r_reboot_fix_backup');

const ok = (m) => console.log('  \u2713 ' + m);
const bad = (m) => console.log('  \u2717 ' + m);
const info = (m) => console.log(m);
const abs = (rel) => path.join(ROOT, ...rel.split('/'));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const L = (lines) => lines.join('\n');

function readText(rel) {
  const raw = fs.readFileSync(abs(rel)).toString('utf8');
  const crlf = raw.includes('\r\n');
  return { text: raw.replace(/\r\n/g, '\n'), crlf };
}
function writeText(rel, text, crlf) {
  const out = crlf ? text.replace(/\n/g, '\r\n') : text;
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), out, 'utf8');
}
function count(hay, needle) {
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

const PATCHES = [
  {
    file: `${J}/shield/core/BlockEnforcer.java`,
    edits: [
      {
        find: L([
          '        if (com.mylifeos.app.shield.ShieldAccessibilityService.launchBlockActivity(i)) {',
          '            lastError = null;',
          '            // startActivity() can return normally while Android silently denies the',
          '            // background launch. Present an accessibility overlay shortly after as',
          '            // the guaranteed fallback; a successfully-created activity dismisses it.',
          '            com.mylifeos.app.shield.ShieldAccessibilityService.scheduleBlockingOverlay(',
          '                sleepToRise, rise, title, body, leaveApp);',
          '            return true;',
          '        }',
        ]),
        replace: L([
          '        // ' + MARK + ' Same rule as Shield\'s presentShield(): a successful',
          '        // presentation stops here. The old code ALSO scheduled a "just in',
          '        // case" BlockingOverlay 450ms after a successful Activity launch,',
          '        // unconditionally \u2014 even when the Activity was already on screen.',
          '        // That put two full-screen surfaces on top of each other on every',
          '        // single block, which is what was actually causing the repeated',
          '        // flashing and, almost certainly, the reboot: WindowManager churn',
          '        // this rapid is the same failure class already documented and fixed',
          '        // once before in ForegroundGuardService (see its SAFETY-CRITICAL',
          '        // comment). dismissBlockingOverlay() cannot cancel this scheduled',
          '        // call \u2014 it can only hide a view that already exists \u2014 so the',
          '        // Activity had no way to prevent it.',
          '        if (com.mylifeos.app.shield.ShieldAccessibilityService.launchBlockActivity(i)) {',
          '            lastError = null;',
          '            return true;',
          '        }',
        ]),
      },
    ],
  },
  {
    file: `${J}/shield/core/BlockingOverlay.java`,
    edits: [
      {
        find: L([
          '            wm.addView(outer, lp);',
          '            activeView = outer;',
          '            activeWindowManager = wm;',
          '            return true;',
        ]),
        replace: L([
          '            wm.addView(outer, lp);',
          '            activeView = outer;',
          '            activeWindowManager = wm;',
          '',
          '            // ' + MARK + ' Same safety valve Shield\'s card already has: this',
          '            // surface can never stay on screen forever, no matter what triggered it.',
          '            final View shown = outer;',
          '            cardHandler.postDelayed(() -> {',
          '                synchronized (BlockingOverlay.class) {',
          '                    if (activeView == shown) hide();',
          '                }',
          '            }, CARD_FAILSAFE_MS);',
          '            return true;',
        ]),
      },
    ],
  },
  {
    file: `${J}/nighttorise/NightToRiseBlockActivity.java`,
    edits: [
      {
        find: L([
          '    private static final int KILL_TAP_COUNT = 7;',
        ]),
        replace: L([
          '    // ' + MARK + ' Same loop-breaker ShieldBlockActivity already has. Without',
          '    // this, a re-bind triggered from onResume() (e.g. because a stray overlay',
          '    // briefly stole and returned focus) had no ceiling \u2014 bind() rebuilds the',
          '    // whole card (fresh gradients, fresh animator) every single call.',
          '    private static final int MAX_REBINDS_IN_WINDOW = 5;',
          '    private static final long REBIND_WINDOW_MS = 10_000;',
          '    private final java.util.ArrayDeque<Long> recentBinds = new java.util.ArrayDeque<>();',
          '',
          '    /** Guards against a second instance of this activity stacking on top of itself. */',
          '    private static volatile boolean sInstanceActive = false;',
          '    /** True only for the instance that set sInstanceActive; a rejected duplicate must not clear it. */',
          '    private boolean ownsInstance = false;',
          '',
          '    private static final int KILL_TAP_COUNT = 7;',
        ]),
      },
      {
        find: L([
          '    protected void onCreate(Bundle savedInstanceState) {',
          '        super.onCreate(savedInstanceState);',
          '        ShieldAccessibilityService.dismissBlockingOverlay();',
        ]),
        replace: L([
          '    protected void onCreate(Bundle savedInstanceState) {',
          '        super.onCreate(savedInstanceState);',
          '        // ' + MARK + ' Don\'t stack a second instance on top of an existing one.',
          '        if (sInstanceActive) {',
          '            finish();',
          '            return;',
          '        }',
          '        sInstanceActive = true;',
          '        ownsInstance = true;',
          '        ShieldAccessibilityService.dismissBlockingOverlay();',
        ]),
      },
      {
        find: L([
          '    private void bind(Intent intent) {',
          '        String message = intent != null ? intent.getStringExtra(EXTRA_MESSAGE) : null;',
        ]),
        replace: L([
          '    private void bind(Intent intent) {',
          '        // ' + MARK + ' Loop breaker: bind() rebuilds the entire card (fresh',
          '        // gradients + animator) every call. If something keeps re-triggering it',
          '        // faster than a person could possibly be reacting, stop rebuilding and',
          '        // just leave \u2014 BlockEnforcer\'s own dedupe/cooldown will re-present',
          '        // cleanly afterwards if the lock is still active.',
          '        long rebindAt = System.currentTimeMillis();',
          '        recentBinds.addLast(rebindAt);',
          '        while (!recentBinds.isEmpty() && rebindAt - recentBinds.peekFirst() > REBIND_WINDOW_MS) {',
          '            recentBinds.pollFirst();',
          '        }',
          '        if (recentBinds.size() > MAX_REBINDS_IN_WINDOW) {',
          '            broke = true;',
          '            goHome();',
          '            return;',
          '        }',
          '',
          '        String message = intent != null ? intent.getStringExtra(EXTRA_MESSAGE) : null;',
        ]),
      },
      {
        find: L([
          '    protected void onDestroy() {',
          '        if (timer != null) timer.cancel();',
          '        if (strictTimer != null) strictTimer.cancel();',
          '        super.onDestroy();',
          '    }',
        ]),
        replace: L([
          '    protected void onDestroy() {',
          '        if (timer != null) timer.cancel();',
          '        if (strictTimer != null) strictTimer.cancel();',
          '        if (ownsInstance) {',
          '            sInstanceActive = false;',
          '            ownsInstance = false;',
          '        }',
          '        super.onDestroy();',
          '    }',
        ]),
      },
    ],
  },
];

const UNTOUCHED = [
  `${J}/nighttorise/NightToRiseManager.java`,
  `${J}/nighttorise/NightToRiseDecider.java`,
  `${J}/nighttorise/NightToRisePreferences.java`,
  `${J}/nighttorise/GuardTransitionNotifier.java`,
  `${J}/nighttorise/NightToRiseBlockCard.java`,
  `${J}/shield/core/ForegroundGuardService.java`,
  `${J}/shield/core/BlockLoopGuard.java`,
  `${J}/shield/core/ShieldBlockCard.java`,
  `${J}/shield/ShieldBlockActivity.java`,
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/res/values/styles.xml',
];

function stripJava(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      out += '""'; continue;
    }
    out += c;
  }
  return out;
}
function balanced(src) {
  const s = stripJava(src);
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const close = new Set(Object.values(pairs));
  const stack = [];
  for (const ch of s) {
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (close.has(ch)) { if (stack.pop() !== ch) return false; }
  }
  return stack.length === 0;
}

function verify() {
  let failures = 0;
  const check = (cond, okMsg, badMsg) => { if (cond) ok(okMsg); else { bad(badMsg || okMsg); failures++; } };
  const get = (rel) => { try { return readText(rel).text; } catch { return null; } };

  info('\nChecking installed files:');
  const enf = get(`${J}/shield/core/BlockEnforcer.java`);
  check(enf && !enf.includes('scheduleBlockingOverlay('), 'BlockEnforcer: no longer schedules a second, parallel overlay');
  check(enf && enf.includes(MARK), 'BlockEnforcer: fix marker present');
  check(enf && balanced(enf), 'BlockEnforcer.java brackets balanced');

  const overlay = get(`${J}/shield/core/BlockingOverlay.java`);
  check(overlay && count(overlay, 'CARD_FAILSAFE_MS') >= 3, 'BlockingOverlay: Sleep/Rise card now has the 30s failsafe too');
  check(overlay && balanced(overlay), 'BlockingOverlay.java brackets balanced');

  const act = get(`${J}/nighttorise/NightToRiseBlockActivity.java`);
  check(act && act.includes('sInstanceActive') && act.includes('ownsInstance') && act.includes('MAX_REBINDS_IN_WINDOW'),
    'NightToRiseBlockActivity: duplicate-instance guard + rebind-loop breaker installed');
  for (const must of ['breakLock(', 'STRICT_UNLOCK_DELAY_MS', 'registerKillSwitchTap', 'recheckOrFinish', 'onBackPressed']) {
    check(act && act.includes(must), `NightToRiseBlockActivity: ${must} still present (unrelated logic untouched)`);
  }
  check(act && balanced(act), 'NightToRiseBlockActivity.java brackets balanced');

  if (fs.existsSync(BACKUP_ROOT)) {
    const dirs = fs.readdirSync(BACKUP_ROOT).filter((d) => fs.existsSync(path.join(BACKUP_ROOT, d, 'manifest.json'))).sort();
    if (dirs.length) {
      const man = JSON.parse(fs.readFileSync(path.join(BACKUP_ROOT, dirs[dirs.length - 1], 'manifest.json'), 'utf8'));
      for (const [rel, h] of Object.entries(man.untouched || {})) {
        let cur = null;
        try { cur = sha(fs.readFileSync(abs(rel))); } catch {}
        check(cur === h, `unchanged: ${rel}`, `CHANGED (should not be): ${rel}`);
      }
    }
  }
  return failures;
}

function newestBackup() {
  if (!fs.existsSync(BACKUP_ROOT)) return null;
  const dirs = fs.readdirSync(BACKUP_ROOT).filter((d) => fs.existsSync(path.join(BACKUP_ROOT, d, 'manifest.json'))).sort();
  return dirs.length ? path.join(BACKUP_ROOT, dirs[dirs.length - 1]) : null;
}
function rollback(dir) {
  dir = dir || newestBackup();
  if (!dir) { bad('no backup found'); return false; }
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const rel of man.modified) {
    fs.copyFileSync(path.join(dir, 'files', ...rel.split('/')), abs(rel));
    ok('restored ' + rel);
  }
  fs.renameSync(dir, dir + '.rolledback');
  return true;
}
function excludeBackupFromGit() {
  try {
    const ex = path.join(ROOT, '.git', 'info', 'exclude');
    if (fs.existsSync(path.join(ROOT, '.git'))) {
      fs.mkdirSync(path.dirname(ex), { recursive: true });
      const cur = fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8') : '';
      if (!cur.includes('.n2r_reboot_fix_backup')) fs.appendFileSync(ex, '\n.n2r_reboot_fix_backup/\n');
    }
  } catch {}
}

function main() {
  info('Sleep to Rise reboot fix installer');
  info('Project root: ' + ROOT);

  if (!fs.existsSync(abs('android/app/src/main/AndroidManifest.xml')) || !fs.existsSync(abs('src'))) {
    bad('Run this from the project root (the folder that contains "android" and "src").');
    process.exit(1);
  }
  if (ARGS.has('--rollback')) { info('\nRolling back:'); process.exit(rollback() ? 0 : 1); }
  if (ARGS.has('--check')) {
    const f = verify();
    info(f === 0 ? '\nAll checks passed.' : `\n${f} check(s) failed.`);
    process.exit(f === 0 ? 0 : 1);
  }

  const plan = [];
  const problems = [];
  const skipped = [];

  for (const p of PATCHES) {
    let cur;
    try { cur = readText(p.file); } catch { problems.push(`missing file: ${p.file}`); continue; }
    let text = cur.text;
    if (text.includes(MARK)) { skipped.push(p.file); continue; }
    let failed = false;
    for (const e of p.edits) {
      const n = count(text, e.find);
      if (n !== 1) {
        problems.push(`${p.file}: expected 1 match, found ${n} for:\n      ` + e.find.split('\n')[0].trim());
        failed = true;
      } else {
        text = text.replace(e.find, () => e.replace);
      }
    }
    if (!failed) plan.push({ rel: p.file, text, crlf: cur.crlf });
  }

  if (problems.length) {
    info('\nNothing was changed. These files do not match what this installer expects:');
    problems.forEach((p) => bad(p));
    info('\nSend me the files listed above and I will adjust the installer.');
    process.exit(1);
  }

  info('\nPlan:');
  skipped.forEach((s) => info('  = already installed: ' + s));
  plan.forEach((p) => info('  ~ patch: ' + p.rel));

  if (ARGS.has('--dry-run')) { info('\nDry run only. Nothing written.'); process.exit(0); }
  if (!plan.length) { info('\nNothing to do.'); process.exit(verify() === 0 ? 0 : 1); }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(BACKUP_ROOT, ts);
  const man = { modified: [], untouched: {} };
  for (const p of plan) {
    const dest = path.join(dir, 'files', ...p.rel.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs(p.rel), dest);
    man.modified.push(p.rel);
  }
  for (const rel of UNTOUCHED) { try { man.untouched[rel] = sha(fs.readFileSync(abs(rel))); } catch {} }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(man, null, 2));
  excludeBackupFromGit();
  info('\nBackup saved: ' + path.relative(ROOT, dir));

  info('\nWriting:');
  try {
    for (const p of plan) { writeText(p.rel, p.text, p.crlf); ok(p.rel); }
  } catch (e) {
    bad('write failed: ' + e.message + ' \u2014 rolling back');
    rollback(dir);
    process.exit(1);
  }

  const failures = verify();
  if (failures) {
    info(`\n${failures} check(s) failed \u2014 rolling everything back.`);
    rollback(dir);
    process.exit(1);
  }

  if (ARGS.has('--build')) {
    info('\nCompiling (this can take a few minutes)...');
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    const g = spawnSync(gradlew, [':app:compileDebugJavaWithJavac', '-q'], { cwd: abs('android'), stdio: 'inherit', shell: process.platform === 'win32' });
    if (g.status !== 0) { bad('Java compile FAILED. Fix or run:  node apply_n2r_reboot_fix.mjs --rollback'); process.exit(2); }
    ok('Java compiles');
  }

  info('\nDone. Everything is installed and verified.');
  info('\nNext steps:');
  info('  1. npm run build && npx cap sync android');
  info('  2. Build/install the APK, then test on a real phone (see the test list).');
  info('  Undo anytime:  node apply_n2r_reboot_fix.mjs --rollback');
}

main();
