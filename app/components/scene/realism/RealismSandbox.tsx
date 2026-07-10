"use client";

// THROWAWAY validation harness for the realism module (Wave 1, agent A).
//
// This is NOT the live scene and must NOT be wired into SalishScene.tsx. It
// exists to exercise the realism API in a real @react-three/fiber context so
// the module is type-checked the same way the integrator will use it. The
// Wave 2 integrator applies the wiring described in WIRING-realism.md to the
// live scene instead of importing this file.
//
// Build/run note: per the parallel-wave rule this file is only type-checked,
// not served. It demonstrates the intended mount pattern.

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { applyRealism, makeSun, oceanDepthColor, landElevationColor, type RealismHandle } from ".";

function RealismRig({ date }: { date: Date }) {
  const { scene } = useThree();
  const handleRef = useRef<RealismHandle | null>(null);

  useEffect(() => {
    const handle = applyRealism(scene, {
      date,
      lat: 48.5,
      lng: -123,
      waterOptions: { width: 192, depth: 144, segments: 160 },
    });
    handleRef.current = handle;
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
  }, [scene, date]);

  useFrame((state) => {
    handleRef.current?.update(state.clock.elapsedTime);
  });

  return null;
}

// A stand-in seabed/land patch colored by the shared ramps, proving the
// palette functions return THREE.Color the same way the live terrain mesh uses.
function ColorRampProbe() {
  const deep = oceanDepthColor(200);
  const shallow = oceanDepthColor(5);
  const peak = landElevationColor(600);
  return (
    <group position={[0, 2, -30]}>
      <mesh position={[-6, 0, 0]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color={deep} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color={shallow} />
      </mesh>
      <mesh position={[6, 0, 0]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color={peak} />
      </mesh>
    </group>
  );
}

export default function RealismSandbox() {
  // Mid-afternoon local (~22:00 UTC) so the sun is comfortably up over 48.5 N.
  const date = new Date(Date.UTC(2026, 5, 21, 22, 0, 0));
  const sun = makeSun(date, 48.5, -123);
  // Touch the result so the helper is exercised and not tree-shaken in checks.
  const sunDir: THREE.Vector3 = sun.direction;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 70, 95], fov: 45, near: 0.1, far: 2000 }}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl }) => gl.setClearColor("#08263d")}
    >
      <RealismRig date={date} />
      <ColorRampProbe />
      <mesh position={sunDir.clone().multiplyScalar(40)}>
        <sphereGeometry args={[2, 16, 16]} />
        <meshBasicMaterial color="#fff4e0" />
      </mesh>
      <OrbitControls target={[0, 0, 0]} />
    </Canvas>
  );
}
