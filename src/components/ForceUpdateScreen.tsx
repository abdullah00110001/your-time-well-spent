import { useState, useEffect } from 'react';
import { isNative } from '@/lib/capacitor/platform';
import { AppUpdate } from '@/lib/capacitor/appUpdatePlugin';
import { Download, Loader2, AlertTriangle, CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';

interface ForceUpdateScreenProps {
  downloadUrl: string;
  releaseNotes?: string | null;
  latestVersion: number;
}

type UpdatePhase = 'idle' | 'downloading' | 'installing' | 'error';

export default function ForceUpdateScreen({ downloadUrl, releaseNotes, latestVersion }: ForceUpdateScreenProps) {
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Poll download progress
  useEffect(() => {
    if (phase !== 'downloading') return;
    const interval = setInterval(async () => {
      try {
        const result = await AppUpdate.getDownloadProgress();
        if (result.progress >= 0) setProgress(result.progress);
        if (result.status === 'completed') {
          setPhase('installing');
          clearInterval(interval);
        }
        if (result.status === 'failed') {
          setPhase('error');
          setError('Download failed. Check your connection.');
          clearInterval(interval);
        }
      } catch {
        // silent
      }
    }, 500);
    return () => clearInterval(interval);
  }, [phase]);

  const handleUpdate = async () => {
    if (!isNative) {
      // Web fallback — redirect to download page
      window.location.href = '/download';
      return;
    }

    setPhase('downloading');
    setProgress(0);
    setError(null);

    try {
      await AppUpdate.downloadAndInstall({
        url: downloadUrl,
        fileName: `lifeos-v${latestVersion}.apk`,
      });
      setPhase('installing');
    } catch (e: any) {
      setPhase('error');
      setError(e?.message || 'Update failed. Please try again.');
    }
  };

  const handleRetry = () => {
    setPhase('idle');
    setError(null);
    setProgress(0);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }} />

      <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-sm mx-auto">
        {/* Icon */}
        <div className="mb-8 relative">
          <div className="h-24 w-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            {phase === 'error' ? (
              <AlertTriangle className="h-12 w-12 text-destructive" />
            ) : phase === 'installing' ? (
              <CheckCircle2 className="h-12 w-12 text-primary" />
            ) : (
              <Smartphone className="h-12 w-12 text-primary" />
            )}
          </div>
          {phase === 'downloading' && (
            <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Download className="h-4 w-4 text-primary-foreground animate-bounce" />
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
          {phase === 'error' ? 'Update Failed' : phase === 'installing' ? 'Installing...' : 'Update Required'}
        </h1>

        {/* Subtitle */}
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {phase === 'error'
            ? error
            : phase === 'installing'
            ? 'The installer has been launched. Follow the prompts to complete the update.'
            : phase === 'downloading'
            ? 'Downloading the latest version. Please wait...'
            : `Version ${latestVersion} is available with important improvements. You must update to continue using Life OS.`
          }
        </p>

        {/* Release notes */}
        {phase === 'idle' && releaseNotes && (
          <div className="w-full rounded-xl border border-border bg-muted/30 p-4 mb-6 text-left">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">What's new:</p>
            <p className="text-sm text-foreground leading-relaxed">{releaseNotes}</p>
          </div>
        )}

        {/* Progress bar */}
        {phase === 'downloading' && (
          <div className="w-full mb-6">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {progress > 0 ? `${progress}% complete` : 'Starting download...'}
            </p>
          </div>
        )}

        {/* Action buttons */}
        {phase === 'idle' && (
          <button
            onClick={handleUpdate}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <Download className="h-5 w-5" />
            Update Now
          </button>
        )}

        {phase === 'downloading' && (
          <button
            disabled
            className="w-full h-14 rounded-2xl bg-primary/60 text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Downloading...
          </button>
        )}

        {phase === 'installing' && (
          <div className="w-full space-y-3">
            <div className="h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-semibold text-base flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Installer Launched
            </div>
            <p className="text-xs text-muted-foreground">
              If the installer didn't open, tap below to retry.
            </p>
            <button
              onClick={handleUpdate}
              className="text-sm text-primary font-medium underline underline-offset-2"
            >
              Retry Install
            </button>
          </div>
        )}

        {phase === 'error' && (
          <button
            onClick={handleRetry}
            className="w-full h-14 rounded-2xl bg-destructive text-destructive-foreground font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <RefreshCw className="h-5 w-5" />
            Try Again
          </button>
        )}

        {/* Footer branding */}
        <p className="mt-10 text-[11px] text-muted-foreground/50">
          Life OS • Build Habits & Transform Your Life
        </p>
      </div>
    </div>
  );
}
