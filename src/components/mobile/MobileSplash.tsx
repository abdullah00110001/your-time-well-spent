import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { isNative, hideSplash } from '@/lib/capacitor/platform';

interface MobileSplashProps {
  minimumDuration?: number;
  onComplete?: () => void;
}

/**
 * Custom splash screen with smooth transition
 * Works alongside native splash for seamless UX
 */
export function MobileSplash({
  minimumDuration = 1500,
  onComplete,
}: MobileSplashProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    // Hide native splash after minimum duration
    const timer = setTimeout(async () => {
      if (isNative) {
        await hideSplash();
      }
      
      // Start fade out animation
      setIsAnimatingOut(true);
      
      // Complete after animation
      setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 500);
    }, minimumDuration);

    return () => clearTimeout(timer);
  }, [minimumDuration, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center',
        'bg-background transition-opacity duration-500',
        isAnimatingOut && 'opacity-0'
      )}
    >
      {/* Logo/Branding */}
      <div className={cn(
        'flex flex-col items-center',
        'transition-all duration-500',
        isAnimatingOut && 'scale-110 opacity-0'
      )}>
        {/* App Icon */}
        <div className="h-24 w-24 mb-6 rounded-3xl bg-primary/10 flex items-center justify-center shadow-glacier">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-3xl font-bold text-primary-foreground">L</span>
          </div>
        </div>

        {/* App Name */}
        <h1 className="text-2xl font-bold text-foreground mb-2">Life OS</h1>
        <p className="text-sm text-muted-foreground">Your Personal Operating System</p>

        {/* Loading indicator */}
        <div className="mt-8">
          <div className="h-1 w-24 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-primary via-primary/50 to-primary" />
          </div>
        </div>
      </div>

      {/* Version info */}
      <div className="absolute bottom-8 text-center">
        <p className="text-xs text-muted-foreground">v1.0.0</p>
      </div>
    </div>
  );
}
