"use client";

import * as THREE from "three";

/** Thin sea surface at y=0 — visible boundary, not a milky volume. */
export function SeaSurface(): JSX.Element {
  return (
    <group>
      {/* Bright meniscus when looking up from below */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.03} renderOrder={6}>
        <ringGeometry args={[0, 500, 72]} />
        <meshBasicMaterial
          color="#d8f8ff"
          transparent
          opacity={0.28}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Surface film — mostly transparent so you can see through the water */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} renderOrder={5}>
        <planeGeometry args={[500, 500]} />
        <meshPhysicalMaterial
          color="#2a7aaa"
          roughness={0.02}
          metalness={0.2}
          transmission={0.72}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
