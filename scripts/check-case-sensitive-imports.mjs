#!/usr/bin/env node
/**
 * Case-sensitive import path linter.
 *
 * Walks src/ and verifies that every relative import resolves to a file
 * whose on-disk casing exactly matches the import string. macOS and the
 * default Windows filesystem are case-insensitive, so a mismatch builds
 * locally but fails on Linux/CI (e.g. GitHub Actions).
 *
 * Exits 1 on any mismatch.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const INDEX_EXTS = EXTS.map((e) => `/index${e}`);

const errors = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full);
    } else if (EXTS.includes(path.extname(entry.name))) {
      scan(full);
    }
  }
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[^'"`;]*?from\s+['"]([^'"]+)['"]/g;

function scan(file) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue; // only relative
    const baseDir = path.dirname(file);
    const candidates = [];
    for (const ext of ['', ...EXTS, ...INDEX_EXTS]) {
      candidates.push(path.resolve(baseDir, spec + ext));
    }
    let resolved = null;
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        resolved = c;
        break;
      }
    }
    if (!resolved) continue; // unresolved (e.g. alias) — skip
    if (!matchesCase(resolved)) {
      errors.push(`${file}: import "${spec}" does not match on-disk casing of ${resolved}`);
    }
  }
}

function matchesCase(absPath) {
  // Walk each segment from project root and ensure case matches what's on disk.
  const rel = path.relative(process.cwd(), absPath);
  const parts = rel.split(path.sep);
  let current = process.cwd();
  for (const part of parts) {
    const entries = fs.readdirSync(current);
    if (!entries.includes(part)) return false;
    current = path.join(current, part);
  }
  return true;
}

walk(ROOT);

if (errors.length) {
  console.error('❌ Case-sensitive import mismatches found:');
  for (const e of errors) console.error('  - ' + e);
  console.error(`\n${errors.length} error(s). These will fail on Linux CI.`);
  process.exit(1);
} else {
  console.log('✅ All imports match on-disk casing.');
}
