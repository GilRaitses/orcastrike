"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Water boundary with a camera-following meniscus. A giant world-space ring is
 * easy to lose beyond the fog horizon; this disc/ring follows the camera in XZ
 * so the bright underside of y=0 is always visible while swimming upward.
 */
export function SeaSurface(): JSX.Element {
  const camera = useThree((state) => state.camera);
  const meniscus = useRef<THREE.Group>(null);
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const belowSurfaceRef = useRef(false);
  const discGeometry = useMemo(() => new THREE.CircleGeometry(115, 96), []);

  useFrame(() => {
    const below = camera.position.y < 0.3;
    belowSurfaceRef.current = below;
    if (meniscus.current) {
      meniscus.current.position.set(camera.position.x, 0.045, camera.position.z);
      meniscus.current.visible = below;
    }
    if (glowMaterial.current) glowMaterial.current.opacity = below ? 0.52 : 0.08;
  });

  return <group>
    {/* Camera-local underside: bright Fresnel-like meniscus that reads through fog. */}
    <group ref={meniscus} renderOrder={20}>
      <mesh rotation-x={-Math.PI / 2} geometry={discGeometry} renderOrder={20}>
        <meshBasicMaterial ref={glowMaterial} color="#bafff8" transparent opacity={0.52} depthWrite={false} depthTest={false} side={THREE.BackSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} renderOrder={21}>
        <ringGeometry args={[76, 114, 96]} />
        <meshBasicMaterial color="#e5fffc" transparent opacity={0.74} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
    </group>

    {/* Broad physical surface film remains present for above-water views. */}
    <mesh rotation-x={-Math.PI / 2} position-y={0} renderOrder={5}>
      <planeGeometry args={[500, 500, 48, 48]} />
      <meshPhysicalMaterial color="#4bc8d8" roughness={0.08} metalness={0.18} transmission={0.35} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  </group>;
}
