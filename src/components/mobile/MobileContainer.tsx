import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { isIOS, isNative } from '@/lib/capacitor/platform';

interface MobileContainerProps {
  children: ReactNode;
  className?: string;
  safeArea?: boolean;
  fullHeight?: boolean;
}

/**
 * Mobile-optimized container with safe area support
 * Provides consistent padding and layout for native apps
 */
export function MobileContainer({
  children,
  className,
  safeArea = true,
  fullHeight = true,
}: MobileContainerProps) {
  return (
    <div
      className={cn(
        'w-full mx-auto',
        fullHeight && 'min-h-screen',
        safeArea && isNative && 'safe-bottom',
        className
      )}
      style={{
        paddingTop: safeArea && isIOS ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: safeArea ? 'env(safe-area-inset-bottom)' : undefined,
        paddingLeft: safeArea ? 'env(safe-area-inset-left)' : undefined,
        paddingRight: safeArea ? 'env(safe-area-inset-right)' : undefined,
      }}
    >
      {children}
    </div>
  );
}

interface MobileScrollContainerProps {
  children: ReactNode;
  className?: string;
  bottomPadding?: number;
}

/**
 * Scrollable container optimized for mobile
 * Includes momentum scrolling and bottom padding for bottom nav
 */
export function MobileScrollContainer({
  children,
  className,
  bottomPadding = 80,
}: MobileScrollContainerProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto touch-scroll scrollbar-hide',
        className
      )}
      style={{
        paddingBottom: bottomPadding,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </div>
  );
}

interface MobileHeaderProps {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
  transparent?: boolean;
}

/**
 * Mobile header with sticky support and safe area
 */
export function MobileHeader({
  children,
  className,
  sticky = true,
  transparent = false,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'w-full z-40',
        sticky && 'sticky top-0',
        !transparent && 'bg-background/95 backdrop-blur-sm border-b border-border',
        className
      )}
      style={{
        paddingTop: isIOS ? 'env(safe-area-inset-top)' : undefined,
      }}
    >
      <div className="px-4 py-3">
        {children}
      </div>
    </header>
  );
}

interface MobileBottomBarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Fixed bottom bar with safe area support
 */
export function MobileBottomBar({
  children,
  className,
}: MobileBottomBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-background/95 backdrop-blur-lg border-t border-border',
        className
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {children}
    </div>
  );
}

interface MobileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

/**
 * Mobile-optimized card with touch feedback
 */
export function MobileCard({
  children,
  className,
  onClick,
  interactive = !!onClick,
}: MobileCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-card border border-border shadow-sm',
        interactive && 'active:scale-[0.98] active:bg-muted/50 transition-all duration-150',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

interface MobileGridProps {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

/**
 * Responsive grid for mobile layouts
 */
export function MobileGrid({
  children,
  className,
  columns = 2,
  gap = 'md',
}: MobileGridProps) {
  const gapClass = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  }[gap];

  const colClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns];

  return (
    <div className={cn('grid', colClass, gapClass, className)}>
      {children}
    </div>
  );
}
