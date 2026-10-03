import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

const HeroCoreScene = lazy(() => import('./HeroCoreScene'));

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

/** Interactive 3D "Quantum Core" behind the landing hero. Silently absent if WebGL is unavailable or reduced motion is on. */
export function HeroCore3D() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setOk(!reduced && canUseWebGL());
  }, []);
  if (!ok) return null;
  return (
    <GLBoundary>
      <Suspense fallback={null}>
        <HeroCoreScene />
      </Suspense>
    </GLBoundary>
  );
}

export default HeroCore3D;
