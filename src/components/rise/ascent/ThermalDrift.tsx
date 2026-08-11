/**
 * ThermalDrift — ambient upward-drifting motes behind the Rise hero.
 * Pure CSS keyframes (off the JS thread), capped at 4 elements, and fully
 * disabled under prefers-reduced-motion via the `.rise-mote` rule in index.css.
 */
const MOTES = [
  { left: '18%', delay: '0s', duration: '14s', size: 6 },
  { left: '38%', delay: '3.5s', duration: '18s', size: 4 },
  { left: '64%', delay: '7s', duration: '12s', size: 5 },
  { left: '82%', delay: '10s', duration: '16s', size: 3 },
];

export function ThermalDrift({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="rise-mote"
          style={{
            left: m.left,
            width: m.size,
            height: m.size,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
    </div>
  );
}

export default ThermalDrift;
