/**
 * Detailed local logger. Every entry is stored instantly in localStorage
 * (works without login/offline) and mirrored to the native log file on Android.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface LifeLogPlugin {
  write(o: { level: string; source: string; message: string }): Promise<void>;
  read(o?: { maxChars?: number }): Promise<{ text: string; path: string }>;
  clear(): Promise<void>;
  share(): Promise<void>;
}

const LifeLogNative = registerPlugin<LifeLogPlugin>('LifeLog');
const KEY = 'lifeos_local_log_v1';
const MAX = 3000;
export const isNativeLog = Capacitor.isNativePlatform();

export interface LocalLogEntry { t: string; level: string; source: string; message: string }

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

function stringify(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}${v.stack ? `\n${v.stack}` : ''}`;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

let buffer: LocalLogEntry[] | null = null;
function load(): LocalLogEntry[] {
  if (buffer) return buffer;
  try { buffer = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { buffer = []; }
  return buffer!;
}

let writing = false;
export function log(level: 'INFO' | 'WARN' | 'ERROR', source: string, ...parts: unknown[]) {
  if (writing) return; // guard against console recursion
  writing = true;
  try {
    const message = parts.map(stringify).join(' ');
    const buf = load();
    buf.push({ t: stamp(), level, source, message });
    if (buf.length > MAX) buf.splice(0, buf.length - MAX);
    try { localStorage.setItem(KEY, JSON.stringify(buf)); } catch { buf.splice(0, Math.floor(buf.length / 2)); }
    if (isNativeLog) LifeLogNative.write({ level, source, message }).catch(() => {});
  } finally {
    writing = false;
  }
}

export const logger = {
  info: (s: string, ...p: unknown[]) => log('INFO', s, ...p),
  warn: (s: string, ...p: unknown[]) => log('WARN', s, ...p),
  error: (s: string, ...p: unknown[]) => log('ERROR', s, ...p),
};

export function getLocalLog(): LocalLogEntry[] { return [...load()].reverse(); }

export function formatLocal(entries: LocalLogEntry[]) {
  return entries.map((e) => `[${e.t}] [${e.level}] [${e.source}] ${e.message}`).join('\n');
}

/** Full text: native file on Android, local buffer on web. */
export async function readDeviceLog(): Promise<{ text: string; path: string }> {
  if (isNativeLog) {
    try { return await LifeLogNative.read({ maxChars: 400_000 }); } catch { /* fall through */ }
  }
  return { text: formatLocal([...load()]), path: 'browser storage' };
}

export async function clearDeviceLog() {
  buffer = [];
  localStorage.removeItem(KEY);
  if (isNativeLog) await LifeLogNative.clear().catch(() => {});
}

export async function shareDeviceLog(): Promise<boolean> {
  if (isNativeLog) {
    try { await LifeLogNative.share(); return true; } catch { /* download fallback */ }
  }
  const { text } = await readDeviceLog();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lifeos-${new Date().toISOString().slice(0, 10)}.log`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return true;
}

let installed = false;
/** Capture every JS error, rejected promise, console.error/warn and navigation. */
export function installGlobalLogging() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => log('ERROR', 'Window', e.error || e.message, e.filename ? `@ ${e.filename}:${e.lineno}` : ''));
  window.addEventListener('unhandledrejection', (e) => log('ERROR', 'Promise', e.reason));
  window.addEventListener('online', () => log('INFO', 'Network', 'online'));
  window.addEventListener('offline', () => log('WARN', 'Network', 'offline'));
  document.addEventListener('visibilitychange', () => log('INFO', 'App', `visibility: ${document.visibilityState}`));
  const origErr = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...a: unknown[]) => { origErr(...a); log('ERROR', 'Console', ...a); };
  console.warn = (...a: unknown[]) => { origWarn(...a); log('WARN', 'Console', ...a); };
  log('INFO', 'App', `started — ${navigator.userAgent}`);
}
