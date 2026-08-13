/**
 * MissionConfigPages — Alarmy style mission configuration
 * ─────────────────────────────────────────────────────────
 * প্রতিটা mission এর জন্য আলাদা full-screen config page।
 * Live preview সহ। Generic sheet নেই।
 *
 * Exports:
 *   <MissionConfigRouter> — mission type অনুযায়ী সঠিক page দেখায়
 *
 * Props:
 *   missionId  — 'math' | 'shake' | 'qr' | 'photo' | 'typing'
 *   value      — current MissionConfig
 *   onSave     — (cfg: MissionConfig) => void
 *   onClose    — () => void
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X, Camera, RefreshCw, Check, Zap, Calculator, QrCode, Smartphone, Type, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { isNative } from '@/lib/capacitor/platform';
import { lightImpact, mediumImpact, selectionChanged, successNotification, errorNotification } from '@/lib/capacitor/nativeHaptics';
import { cn } from '@/lib/utils';

/* ─── Types ────────────────────────────────────────────── */
export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export interface MissionConfig {
  difficulty: MissionDifficulty;
  count: number;
  targetBarcode?: string;
  photoLocation?: string;
  photoDataUrl?: string;   // ← registered reference photo
  typingPhrase?: string;   // ← phrase to type
}

/* ─── Router ────────────────────────────────────────────── */
interface RouterProps {
  missionId: string;
  value: MissionConfig;
  onSave: (cfg: MissionConfig) => void;
  onClose: () => void;
}

export function MissionConfigRouter({ missionId, value, onSave, onClose }: RouterProps) {
  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black flex flex-col">
      {missionId === 'math'  && <MathConfigPage    value={value} onSave={onSave} onClose={onClose} />}
      {missionId === 'shake' && <ShakeConfigPage   value={value} onSave={onSave} onClose={onClose} />}
      {(missionId === 'qr' || missionId === 'barcode') && <QrConfigPage value={value} onSave={onSave} onClose={onClose} />}
      {missionId === 'photo' && <PhotoConfigPage   value={value} onSave={onSave} onClose={onClose} />}
      {missionId === 'typing' && <TypingConfigPage value={value} onSave={onSave} onClose={onClose} />}
    </div>,
    document.body,
  );
}

/* ─── Shared primitives ─────────────────────────────────── */

/**
 * Single close/back control only — the previous version rendered an extra `X`
 * on the right which duplicated the left control and confused users.
 */
function ConfigHeader({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose: () => void }) {
  const handle = () => { void lightImpact(); (onBack ?? onClose)(); };
  return (
    <div className="flex items-center gap-3 px-4 py-4 shrink-0">
      <button
        onClick={handle}
        aria-label={onBack ? 'Back' : 'Close'}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:scale-95 transition-transform"
      >
        {onBack ? <ArrowLeft className="h-5 w-5 text-white" /> : <X className="h-5 w-5 text-white" />}
      </button>
      <span className="text-white font-bold text-base">{title}</span>
    </div>
  );
}

// Scroll wheel picker — 1..max
function CountPicker({ value, onChange, max = 10, label = 'times' }: { value: number; onChange: (n: number) => void; max?: number; label?: string }) {
  const step = (n: number) => { void selectionChanged(); onChange(n); };
  return (
    <div className="flex items-center justify-center gap-8 bg-white/5 rounded-2xl py-4">
      <div className="flex flex-col items-center w-28">
        <button
          onClick={() => step(Math.max(1, value - 1))}
          aria-label="Decrease"
          className="p-2 active:scale-90 transition-transform"
        >
          <ChevronUp className="h-5 w-5 text-white/40" />
        </button>
        <div className="relative h-24 overflow-hidden w-full flex flex-col items-center">
          {[-1, 0, 1].map((offset) => {
            const num = value + offset;
            const inRange = num >= 1 && num <= max;
            return (
              <div
                key={offset}
                className={cn(
                  'h-8 flex items-center justify-center text-2xl font-bold transition-all',
                  offset === 0 ? 'text-white scale-125' : 'text-white/25 scale-90',
                )}
              >
                {inRange ? num : ''}
              </div>
            );
          })}
        </div>
        <button
          onClick={() => step(Math.min(max, value + 1))}
          aria-label="Increase"
          className="p-2 active:scale-90 transition-transform"
        >
          <ChevronDown className="h-5 w-5 text-white/40" />
        </button>
      </div>
      <span className="text-white/60 text-base">{label}</span>
    </div>
  );
}

// Difficulty slider — the only place difficulty is configured (removed from the alarm editor summary)
function DifficultySlider({ value, onChange }: { value: MissionDifficulty; onChange: (d: MissionDifficulty) => void }) {
  const levels: MissionDifficulty[] = ['easy', 'medium', 'hard'];
  const idx = levels.indexOf(value);
  return (
    <div className="bg-white/5 rounded-2xl p-4">
      <p className="text-white/40 text-[11px] uppercase tracking-wider text-center">Difficulty</p>
      <p className="text-white font-bold text-center text-xl mb-4 capitalize">{value}</p>
      <div className="relative px-2">
        <div className="h-1.5 bg-white/10 rounded-full" />
        <div
          className="absolute top-0 h-1.5 bg-cyan-400 rounded-full transition-all"
          style={{ width: `${(idx / 2) * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={2}
          value={idx}
          aria-label="Difficulty"
          onChange={(e) => { void selectionChanged(); onChange(levels[parseInt(e.target.value)]); }}
          className="absolute inset-0 opacity-0 w-full cursor-pointer"
        />
        {/* thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg transition-all"
          style={{ left: `calc(${(idx / 2) * 100}% - 12px)` }}
        />
      </div>
      <div className="flex justify-between mt-3">
        <span className="text-white/40 text-xs">Easy</span>
        <span className="text-white/40 text-xs">Hard</span>
      </div>
    </div>
  );
}

// Bottom action buttons
function ActionButtons({ onPreview, onComplete, previewLabel = 'Preview' }: { onPreview?: () => void; onComplete: () => void; previewLabel?: string }) {
  return (
    <div className="flex gap-3 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 shrink-0">
      {onPreview && (
        <button
          onClick={() => { void lightImpact(); onPreview(); }}
          className="flex-1 h-14 rounded-2xl bg-white/10 text-white font-bold text-base active:scale-[0.98] transition-transform"
        >
          {previewLabel}
        </button>
      )}
      <button
        onClick={() => { void mediumImpact(); onComplete(); }}
        className="flex-1 h-14 rounded-2xl bg-white text-black font-bold text-base active:scale-[0.98] transition-transform"
      >
        Complete
      </button>
    </div>
  );
}

/**
 * Full-screen mission PREVIEW — this is the only place a keypad / typing input
 * is shown. The setup screens stay clean (no live keyboard), matching the real
 * alarm-ring experience.
 */
function PreviewShell({ title, onExit, children }: { title: string; onExit: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[#07090F]">
      <div className="flex items-center gap-3 px-4 py-4 shrink-0 pt-[max(env(safe-area-inset-top),1rem)]">
        <button
          onClick={() => { void lightImpact(); onExit(); }}
          aria-label="Exit preview"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:scale-95 transition-transform"
        >
          <X className="h-5 w-5 text-white" />
        </button>
        <div>
          <p className="text-white font-bold text-base leading-tight">{title}</p>
          <p className="text-white/40 text-[11px]">Preview — how it looks when the alarm rings</p>
        </div>
      </div>
      {children}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════
   1. MATH CONFIG
   ══════════════════════════════════════════════════════════ */

function MathConfigPage({ value, onSave, onClose }: { value: MissionConfig; onSave: (c: MissionConfig) => void; onClose: () => void }) {
  const [difficulty, setDifficulty] = useState<MissionDifficulty>(value.difficulty ?? 'easy');
  const [count, setCount]           = useState(value.count ?? 1);
  const [problem, setProblem]       = useState<{ q: string; a: number } | null>(null);
  const [userInput, setUserInput]   = useState('');
  const [isError, setIsError]       = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [solved, setSolved]         = useState(0);
  const timers                       = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);

  const generateProblem = () => {
    let a: number, b: number, q: string, ans: number;
    if (difficulty === 'easy') {
      a = Math.floor(Math.random() * 9) + 1;
      b = Math.floor(Math.random() * 9) + 1;
      q = `${a}+${b}`; ans = a + b;
    } else if (difficulty === 'medium') {
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      const op = Math.random() > 0.5;
      q = op ? `${a}+${b}` : `${Math.max(a,b)}-${Math.min(a,b)}`;
      ans = op ? a + b : Math.abs(a - b);
    } else {
      a = Math.floor(Math.random() * 9) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      q = `${a}×${b}`; ans = a * b;
    }
    setProblem({ q, a: ans });
    setUserInput('');
    setIsError(false);
  };

  // Regenerate the sample problem whenever the difficulty changes.
  useEffect(() => { generateProblem(); /* eslint-disable-next-line */ }, [difficulty]);

  const startPreview = () => {
    setSolved(0);
    generateProblem();
    setPreviewing(true);
  };

  const exitPreview = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPreviewing(false);
    setUserInput('');
    setSolved(0);
  };

  const handleKey = (k: string) => {
    if (!problem) return;
    void lightImpact();
    if (k === '⌫') { setUserInput((p) => p.slice(0, -1)); return; }
    const next = userInput + k;
    setUserInput(next);
    const expected = problem.a.toString();
    if (next === expected) {
      void successNotification();
      const done = solved + 1;
      setSolved(done);
      if (done >= count) {
        toast.success('Preview complete — alarm would dismiss ✓');
        later(exitPreview, 700);
      } else {
        toast.success(`Correct! ${done}/${count}`);
        later(generateProblem, 400);
      }
    } else if (next.length >= expected.length) {
      void errorNotification();
      setIsError(true);
      later(() => { setIsError(false); setUserInput(''); }, 500);
    }
  };

  const handleComplete = () => {
    onSave({ ...value, difficulty, count });
    toast.success('Math mission configured ✓');
    onClose();
  };

  return (
    <div className="relative flex flex-col h-full bg-[#0E1117]">
      <ConfigHeader title="Math" onClose={onClose} />

      {/* SETUP — no keypad here, only a static sample of the problem */}
      <div className="flex-1 flex flex-col px-4 gap-4 overflow-auto">
        <div className="bg-[#1A1D26] rounded-2xl p-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-cyan-400" />
            <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider">Example</span>
          </div>
          <p className="text-white text-4xl font-black text-center">
            {problem?.q} = <span className="text-white/25">?</span>
          </p>
          <p className="text-white/40 text-sm text-center mt-3">
            Solve {count} {count === 1 ? 'problem' : 'problems'} to dismiss the alarm
          </p>
          <button
            onClick={() => { void lightImpact(); generateProblem(); }}
            className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-white/60 text-xs active:scale-95 transition-transform"
          >
            <RefreshCw className="h-3.5 w-3.5" /> New example
          </button>
        </div>

        <DifficultySlider value={difficulty} onChange={setDifficulty} />
        <CountPicker value={count} onChange={setCount} max={10} label="times" />
      </div>

      <ActionButtons onPreview={startPreview} onComplete={handleComplete} />

      {/* PREVIEW — full-screen challenge with the working keypad */}
      {previewing && (
        <PreviewShell title="Math challenge" onExit={exitPreview}>
          <div className="flex-1 flex flex-col justify-center px-5 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <p className="text-white/40 text-center text-xs mb-2">{solved}/{count} solved</p>
            <p className="text-white text-5xl font-black text-center mb-6">{problem?.q} =</p>
            <div className={cn(
              'h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold transition-all',
              isError ? 'border-red-500 text-red-400 bg-red-500/10' : userInput ? 'border-cyan-400 text-white' : 'border-white/10 text-white/20',
            )}>
              {userInput || '?'}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[1,2,3,4,5,6,7,8,9].map((n) => (
                <button
                  key={n}
                  onClick={() => handleKey(String(n))}
                  className="h-16 rounded-2xl bg-white/8 text-white text-2xl font-semibold active:bg-white/25 active:scale-95 transition-all"
                >
                  {n}
                </button>
              ))}
              <button onClick={() => handleKey('⌫')} className="h-16 rounded-2xl bg-white/8 text-white/60 text-lg active:bg-white/25 active:scale-95 transition-all">⌫</button>
              <button onClick={() => handleKey('0')} className="h-16 rounded-2xl bg-white/8 text-white text-2xl font-semibold active:bg-white/25 active:scale-95 transition-all">0</button>
              <button
                onClick={() => { void lightImpact(); generateProblem(); }}
                aria-label="Skip problem"
                className="h-16 rounded-2xl bg-white/8 text-white/60 flex items-center justify-center active:bg-white/25 active:scale-95 transition-all"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </PreviewShell>
      )}
    </div>
  );
}



/* ══════════════════════════════════════════════════════════
   2. SHAKE CONFIG
   ══════════════════════════════════════════════════════════ */

function ShakeConfigPage({ value, onSave, onClose }: { value: MissionConfig; onSave: (c: MissionConfig) => void; onClose: () => void }) {
  const [difficulty, setDifficulty] = useState<MissionDifficulty>(value.difficulty ?? 'easy');
  const [count, setCount]           = useState(value.count ?? 3);
  const [shakeDemo, setShakeDemo]   = useState(0);

  // Shake demo animation on interval
  useEffect(() => {
    const t = setInterval(() => setShakeDemo(n => (n + 1) % 2), 500);
    return () => clearInterval(t);
  }, []);

  const requiredShakes = count * (difficulty === 'hard' ? 15 : difficulty === 'easy' ? 5 : 10);

  return (
    <div className="flex flex-col h-full bg-[#0E1117]">
      <ConfigHeader title="Shake" onClose={onClose} />

      <div className="flex-1 flex flex-col px-4 gap-4 overflow-auto">

        {/* Preview */}
        <div className="bg-[#1A1D26] rounded-2xl p-6 flex flex-col items-center">
          <Smartphone
            className="h-20 w-20 text-cyan-400 transition-transform duration-200"
            style={{ transform: `rotate(${shakeDemo === 0 ? '12deg' : '-12deg'})` }}
          />
          <p className="text-white text-lg font-bold mt-4">Shake {requiredShakes} times</p>
          <p className="text-white/40 text-sm mt-1">Shake your phone vigorously</p>
        </div>

        <DifficultySlider value={difficulty} onChange={setDifficulty} />
        <CountPicker value={count} onChange={setCount} max={10} label="rounds" />

        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-white/40 text-xs text-center">
            Total shakes: <span className="text-white font-bold">{requiredShakes}</span>
          </p>
        </div>
      </div>

      <ActionButtons
        onComplete={() => { onSave({ ...value, difficulty, count }); toast.success('Shake mission configured ✓'); onClose(); }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   3. QR / BARCODE CONFIG
   ══════════════════════════════════════════════════════════ */

function QrConfigPage({ value, onSave, onClose }: { value: MissionConfig; onSave: (c: MissionConfig) => void; onClose: () => void }) {
  const [scanned, setScanned]           = useState(value.targetBarcode ?? '');
  const [isScanning, setIsScanning]     = useState(false);
  const manualRef                        = useRef<HTMLInputElement>(null);

  const doScan = async () => {
    setIsScanning(true);
    try {
      if (isNative) {
        const { scanBarcode } = await import('@/lib/capacitor/barcodeScannerBridge');
        const result = await scanBarcode('');
        if (result.success && result.value) {
          setScanned(result.value);
          toast.success(`Registered: ${result.value}`);
        }
      } else {
        // Web fallback — manual input
        manualRef.current?.focus();
        toast.info('Enter barcode manually below (web mode)');
      }
    } catch (e) {
      toast.error('Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0E1117]">
      <ConfigHeader title="QR/Barcode" onClose={onClose} />

      <div className="flex-1 flex flex-col items-center px-6 gap-6 overflow-auto pt-4">
        <p className="text-white text-2xl font-bold text-center leading-snug">
          Scan a code of a part of{'\n'}your morning routine
        </p>

        {/* Example / scanned image */}
        <div className="w-full max-w-xs rounded-2xl overflow-hidden bg-white/5 aspect-square flex items-center justify-center">
          {scanned ? (
            <div className="flex flex-col items-center gap-3 p-6">
              <Check className="h-16 w-16 text-green-400" />
              <p className="text-green-400 font-bold text-center break-all">{scanned}</p>
              <p className="text-white/40 text-xs text-center">Tap Scan to change</p>
            </div>
          ) : (
            /* Barcode illustration */
            <div className="flex flex-col items-center gap-3 p-6">
              <QrCode className="h-24 w-24 text-white/20" />
              <p className="text-white/40 text-sm text-center">No barcode registered yet</p>
            </div>
          )}
        </div>

        {/* Manual input for web */}
        {!isNative && (
          <input
            ref={manualRef}
            placeholder="Type barcode value manually"
            value={scanned}
            onChange={(e) => setScanned(e.target.value)}
            className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-cyan-400"
          />
        )}

        <p className="text-white/40 text-sm text-center px-4">
          You'll need to scan this code every morning to dismiss your alarm.
        </p>
      </div>

      {/* Scan button */}
      <div className="px-4 pb-3 shrink-0">
        <button
          onClick={doScan}
          disabled={isScanning}
          className="w-full h-14 rounded-2xl bg-white/10 text-white font-bold text-base mb-3 disabled:opacity-50"
        >
          {isScanning ? 'Opening scanner...' : scanned ? 'Re-scan' : 'Scan'}
        </button>
        <button
          onClick={() => {
            if (!scanned && isNative) { toast.error('Please scan a barcode first'); return; }
            onSave({ ...value, targetBarcode: scanned || 'WAKE-UP' });
            toast.success('QR/Barcode mission configured ✓');
            onClose();
          }}
          className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base"
        >
          Complete
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   4. PHOTO CONFIG
   ══════════════════════════════════════════════════════════ */

function PhotoConfigPage({ value, onSave, onClose }: { value: MissionConfig; onSave: (c: MissionConfig) => void; onClose: () => void }) {
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(value.photoDataUrl ?? null);
  const [location,     setLocation]     = useState(value.photoLocation ?? '');
  const [capturing,    setCapturing]    = useState(false);
  const fileRef                          = useRef<HTMLInputElement>(null);

  const takePhoto = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      if (isNative) {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality:      70,
          resultType:   CameraResultType.DataUrl,
          source:       CameraSource.Camera,
          allowEditing: false,
          saveToGallery: false,
        });
        if (photo.dataUrl) setPhotoDataUrl(photo.dataUrl);
      } else {
        fileRef.current?.click();
      }
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!/cancel/i.test(msg)) toast.error('Camera failed');
    } finally {
      setCapturing(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#0E1117]">
      <ConfigHeader title="Photo" onClose={onClose} />

      <div className="flex-1 flex flex-col items-center px-6 gap-4 overflow-auto pt-2">
        <p className="text-white text-2xl font-bold text-center leading-snug">
          Take a photo of a part of{'\n'}your morning routine
        </p>

        {/* Photo preview / camera placeholder */}
        <div
          className="w-full max-w-xs rounded-2xl overflow-hidden relative"
          style={{ aspectRatio: '3/4' }}
        >
          {photoDataUrl ? (
            <>
              <img src={photoDataUrl} alt="Reference" className="w-full h-full object-cover" />
              {/* Viewfinder overlay */}
              <div className="absolute inset-0 flex items-start justify-start p-3">
                <div className="w-5 h-5 border-t-2 border-l-2 border-white rounded-tl" />
              </div>
              <div className="absolute inset-0 flex items-start justify-end p-3">
                <div className="w-5 h-5 border-t-2 border-r-2 border-white rounded-tr" />
              </div>
              <div className="absolute inset-0 flex items-end justify-start p-3">
                <div className="w-5 h-5 border-b-2 border-l-2 border-white rounded-bl" />
              </div>
              <div className="absolute inset-0 flex items-end justify-end p-3">
                <div className="w-5 h-5 border-b-2 border-r-2 border-white rounded-br" />
              </div>
              {/* Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 relative">
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white/60" />
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/60" />
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-3">
              <Camera className="h-16 w-16 text-white/20" />
              <p className="text-white/40 text-sm">No photo registered</p>
            </div>
          )}

          {/* Shutter button overlay */}
          <button
            onClick={takePhoto}
            disabled={capturing}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full bg-red-500" />
          </button>
        </div>

        {/* Location label */}
        <div className="w-full">
          <p className="text-white/40 text-xs mb-1.5">Location name (optional)</p>
          <input
            placeholder="e.g. Bathroom sink, Kitchen counter"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-cyan-400"
          />
        </div>

        <p className="text-white/40 text-sm text-center px-2">
          Every morning you'll need to take a photo of this spot to dismiss the alarm.
        </p>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

      <div className="px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 shrink-0">
        <button
          onClick={() => {
            if (!photoDataUrl && isNative) { toast.error('Please take a photo first'); return; }
            onSave({ ...value, photoDataUrl: photoDataUrl ?? undefined, photoLocation: location || 'Morning spot' });
            toast.success('Photo mission configured ✓');
            onClose();
          }}
          className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base"
        >
          Complete
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   5. TYPING CONFIG
   ══════════════════════════════════════════════════════════ */

const PRESET_PHRASES = [
  'Keep shining',
  'I am ready for today',
  'Rise and conquer',
  'Every morning is a fresh start',
  'Bismillah',
  'Alhamdulillah for today',
  'Make today count',
  'I choose to be productive',
  'بسم الله الرحمن الرحيم',
  'আজকে আমি সেরাটা দেব',
];

function TypingConfigPage({ value, onSave, onClose }: { value: MissionConfig; onSave: (c: MissionConfig) => void; onClose: () => void }) {
  const [phrase,          setPhrase]          = useState(value.typingPhrase ?? PRESET_PHRASES[0]);
  const [count,           setCount]           = useState(value.count ?? 1);
  const [showPhraseList,  setShowPhraseList]  = useState(false);
  const [customPhrase,    setCustomPhrase]    = useState('');
  const [previewInput,    setPreviewInput]    = useState('');
  const [previewDone,     setPreviewDone]     = useState(false);

  const handlePreviewType = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setPreviewInput(v);
    if (v.toLowerCase() === phrase.toLowerCase()) {
      setPreviewDone(true);
      toast.success('Correct! ✓');
      setTimeout(() => { setPreviewInput(''); setPreviewDone(false); }, 800);
    }
  };

  if (showPhraseList) {
    return (
      <div className="flex flex-col h-full bg-[#0E1117]">
        <ConfigHeader title="Select phrase" onBack={() => setShowPhraseList(false)} onClose={onClose} />
        <div className="flex-1 overflow-auto px-4 gap-2 flex flex-col pb-6">
          {/* Custom */}
          <div className="mb-2">
            <p className="text-white/40 text-xs mb-1.5">Custom phrase</p>
            <div className="flex gap-2">
              <input
                placeholder="Type your own phrase..."
                value={customPhrase}
                onChange={(e) => setCustomPhrase(e.target.value)}
                className="flex-1 bg-white/10 text-white rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-cyan-400"
              />
              <button
                onClick={() => { if (customPhrase.trim()) { setPhrase(customPhrase.trim()); setShowPhraseList(false); } }}
                className="px-4 py-3 bg-cyan-500 text-black rounded-xl font-bold text-sm"
              >
                Use
              </button>
            </div>
          </div>
          <p className="text-white/40 text-xs">Or choose a preset</p>
          {PRESET_PHRASES.map((p) => (
            <button
              key={p}
              onClick={() => { setPhrase(p); setShowPhraseList(false); }}
              className={cn(
                'w-full text-left px-4 py-4 rounded-xl text-base font-medium transition-colors',
                phrase === p ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-white hover:bg-white/10',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0E1117]">
      <ConfigHeader title="Typing" onClose={onClose} />

      <div className="flex-1 flex flex-col px-4 gap-4 overflow-auto pt-2">

        {/* Live preview */}
        <div className="bg-[#1A1D26] rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-center">
            <span className="bg-cyan-500 text-black text-xs font-bold px-3 py-1.5 rounded-full">Example</span>
          </div>
          <p className="text-white text-2xl font-bold text-center">{phrase}</p>
          <input
            placeholder="Type the phrase here..."
            value={previewInput}
            onChange={handlePreviewType}
            className={cn(
              'w-full rounded-xl px-4 py-3 text-base outline-none border-2 transition-colors bg-white/5 text-white',
              previewDone ? 'border-green-400' : previewInput ? 'border-cyan-400' : 'border-white/10',
            )}
          />
          <p className="text-white/30 text-xs text-center">Try typing the phrase above</p>
        </div>

        {/* Count */}
        <CountPicker value={count} onChange={setCount} max={5} label="times" />

        {/* Select phrase */}
        <button
          onClick={() => setShowPhraseList(true)}
          className="w-full flex items-center justify-between bg-white/5 rounded-xl px-4 py-4"
        >
          <span className="text-white font-medium">Select phrase</span>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 text-sm">{PRESET_PHRASES.length} phrases</span>
          </div>
        </button>
      </div>

      <ActionButtons
        onPreview={() => { setPreviewInput(''); toast.info('Try typing: ' + phrase); }}
        onComplete={() => {
          onSave({ ...value, typingPhrase: phrase, count });
          toast.success('Typing mission configured ✓');
          onClose();
        }}
      />
    </div>
  );
}