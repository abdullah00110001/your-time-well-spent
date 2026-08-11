/**
 * PhotoMission — alarm ring সময়ে দেখায়।
 *
 * Fix 1: Android 13+ permission loop — CameraSource.Photos এর বদলে Camera use করো
 * Fix 2: Reference photo (registeredPhotoUrl) থাকলে side-by-side দেখাও
 * Fix 3: reference photo থাকলে সত্যিকারের perceptual-hash verification হয় —
 *        আগে যেকোনো ছবি তুলে "Yes, dismiss" চাপলেই mission bypass হয়ে যেত।
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RotateCcw, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from '@/lib/capacitor/platform';
import { comparePhotos } from '@/lib/rise/imageHash';
import { toast } from 'sonner';

interface PhotoMissionProps {
  onComplete:            () => void;
  registeredPlace?:      string;
  registeredPhotoUrl?:   string;   // ← reference photo from mission_config.photoDataUrl
}

type Verdict = 'idle' | 'checking' | 'match' | 'mismatch' | 'unavailable';

export function PhotoMission({
  onComplete,
  registeredPlace    = 'your morning spot',
  registeredPhotoUrl,
}: PhotoMissionProps) {
  const [photoUri,    setPhotoUri]    = useState<string | null>(null);
  const [confirming,  setConfirming]  = useState(false);
  const [capturing,   setCapturing]   = useState(false);
  const [verdict,     setVerdict]     = useState<Verdict>('idle');
  const [attempts,    setAttempts]    = useState(0);
  const fileRef                        = useRef<HTMLInputElement>(null);

  const mountedRef = useRef(true);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const acceptPhoto = useCallback(async (dataUrl: string) => {
    setPhotoUri(dataUrl);
    setConfirming(true);

    // কোনো reference photo না থাকলে verify করার কিছু নেই — manual confirm।
    if (!registeredPhotoUrl) {
      setVerdict('unavailable');
      return;
    }

    setVerdict('checking');
    const check = await comparePhotos(registeredPhotoUrl, dataUrl);
    if (!mountedRef.current) return;

    if (check.result === 'match') {
      setVerdict('match');
    } else if (check.result === 'mismatch') {
      setVerdict('mismatch');
      setAttempts((n) => n + 1);
    } else {
      // Hashing সম্ভব হয়নি — user কে ringing alarm-এ আটকে রাখা যাবে না।
      setVerdict('unavailable');
    }
  }, [registeredPhotoUrl]);

  const takePhoto = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      if (isNative) {
        // ✅ Fix: CameraSource.Camera — Android 13+ permission loop নেই
        const photo = await CapCamera.getPhoto({
          quality:       70,
          resultType:    CameraResultType.DataUrl,
          source:        CameraSource.Camera,   // ← Photos এর বদলে Camera
          allowEditing:  false,
          saveToGallery: false,
        });
        if (photo.dataUrl) await acceptPhoto(photo.dataUrl);
      } else {
        fileRef.current?.click();
      }
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (/cancel|user cancel/i.test(msg)) return; // silent
      toast.error('Camera failed to open');
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { void acceptPhoto(reader.result as string); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const retake = () => {
    setPhotoUri(null);
    setConfirming(false);
    setVerdict('idle');
  };

  const confirm = () => {
    if (verdict === 'checking' || verdict === 'mismatch') return;
    toast.success('Photo verified! Good morning ☀️');
    timerRef.current = setTimeout(() => onComplete(), 400);
  };


  /* ── Confirmation screen ── */
  if (confirming && photoUri) {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-white p-6">
        <div className="flex items-center gap-3 mb-6 mt-4">
          <div className="p-3 bg-amber-500/20 rounded-2xl">
            <Camera className="h-6 w-6 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold">Confirm photo</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">

          {/* Side-by-side if reference photo exists */}
          {registeredPhotoUrl ? (
            <div className="flex gap-3 w-full">
              <div className="flex-1 flex flex-col gap-1">
                <p className="text-white/40 text-xs text-center">Reference</p>
                <div className="rounded-2xl overflow-hidden aspect-square">
                  <img src={registeredPhotoUrl} alt="Reference" className="w-full h-full object-cover opacity-70" />
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <p className="text-white/40 text-xs text-center">Your photo</p>
                <div className="rounded-2xl overflow-hidden aspect-square border-2 border-amber-400">
                  <img src={photoUri} alt="Captured" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-xs rounded-2xl overflow-hidden aspect-square border border-white/10">
              <img src={photoUri} alt="Captured" className="w-full h-full object-cover" />
            </div>
          )}

          {verdict === 'checking' && (
            <p className="text-white/60 text-sm text-center flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Comparing with your reference photo…
            </p>
          )}
          {verdict === 'match' && (
            <p className="text-emerald-400 text-sm text-center font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Matches {registeredPlace}
            </p>
          )}
          {verdict === 'mismatch' && (
            <p className="text-red-400 text-sm text-center max-w-xs flex flex-col items-center gap-1">
              <span className="flex items-center gap-2 font-semibold">
                <XCircle className="h-4 w-4" /> That's not {registeredPlace}
              </span>
              <span className="text-white/50">
                Go to your registered spot and match the reference framing. Attempt {attempts}.
              </span>
            </p>
          )}
          {verdict === 'unavailable' && (
            <p className="text-white/60 text-sm text-center max-w-xs">
              Does this look like <span className="font-semibold text-amber-400">{registeredPlace}</span>?
            </p>
          )}
        </div>

        <div className="space-y-3 pb-4">
          {verdict !== 'mismatch' && (
            <button
              onClick={confirm}
              disabled={verdict === 'checking'}
              className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-2xl text-lg font-semibold flex items-center justify-center gap-2"
            >
              {verdict === 'checking'
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Verifying…</>
                : <><CheckCircle2 className="h-5 w-5" /> Dismiss alarm</>}
            </button>
          )}
          <button
            onClick={retake}
            className={
              verdict === 'mismatch'
                ? 'w-full h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-lg font-semibold flex items-center justify-center gap-2'
                : 'w-full h-12 text-white/60 flex items-center justify-center gap-2'
            }
          >
            <RotateCcw className="h-4 w-4" />
            Retake photo
          </button>
        </div>
      </div>

    );
  }

  /* ── Main screen ── */
  return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-6">
      <div className="flex items-center gap-3 mb-8 mt-4">
        <div className="p-3 bg-amber-500/20 rounded-2xl">
          <Camera className="h-6 w-6 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold">Photo Mission</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">

        {/* Reference photo preview (small, top) */}
        {registeredPhotoUrl && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-white/40 text-xs uppercase tracking-widest">Reference photo</p>
            <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-amber-500/40">
              <img src={registeredPhotoUrl} alt="Reference" className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        <div className="h-40 w-40 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Camera className="h-16 w-16 text-amber-400" />
        </div>

        <div>
          <h3 className="text-2xl font-bold mb-2">Get out of bed!</h3>
          <p className="text-white/50 text-sm max-w-xs">
            Walk to your{' '}
            <span className="text-amber-400 font-semibold">{registeredPlace}</span>
            {' '}and take a photo to dismiss the alarm.
          </p>
        </div>
      </div>

      <div className="pb-4">
        <button
          onClick={takePhoto}
          disabled={capturing}
          className="w-full h-14 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-2xl text-lg font-semibold flex items-center justify-center gap-2"
        >
          <Camera className="h-5 w-5" />
          {capturing ? 'Opening camera...' : 'Open Camera'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
