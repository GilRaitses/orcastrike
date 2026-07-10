"use client";

import { SEA_LEVEL_Y } from "./BoatEntity";

export interface KayakMarkerProps {
  heading: number;
}

/** Small, unsinkable civilian prop. No sink animation, no hit state: kayaks
 * are scenery the player swims around, not a target (see KayakEntity.ts). */
export function KayakMarker({ heading }: KayakMarkerProps): JSX.Element {
  return (
    <group position={[0, SEA_LEVEL_Y + 0.08, 0]} rotation={[0, heading, 0]}>
      {/* Narrow hull, long axis on +X to match the scene's forward frame.
          CapsuleGeometry's own long axis is +Y, so the mesh rotates -90deg
          about Z to lay it flat along +X. */}
      <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[0.22, 1.5, 4, 8]} />
        <meshStandardMaterial color="#ffd23f" roughness={0.5} emissive="#7a5a05" emissiveIntensity={0.08} />
      </mesh>

      {/* Paddler torso. */}
      <mesh position={[0, 0.34, 0]} castShadow>
        <capsuleGeometry args={[0.13, 0.32, 4, 8]} />
        <meshStandardMaterial color="#e0522a" roughness={0.6} />
      </mesh>

      {/* Paddle, angled across the hull. */}
      <mesh position={[0.05, 0.42, 0.28]} rotation={[0, 0, Math.PI / 3]} castShadow>
        <boxGeometry args={[0.03, 0.9, 0.09]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.55} />
      </mesh>
    </group>
  );
}
