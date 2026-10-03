import { lazy, Suspense, useEffect, useState } from 'react';
import { Shield, Sunrise, Moon, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HoloScreen } from './HoloDeviceScene';

const HoloDeviceScene = lazy(() => import('./HoloDeviceScene'));

const TABS: { id: HoloScreen; label: string; icon: typeof Shield }[] = [
  { id: 'shield', label: 'Shield', icon: Shield },
  { id: 'rise', label: 'Rise', icon: Sunrise },
  { id: 'muhasaba', label: 'Muhasaba', icon: Moon },
];

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** Features page: rotatable 3D phone showing a live Life OS screen, with an exploded-layers view. */
export function HoloDeviceStage() {
  const [screen, setScreen] = useState<HoloScreen>('shield');
  const [exploded, setExploded] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(webglOk()), []);
  if (!ok) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16">
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-b from-card to-muted/40">
        <div className="absolute inset-x-0 top-1/3 mx-auto h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative h-[420px] sm:h-[520px] cursor-grab active:cursor-grabbing">
          <Suspense fallback={null}>
            <HoloDeviceScene screen={screen} exploded={exploded} />
          </Suspense>
        </div>
        <div className="relative flex flex-wrap items-center justify-center gap-2 border-t border-border/50 bg-background/60 p-3 backdrop-blur">
          {TABS.map((t) => (
            <Button key={t.id} size="sm" variant={screen === t.id ? 'default' : 'ghost'} onClick={() => setScreen(t.id)} className="gap-1.5 rounded-full">
              <t.icon className="h-4 w-4" /> {t.label}
            </Button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant={exploded ? 'default' : 'outline'} onClick={() => setExploded((v) => !v)} className="gap-1.5 rounded-full">
            <Layers className="h-4 w-4" /> {exploded ? 'Assemble' : 'Explode view'}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Drag to rotate the phone</p>
    </section>
  );
}

export default HoloDeviceStage;
