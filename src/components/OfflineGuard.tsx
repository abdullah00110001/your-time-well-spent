import { useState, createContext, useContext, ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Provides a `requireOnline(action)` helper to children. When called offline,
 * a friendly "No Internet" modal is shown instead of running the action.
 */

type Ctx = {
  online: boolean;
  requireOnline: (action: () => void, featureName?: string) => void;
};

const OfflineGuardContext = createContext<Ctx | null>(null);

export function useOfflineGuard() {
  const ctx = useContext(OfflineGuardContext);
  if (!ctx) {
    // Safe no-op fallback so the helper is always callable.
    return {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      requireOnline: (a: () => void) => a(),
    };
  }
  return ctx;
}

export function OfflineGuardProvider({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const [blocked, setBlocked] = useState<string | null>(null);

  const requireOnline = (action: () => void, featureName?: string) => {
    if (online) action();
    else setBlocked(featureName || 'this feature');
  };

  return (
    <OfflineGuardContext.Provider value={{ online, requireOnline }}>
      {children}
      <Dialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent className="max-w-sm rounded-3xl border-border bg-card text-foreground">
          <DialogHeader className="items-center text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-bold">No Internet Connection</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {blocked} needs an active connection. Reconnect to Wi-Fi or mobile data and try again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setBlocked(null)} className="w-full h-11 rounded-2xl font-semibold">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OfflineGuardContext.Provider>
  );
}

/** Tiny status pill — shown anywhere on demand. */
export function OfflineBadge() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold">
      <WifiOff className="h-3 w-3" />
      Offline
    </div>
  );
}
