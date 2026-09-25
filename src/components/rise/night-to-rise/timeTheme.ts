/**
 * timeTheme — Section 1: dynamic time-of-day palette for Sleep to Rise.
 *
 * `getTimeTheme(date)` linearly interpolates (in RGB) between the two nearest
 * keyframes of the day and returns the background gradient + accent colour.
 * `useTimeTheme()` recomputes it every 60 seconds and exposes the result as
 * CSS custom properties scoped to the Sleep-to-Rise route only.
 *
 * Lock override rule: while a lock is actively enforcing, the palette is
 * pinned to the warm "deep night" row and animation is disabled — warm, dim
 * light instead of melatonin-suppressing blue.
 */

import { useEffect, useMemo, useState } from 'react';

export interface TimeTheme {
  label: string;
  bgGradientStart: string;
  bgGradientEnd: string;
  accentColor: string;
  /** True when the palette is dark, so text should flip to a light foreground. */
  dark: boolean;
}

interface Keyframe {
  /** Minutes of day at which this keyframe is exactly on. */
  at: number;
  label: string;
  start: string;
  end: string;
  accent: string;
  dark: boolean;
}

const hm = (h: number, m = 0) => h * 60 + m;

/** Keyframes placed at the midpoint of each band from the spec table. */
const KEYFRAMES: Keyframe[] = [
  { at: hm(4, 45),  label: 'Pre-dawn',    start: '#0B1026', end: '#161B33', accent: '#8FA8CC', dark: true },
  { at: hm(6, 15),  label: 'Dawn',        start: '#4A3B6B', end: '#FFC978', accent: '#FF9B71', dark: true },
  { at: hm(9, 0),   label: 'Morning',     start: '#EAF4FF', end: '#FFFDF7', accent: '#7FB8E8', dark: false },
  { at: hm(13, 0),  label: 'Midday',      start: '#CFE8FF', end: '#FFFFFF', accent: '#4A9BE0', dark: false },
  { at: hm(16, 0),  label: 'Afternoon',   start: '#FFEFD6', end: '#FFF9EE', accent: '#F2B857', dark: false },
  { at: hm(17, 45), label: 'Golden hour', start: '#FF8C69', end: '#A78BDB', accent: '#FF8C69', dark: false },
  { at: hm(19, 15), label: 'Evening',     start: '#4A3B6B', end: '#22254A', accent: '#7A6BAE', dark: true },
  { at: hm(21, 0),  label: 'Wind-down',   start: '#161B33', end: '#0B1026', accent: '#8FA8CC', dark: true },
  { at: hm(24, 0),  label: 'Deep night',  start: '#0B1026', end: '#0B1026', accent: '#C98A5E', dark: true },
  { at: hm(3, 0),   label: 'Late night',  start: '#0B1026', end: '#0B1026', accent: '#8FA8CC', dark: true },
];

/** The warm-dim palette used by every actively-enforcing lock screen. */
export const LOCK_THEME: TimeTheme = {
  label: 'Deep night',
  bgGradientStart: '#0B1026',
  bgGradientEnd: '#0B1026',
  accentColor: '#C98A5E',
  dark: true,
};

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const p = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/** Forward distance around the 24h clock, always >= 0. */
const fwd = (from: number, to: number) => ((to - from) % 1440 + 1440) % 1440;

/**
 * Interpolates the palette for a given moment. Wraps correctly across
 * midnight because keyframe distances are measured around the clock.
 */
export function getTimeTheme(date: Date = new Date()): TimeTheme {
  const now = date.getHours() * 60 + date.getMinutes();

  // Nearest keyframe at-or-before `now`, and the next one after it.
  let prev = KEYFRAMES[0];
  let bestBack = Infinity;
  for (const k of KEYFRAMES) {
    const back = fwd(k.at, now);
    if (back < bestBack) { bestBack = back; prev = k; }
  }
  let next = KEYFRAMES[0];
  let bestFwd = Infinity;
  for (const k of KEYFRAMES) {
    if (k === prev) continue;
    const ahead = fwd(now, k.at);
    if (ahead < bestFwd) { bestFwd = ahead; next = k; }
  }

  const span = bestBack + bestFwd;
  const t = span === 0 ? 0 : bestBack / span;

  return {
    label: t < 0.5 ? prev.label : next.label,
    bgGradientStart: mixHex(prev.start, next.start, t),
    bgGradientEnd: mixHex(prev.end, next.end, t),
    accentColor: mixHex(prev.accent, next.accent, t),
    dark: t < 0.5 ? prev.dark : next.dark,
  };
}

/**
 * Live theme hook. Pass `locked` when a Sleep/Rise lock is actively enforcing
 * to pin the warm-dim palette (and stop the smooth transition).
 */
export function useTimeTheme(locked = false) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const theme = locked ? LOCK_THEME : getTimeTheme(now);
    const style = {
      '--stf-bg-start': theme.bgGradientStart,
      '--stf-bg-end': theme.bgGradientEnd,
      '--stf-accent': theme.accentColor,
    } as React.CSSProperties;
    return { theme, style, locked };
  }, [now, locked]);
}
