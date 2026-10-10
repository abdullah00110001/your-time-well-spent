import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

const PricingVaultScene = lazy(() => import('./PricingVaultScene'));

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function canUseWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** Pricing page: three floating crystal vaults (quartz / sapphire / tesseract). Silently absent without WebGL or reduced motion. */
export function PricingVaultStage() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setOk(!reduced && canUseWebGL());
  }, []);
  if (!ok) return null;
  return (
    <div className="relative mx-auto -mt-4 mb-10 h-[240px] max-w-4xl sm:h-[320px]">
      <GLBoundary>
        <Suspense fallback={null}>
          <PricingVaultScene />
        </Suspense>
      </GLBoundary>
    </div>
  );
}

export default PricingVaultStage;
