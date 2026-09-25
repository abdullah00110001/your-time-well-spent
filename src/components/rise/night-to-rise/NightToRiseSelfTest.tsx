/**
 * NightToRiseSelfTest — on-device verification that Sleep to Rise is really
 * enforcing, not just showing "active" in the UI.
 *
 * Reads NightToRise.getDiagnostics() (native), which also self-heals by
 * re-syncing the polling guard service that OEM task killers silence.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isAndroid, isNative } from '@/lib/capacitor/platform';
import { nightToRiseBridge, type NativeDiagnostics } from '@/lib/capacitor/nightToRiseBridge';

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

function ago(ms: number): string {
  if (!ms) return 'never';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

export function NightToRiseSelfTest() {
  const [diag, setDiag] = useState<NativeDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      setDiag(await nightToRiseBridge.getDiagnostics());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void run(); }, [run]);

  if (!isNative || !isAndroid) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          The check runs inside the Android app only.
        </p>
      </div>
    );
  }

  const canEnforce = !!diag && (diag.accessibilityConnected || diag.overlayGranted);

  return (
    <Card className="n2r-surface">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Is protection really working?</p>
          <Button size="sm" variant="outline" onClick={() => void run()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Check</span>
          </Button>
        </div>

        {!diag ? (
          <p className="text-[11px] text-muted-foreground">Tap Check to test on this phone.</p>
        ) : (
          <div className="divide-y divide-border/60">
            <Row ok={diag.enabled} label="Sleep to Rise turned on"
                 detail={diag.enabled ? undefined : 'Turn it on above, then check again'} />
            <Row ok={diag.guardServiceRunning} label="Protection running in background"
                 detail={diag.guardServiceRunning ? undefined : 'Allow the app to run in background, then check again'} />
            <Row ok={diag.accessibilityConnected} label="Can close blocked apps"
                 detail={diag.accessibilityConnected ? undefined : 'Turn on Accessibility for Life OS'} />
            <Row ok={diag.overlayGranted} label="Can show the block screen"
                 detail={diag.overlayGranted ? undefined : 'Allow “Display over other apps”'} />
            <Row ok={diag.lastUsageAccess} label="Can see which app is open"
                 detail={diag.lastUsageAccess ? undefined : 'Allow Usage access'} />
            <Row ok={diag.allowedCount > 0} label={`${diag.allowedCount} allowed apps`}
                 detail="Everything else is blocked while a guard is on" />
            <div className="pt-2 text-[11px] text-muted-foreground">
              <p>Now: {diag.phase.replace('_', ' ').toLowerCase()}{diag.locking ? ' · blocking' : ' · not blocking'}</p>
              <p>Last check by protection: {ago(diag.lastGuardPassAt)}</p>
              <p>Last app blocked: {diag.lastBlockedPkg ? `${diag.lastBlockedPkg} (${ago(diag.lastBlockAt)})` : 'none yet'}</p>
              {diag.lastError && <p className="text-destructive">Problem: {diag.lastError}</p>}
            </div>
            {!canEnforce && (
              <p className="pt-2 text-[11px] text-destructive">
                Blocking cannot work yet — grant the missing permissions above.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
