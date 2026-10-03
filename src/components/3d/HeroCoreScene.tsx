import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Sparkles } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function cssHsl(name: string, fallback: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return new THREE.Color(fallback);
  const [h, s, l] = raw.replace(/%/g, '').split(/\s+/).map(Number);
  return new THREE.Color().setHSL(h / 360, s / 100, l / 100);
}

interface CoreProps {
  boost: React.MutableRefObject<number>;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  lowPower: boolean;
}

function QuantumCore({ boost, pointer, lowPower }: CoreProps) {
  const group = useRef<THREE.Group>(null);
  const energy = useRef<THREE.Mesh>(null);
  const rings = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const speed = useRef(1);
  const colors = useMemo(
    () => ({ primary: cssHsl('--primary', '#e0a040'), accent: cssHsl('--accent', '#40c0b0') }),
    [],
  );

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const target = boost.current ? 4 : 1;
    speed.current += (target - speed.current) * (1 - Math.exp(-4 * dt));
    const g = group.current;
    if (g) {
      const k = 1 - Math.exp(-3 * dt);
      g.rotation.x += (pointer.current.y * 0.35 - g.rotation.x) * k;
      g.rotation.y += (pointer.current.x * 0.5 - g.rotation.y) * k;
      g.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
    }
    const axes: [number, number, number][] = [[1, 0.3, 0], [0, 1, 0.4], [0.5, 0, 1]];
    rings.forEach((r, i) => {
      if (!r.current) return;
      const s = speed.current * (0.4 + i * 0.25) * dt;
      r.current.rotation.x += axes[i][0] * s;
      r.current.rotation.y += axes[i][1] * s;
      r.current.rotation.z += axes[i][2] * s;
    });
    if (energy.current) {
      const p = 1 + Math.sin(state.clock.elapsedTime * 2.4) * 0.06 * speed.current;
      energy.current.scale.setScalar(p);
      (energy.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + speed.current * 0.6;
    }
  });

  const ringColors = [colors.primary, colors.accent, colors.primary.clone().lerp(colors.accent, 0.5)];

  return (
    <group ref={group}>
      <mesh ref={energy}>
        <sphereGeometry args={[0.42, 48, 48]} />
        <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.85, 64, 64]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={1}
          roughness={0.05}
          thickness={0.8}
          ior={1.45}
          clearcoat={1}
          clearcoatRoughness={0.05}
          iridescence={lowPower ? 0 : 0.6}
          iridescenceIOR={1.3}
          transparent
          opacity={0.55}
          envMapIntensity={1.5}
        />
      </mesh>
      {rings.map((r, i) => (
        <mesh key={i} ref={r} rotation={[i * 0.9, i * 0.6, 0]}>
          <torusGeometry args={[1.3 + i * 0.22, 0.012, 12, 160]} />
          <meshStandardMaterial color={ringColors[i]} metalness={1} roughness={0.15} emissive={ringColors[i]} emissiveIntensity={0.9} />
        </mesh>
      ))}
      <Sparkles count={lowPower ? 20 : 50} scale={4.5} size={1.5} speed={0.4} color={colors.accent} />
    </group>
  );
}

export default function HeroCoreScene() {
  const boost = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const lowPower = useMemo(
    () => (navigator.hardwareConcurrency ?? 4) <= 4 || window.innerWidth < 640,
    [],
  );

  return (
    <div
      className="absolute inset-0"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
      }}
      onPointerDown={() => (boost.current = 1)}
      onPointerUp={() => (boost.current = 0)}
      onPointerLeave={() => { boost.current = 0; pointer.current = { x: 0, y: 0 }; }}
    >
      <Canvas
        dpr={lowPower ? [0.85, 1] : [1, 1.75]}
        camera={{ position: [0, 0.6, 5.6], fov: 45 }}
        gl={{ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 5, 3]} intensity={1.4} />
        <pointLight position={[0, 0, 0]} intensity={3} distance={4} />
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1.2} color="#88bbbb" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer intensity={1.2} color="#ddaa66" position={[5, -1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <QuantumCore boost={boost} pointer={pointer} lowPower={lowPower} />
      </Canvas>
    </div>
  );
}
