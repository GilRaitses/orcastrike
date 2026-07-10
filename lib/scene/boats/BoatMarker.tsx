"use client";

import { SEA_LEVEL_Y } from "./BoatEntity";
import { PARTICLE_BURST_PROGRESS, sinkTransform } from "./sinkAnimation";

export interface BoatMarkerProps {
  heading: number;
  /** 0 = floating, 1 = fully sunk. */
  sinkProgress: number;
  hovered?: boolean;
}

const BURST_DROPLETS: readonly [number, number, number][] = [
  [0.8, 0.25, 0],
  [-0.7, 0.18, 0.25],
  [0.2, 0.35, -0.7],
  [-0.1, 0.28, 0.65],
  [0.55, 0.15, 0.45],
  [-0.55, 0.22, -0.35],
];

export function BoatMarker({
  heading,
  sinkProgress,
  hovered = false,
}: BoatMarkerProps): JSX.Element {
  const transform = sinkTransform(sinkProgress);
  const burstOpacity = transform.particleBurst
    ? 1 - Math.min(1, sinkProgress / PARTICLE_BURST_PROGRESS)
    : 0;

  return (
    <group position={[0, SEA_LEVEL_Y + transform.sinkY, 0]} rotation={[0, heading, 0]}>
      <group rotation={[0, 0, -transform.tiltRad]}>
        {/* Toy hull. Its long axis follows +X, matching the scene's forward frame. */}
        <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.45, 0.95]} />
          <meshStandardMaterial
            color={hovered ? "#ff8f3d" : "#e86f2a"}
            roughness={0.55}
            emissive="#5a1f0c"
            emissiveIntensity={hovered ? 0.18 : 0.06}
          />
        </mesh>

        <mesh position={[0.15, 0.68, 0]} castShadow>
          <boxGeometry args={[0.9, 0.55, 0.62]} />
          <meshStandardMaterial
            color="#f4ead2"
            roughness={0.45}
            emissive="#6a5130"
            emissiveIntensity={hovered ? 0.12 : 0.04}
          />
        </mesh>

        <mesh position={[0.35, 1.08, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.8, 8]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
        </mesh>

        <mesh position={[0.55, 1.18, 0.16]} rotation={[0, 0, Math.PI / 2.8]} castShadow>
          <boxGeometry args={[0.08, 0.5, 0.03]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>

        {transform.particleBurst ? (
          <group>
            {BURST_DROPLETS.map(([x, y, z], index) => (
              <mesh key={index} position={[x, y, z]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial
                  color="#bfefff"
                  transparent
                  opacity={burstOpacity}
                  emissive="#5bbad8"
                  emissiveIntensity={0.15}
                />
              </mesh>
            ))}
          </group>
        ) : null}
      </group>
    </group>
  );
}
