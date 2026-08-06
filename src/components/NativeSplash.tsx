import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { LifeOSLogo } from '@/components/LifeOSLogo';

interface NativeSplashProps {
  onComplete?: () => void;
  waitFor?: boolean;
  minimumDuration?: number;
}

const DARK_THEMES = new Set(['dark', 'amoled', 'midnight', 'forest', 'sunset', 'mono']);

/** Detect dark mode from the same signals ThemeContext uses, with a safe
 *  fallback when the splash mounts before ThemeProvider has applied a class. */
function detectIsDark(): boolean {
  if (typeof window === 'undefined') return false;
  // 1) Class already on <html> (set by ThemeProvider)
  const cls = window.document.documentElement.classList;
  for (const t of DARK_THEMES) if (cls.contains(t)) return true;
  if (cls.contains('light')) return false;
  // 2) Stored preference
  try {
    const stored = window.localStorage.getItem('theme');
    if (stored && stored !== 'system' && stored !== 'light') {
      return DARK_THEMES.has(stored);
    }
    if (stored === 'light') return false;
  } catch { /* ignore */ }
  // 3) System
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export default function NativeSplash({ onComplete, waitFor, minimumDuration = 2200 }: NativeSplashProps) {
  const [entered, setEntered] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  const isDark = useMemo(detectIsDark, []);

  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    if (waitFor === undefined) {
      const t = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => onComplete?.(), 350);
      }, minimumDuration);
      return () => clearTimeout(t);
    }
    if (waitFor === false) {
      const elapsed = Date.now() - mountedAt;
      const remaining = Math.max(0, minimumDuration - elapsed);
      const t = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => onComplete?.(), 350);
      }, remaining);
      return () => clearTimeout(t);
    }
  }, [waitFor, onComplete, minimumDuration, mountedAt]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-300',
        isDark
          ? 'bg-gradient-to-br from-[#06101c] via-[#0a1a2d] to-[#0d2440]'
          : 'bg-gradient-to-br from-white via-[#eaf4ff] to-[#cfe6fb]',
        fadeOut && 'opacity-0 pointer-events-none',
      )}
    >
      <div className={cn(
        'pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full blur-3xl',
        isDark ? 'bg-[#2EA3F2]/15' : 'bg-[#2EA3F2]/25',
      )} />
      <div className={cn(
        'pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full blur-3xl',
        isDark ? 'bg-[#1670C8]/20' : 'bg-[#1670C8]/25',
      )} />

      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            'absolute inset-0 m-auto h-[260px] w-[260px] rounded-full',
            isDark
              ? 'bg-[radial-gradient(circle,rgba(46,163,242,0.22)_0%,transparent_70%)]'
              : 'bg-[radial-gradient(circle,rgba(46,163,242,0.35)_0%,transparent_70%)]',
            'transition-all duration-700 ease-out',
            entered ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          )}
        />
        <div
          className={cn(
            'relative transition-all duration-[600ms] ease-out',
            entered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.8] translate-y-2',
          )}
        >
          <LifeOSLogo size={220} />
        </div>
        <h1
          className={cn(
            'mt-8 text-[34px] font-extrabold tracking-tight transition-all duration-700 delay-150',
            isDark ? 'text-white' : 'text-[#0a1f2e]',
            entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
        >
          Life OS
        </h1>
        <p
          className={cn(
            'mt-3 text-[12px] font-semibold tracking-[0.4em] uppercase transition-all duration-700 delay-300',
            isDark ? 'text-[#7BC4F5]' : 'text-[#1670C8]',
            entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
        >
          Rise · Shield · Growth
        </p>
        <div className={cn(
          'mt-10 h-1 w-32 overflow-hidden rounded-full',
          isDark ? 'bg-[#1670C8]/25' : 'bg-[#1670C8]/15',
        )}>
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#7BC4F5] via-[#2EA3F2] to-[#1670C8] animate-shimmer bg-[length:200%_100%]" />
        </div>
      </div>
    </div>
  );
}
