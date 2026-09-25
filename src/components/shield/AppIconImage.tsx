import { cn } from '@/lib/utils';

interface AppIconImageProps {
  /** base64 data-URL from the native plugin (real launcher icon). */
  icon?: string;
  appName: string;
  className?: string;
}

/**
 * Shows the REAL installed app icon coming from Android's PackageManager.
 * Falls back to the app's initial when no icon is available (web preview).
 */
export function AppIconImage({ icon, appName, className }: AppIconImageProps) {
  const base = 'h-10 w-10 shrink-0 rounded-xl object-cover';

  if (icon) {
    return <img src={icon} alt={`${appName} icon`} loading="lazy" className={cn(base, className)} />;
  }

  return (
    <div
      className={cn(
        base,
        'flex items-center justify-center bg-primary/10 text-sm font-bold text-primary',
        className,
      )}
      aria-hidden
    >
      {appName.charAt(0).toUpperCase()}
    </div>
  );
}

export default AppIconImage;
