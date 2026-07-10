"use client";

import { SEA_LEVEL_Y } from "./BoatEntity";
import { PARTICLE_BURST_PROGRESS, sinkTransform } from "./sinkAnimation";

export interface BoatMarkerProps {
  heading: number;
  sinkProgress: number;
  hovered?: boolean;
  /** 0 skiff, 1 cabin cruiser, 2 workboat — arcade props, not traffic. */
  variant?: number;
}

const BURST_DROPLETS: readonly [number, number, number][] = [[1.4,.3,0],[-1.1,.22,.35],[.3,.45,-.9],[-.2,.34,.8],[.8,.2,.55],[-.8,.25,-.48]];

export function BoatMarker({ heading, sinkProgress, hovered = false, variant = 0 }: BoatMarkerProps): JSX.Element {
  const transform = sinkTransform(sinkProgress);
  const burstOpacity = transform.particleBurst ? 1 - Math.min(1, sinkProgress / PARTICLE_BURST_PROGRESS) : 0;
  const isCruiser = variant === 1;
  const isWorkboat = variant === 2;
  const length = isCruiser ? 6.8 : isWorkboat ? 5.2 : 4.4;
  const beam = isCruiser ? 2.15 : isWorkboat ? 1.7 : 1.45;
  const hullColor = isCruiser ? "#edf2ec" : isWorkboat ? "#d85b35" : "#e8a83c";
  return <group position={[0, SEA_LEVEL_Y + transform.sinkY, 0]} rotation={[0, heading, 0]}>
    <group rotation={[0, 0, -transform.tiltRad]}>
      <mesh position={[0,.34,0]} castShadow receiveShadow><boxGeometry args={[length,.62,beam]}/><meshStandardMaterial color={hovered?"#ff9e46":hullColor} roughness={.48} emissive="#422016" emissiveIntensity={.05}/></mesh>
      <mesh position={[0,.69,0]} castShadow><boxGeometry args={[length*.72,.18,beam*.78]}/><meshStandardMaterial color={isWorkboat?"#25343a":"#f7f2dd"} roughness={.55}/></mesh>
      {isCruiser && <><mesh position={[.25,1.15,0]} castShadow><boxGeometry args={[2.4,.85,1.32]}/><meshStandardMaterial color="#d9f0ee" roughness={.32}/></mesh><mesh position={[.25,1.2,beam*.51]}><boxGeometry args={[1.45,.38,.04]}/><meshStandardMaterial color="#16394a" emissive="#0c3046" emissiveIntensity={.35}/></mesh></>}
      {isWorkboat && <><mesh position={[-.45,1.08,0]} castShadow><boxGeometry args={[1.45,.95,1.15]}/><meshStandardMaterial color="#f0e7d7" roughness={.48}/></mesh><mesh position={[1.2,1.32,0]}><cylinderGeometry args={[.045,.045,1.65,8]}/><meshStandardMaterial color="#283439"/></mesh></>}
      {!isCruiser && !isWorkboat && <><mesh position={[.2,.95,0]} castShadow><boxGeometry args={[1.5,.62,.9]}/><meshStandardMaterial color="#f5ead4" roughness={.45}/></mesh><mesh position={[.7,1.25,0]}><cylinderGeometry args={[.035,.035,.95,8]}/><meshStandardMaterial color="#2a2a2a"/></mesh></>}
      {transform.particleBurst && <group>{BURST_DROPLETS.map(([x,y,z],i)=><mesh key={i} position={[x,y,z]}><sphereGeometry args={[.1,8,8]}/><meshStandardMaterial color="#bfefff" transparent opacity={burstOpacity}/></mesh>)}</group>}
    </group>
  </group>;
}
