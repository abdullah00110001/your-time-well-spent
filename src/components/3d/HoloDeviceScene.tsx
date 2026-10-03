import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, RoundedBox, ContactShadows } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export type HoloScreen = 'shield' | 'rise' | 'muhasaba';

function cssColor(name: string, alpha = 1) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsla(${raw.split(/\s+/).join(', ')}, ${alpha})` : `rgba(0,120,200,${alpha})`;
}

const SCREENS: Record<HoloScreen, { title: string; big: string; sub: string; rows: string[] }> = {
  shield: { title: 'Shield', big: '3h 12m', sub: 'focus protected today', rows: ['Instagram · blocked', 'YouTube Shorts · blocked', 'Adult sites · filtered'] },
  rise: { title: 'Rise', big: '04:45', sub: 'Fajr alarm · Math mission', rows: ['Streak · 21 days', 'Wake score · 92', 'Group · 6 awake'] },
  muhasaba: { title: 'Night Muhasaba', big: '8 / 10', sub: 'how was today?', rows: ['5 salah on time', 'Quran · 2 pages', 'Gratitude written'] },
};

/** Draws one layer of the phone screen. layer 0 = wallpaper, 1 = cards, 2 = headline. */
function drawLayer(screen: HoloScreen, layer: number) {
  const c = document.createElement('canvas');
  c.width = 540; c.height = 1140;
  const g = c.getContext('2d')!;
  const d = SCREENS[screen];
  const primary = cssColor('--primary');
  if (layer === 0) {
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, cssColor('--background'));
    grad.addColorStop(1, cssColor('--primary', 0.35));
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = cssColor('--muted-foreground'); g.font = '600 26px sans-serif';
    g.fillText('9:41', 40, 60);
  } else if (layer === 1) {
    d.rows.forEach((r, i) => {
      const y = 600 + i * 150;
      g.fillStyle = cssColor('--card', 0.92);
      g.beginPath(); g.roundRect(36, y, 468, 120, 28); g.fill();
      g.fillStyle = primary; g.beginPath(); g.arc(96, y + 60, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = cssColor('--foreground'); g.font = '500 30px sans-serif';
      g.fillText(r, 140, y + 70);
    });
  } else {
    g.fillStyle = primary; g.font = '700 34px sans-serif'; g.fillText(d.title, 40, 180);
    g.fillStyle = cssColor('--foreground'); g.font = '800 120px sans-serif'; g.fillText(d.big, 36, 330);
    g.fillStyle = cssColor('--muted-foreground'); g.font = '400 32px sans-serif'; g.fillText(d.sub, 40, 390);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Phone({ screen, exploded }: { screen: HoloScreen; exploded: boolean }) {
  const layers = useMemo(() => [0, 1, 2].map((l) => drawLayer(screen, l)), [screen]);
  useEffect(() => () => layers.forEach((t) => t.dispose()), [layers]);
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const body = useRef<THREE.Group>(null);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const k = 1 - Math.exp(-6 * dt);
    refs.forEach((r, i) => {
      if (!r.current) return;
      const z = 0.081 + i * 0.002 + (exploded ? i * 0.45 + 0.15 : 0);
      r.current.position.z += (z - r.current.position.z) * k;
    });
    if (body.current) body.current.position.y = Math.sin(state.clock.elapsedTime) * 0.05;
  });

  return (
    <group ref={body}>
      <RoundedBox args={[1.6, 3.3, 0.16]} radius={0.2} smoothness={6}>
        <meshPhysicalMaterial color="#8a8f98" metalness={1} roughness={0.28} clearcoat={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0805]}>
        <planeGeometry args={[1.48, 3.16]} />
        <meshStandardMaterial color="#05070a" roughness={0.1} />
      </mesh>
      {layers.map((tex, i) => (
        <mesh key={i} ref={refs[i]} position={[0, 0, 0.081]}>
          <planeGeometry args={[1.42, 3.0]} />
          <meshBasicMaterial map={tex} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function HoloDeviceScene({ screen, exploded }: { screen: HoloScreen; exploded: boolean }) {
  const small = window.innerWidth < 640;
  return (
    <Canvas dpr={small ? [1, 1.25] : [1, 1.75]} camera={{ position: [-2.2, 0.4, 5.2], fov: 40 }} gl={{ alpha: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={1.5} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer intensity={1} position={[5, 0, -2]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
      </Environment>
      <Phone screen={screen} exploded={exploded} />
      <ContactShadows position={[0, -1.9, 0]} opacity={0.35} scale={6} blur={2.5} far={3} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate={!exploded} autoRotateSpeed={0.8} minPolarAngle={Math.PI / 3} maxPolarAngle={(2 * Math.PI) / 3} />
    </Canvas>
  );
}
