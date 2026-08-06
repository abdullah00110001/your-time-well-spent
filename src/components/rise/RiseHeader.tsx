import { Sunrise, Flame, ArrowLeft, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { OfflineBadge } from '@/components/OfflineGuard';

interface RiseHeaderProps {
  streak: number;
  /** When true, the back button briefly flashes red — used for hardware back interception feedback. */
  backFlash?: boolean;
}

/**
 * RiseHeader — visually mirrors ShieldHeader for cross-feature consistency.
 * The back button supports a transient `backFlash` state used by the Android
 * hardware-back interceptor in <Rise /> to give the user visual feedback that
 * back navigation was deliberately blocked.
 */
export function RiseHeader({ streak, backFlash = false }: RiseHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-background border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-all duration-200',
              backFlash
                ? 'text-red-500 bg-red-500/20 scale-110 shadow-[0_0_12px_rgba(239,68,68,0.6)]'
                : 'text-foreground/70 hover:text-foreground hover:bg-accent'
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sunrise className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold truncate text-foreground">Rise</h1>
            <p className="text-xs text-muted-foreground">Wake with Purpose</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <OfflineBadge />
          <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
            <Flame className="h-3 w-3 mr-1" />
            {streak}d
          </Badge>
          <Button variant="ghost" size="icon" className="rounded-full relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
          </Button>
        </div>
      </div>
    </div>
  );
}
