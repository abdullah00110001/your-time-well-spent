import { cn } from '@/lib/utils';

interface LifeOSLogoProps {
  size?: number;
  className?: string;
  /** Show the rounded card background (white in light, near-black in dark). */
  withCard?: boolean;
}

/**
 * Life OS app mark — a thin circle wrapping an upward arrow with a hooked tail.
 * Matches the uploaded final logo (arrow inside circle, blue gradient stroke).
 */
export function LifeOSLogo({ size = 160, className, withCard = false }: LifeOSLogoProps) {
  const px = `${size}px`;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
      role="img"
      aria-label="Life OS"
    >
      <defs>
        <linearGradient id="lifeos-arc" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7BC4F5" />
          <stop offset="55%" stopColor="#2EA3F2" />
          <stop offset="100%" stopColor="#1670C8" />
        </linearGradient>
      </defs>

      {withCard && (
        <rect x="0" y="0" width="200" height="200" rx="44" className="fill-card" />
      )}

      {/* Outer circle */}
      <circle cx="100" cy="100" r="68" stroke="url(#lifeos-arc)" strokeWidth="9" />

      {/* Upward arrow with hooked tail (chevron + vertical stem + bottom-right hook) */}
      <g
        stroke="url(#lifeos-arc)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* chevron */}
        <path d="M76 96 L100 72 L124 96" />
        {/* stem */}
        <path d="M100 72 L100 122" />
        {/* hook */}
        <path d="M100 122 L118 122" />
      </g>
    </svg>
  );
}

export default LifeOSLogo;
