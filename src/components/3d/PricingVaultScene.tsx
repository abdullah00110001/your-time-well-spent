import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Sparkles } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface VaultProps {
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  hover: React.MutableRefObject<number>; // -1 none, 0/1/2 plan index
  lowPower: boolean;
}

function cssHsl(name: string, fallback: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return new THREE.Color(fallback);
  const [h, s, l] = raw.replace(/%/g, '').split(/\s+/).map(Number);
  return new THREE.Color().setHSL(h / 360, s / 100, l / 100);
}

/** Free: frosted quartz octahedron */
function Quartz({ active }: { active: boolean }) {
  const m = useRef<THREE.Mesh>(null);
  const speed = useRef(1);
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    speed.current += ((active ? 3 : 1) - speed.current) * (1 - Math.exp(-4 * dt));
    if (m.current) {
      m.current.rotation.y += 0.25 * speed.current * dt;
      m.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.07;
    }
  });
  return (
    <mesh ref={m}>
      <octahedronGeometry args={[0.72, 0]} />
      <meshPhysicalMaterial
        color="#cfd8e3"
        transmission={0.9}
        roughness={0.35}
        thickness={1.2}
        ior={1.4}
        transparent
        opacity={0.85}
        envMapIntensity={1.1}
      />
    </mesh>
  );
}

/** Premium: blue sapphire gem with inner light */
function Sapphire({ active, color }: { active: boolean; color: THREE.Color }) {
  const m = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const speed = useRef(1);
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    speed.current += ((active ? 3 : 1) - speed.current) * (1 - Math.exp(-4 * dt));
    if (m.current) {
      m.current.rotation.y += 0.35 * speed.current * dt;
      m.current.position.y = Math.sin(state.clock.elapsedTime * 0.9 + 1.2) * 0.07;
    }
    if (core.current) {
      const p = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.08;
      core.current.scale.setScalar(p);
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4 + speed.current * 0.5;
    }
  });
  return (
    <group>
      <mesh ref={m}>
        <icosahedronGeometry args={[0.68, 0]} />
        <meshPhysicalMaterial
          color={color}
          transmission={0.75}
          roughness={0.08}
          thickness={1}
          ior={1.6}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transparent
          opacity={0.92}
          envMapIntensity={1.6}
        />
      </mesh>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Ultimate: rotating golden hypercube (nested wireframe boxes) + gold dust */
function Tesseract({ active, color }: { active: boolean; color: THREE.Color }) {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const speed = useRef(1);
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    speed.current += ((active ? 3.2 : 1) - speed.current) * (1 - Math.exp(-4 * dt));
    const s = speed.current * dt;
    if (outer.current) {
      outer.current.rotation.x += 0.3 * s;
      outer.current.rotation.y += 0.42 * s;
      outer.current.position.y = Math.sin(state.clock.elapsedTime * 0.9 + 2.4) * 0.07;
    }
    if (inner.current) {
      inner.current.rotation.x -= 0.5 * s;
      inner.current.rotation.z += 0.36 * s;
      inner.current.position.y = outer.current?.position.y ?? 0;
    }
  });
  return (
    <group>
      <mesh ref={outer}>
        <boxGeometry args={[1.05, 1.05, 1.05]} />
        <meshStandardMaterial color={color} metalness={1} roughness={0.2} emissive={color} emissiveIntensity={0.35} wireframe />
      </mesh>
      <mesh ref={inner}>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial color={color} metalness={1} roughness={0.15} emissive={color} emissiveIntensity={0.9} wireframe />
      </mesh>
      <Sparkles count={active ? 40 : 18} scale={2.2} size={2} speed={active ? 1.2 : 0.5} color={color} />
    </group>
  );
}

function Vaults({ pointer, hover, lowPower }: VaultProps) {
  const group = useRef<THREE.Group>(null);
  const colors = useMemo(
    () => ({ primary: cssHsl('--primary', '#e0a040'), accent: cssHsl('--accent', '#40c0b0') }),
    [],
  );

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.exp(-3 * dt);
    g.rotation.x += (pointer.current.y * 0.12 - g.rotation.x) * k;
    g.rotation.y += (pointer.current.x * 0.18 - g.rotation.y) * k;
  });

  return (
    <group ref={group}>
      <group position={[-2.3, 0, 0]}>
        <Quartz active={hover.current === 0} />
      </group>
      <group position={[0, 0.1, 0]}>
        <Sapphire active={hover.current === 1} color={colors.accent} />
      </group>
      <group position={[2.3, 0, 0]}>
        <Tesseract active={hover.current === 2} color={colors.primary} />
      </group>
      {!lowPower && <Sparkles count={24} scale={8} size={1} speed={0.25} color={colors.accent} position={[0, -0.4, -1]} />}
    </group>
  );
}

export default function PricingVaultScene() {
  const pointer = useRef({ x: 0, y: 0 });
  const hover = useRef(-1);
  const lowPower = useMemo(
    () => (navigator.hardwareConcurrency ?? 4) <= 4 || window.innerWidth < 640,
    [],
  );

  return (
    <div
      className="absolute inset-0"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.current = { x: nx, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
        // thirds of the stage map to the three plans
        hover.current = nx < -0.33 ? 0 : nx > 0.33 ? 2 : 1;
      }}
      onPointerLeave={() => {
        pointer.current = { x: 0, y: 0 };
        hover.current = -1;
      }}
    >
      <Canvas
        dpr={lowPower ? [0.85, 1] : [1, 1.75]}
        camera={{ position: [0, 0.4, 6.4], fov: 42 }}
        gl={{ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 5, 3]} intensity={1.2} />
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1.2} color="#88bbbb" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer intensity={1.2} color="#ddaa66" position={[5, -1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <Vaults pointer={pointer} hover={hover} lowPower={lowPower} />
      </Canvas>
    </div>
  );
}
