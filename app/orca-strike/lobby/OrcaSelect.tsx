"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { StrikeSpawnSelection } from "@/lib/scene/orcaStrike/types";

export const ORCA_SKIN_OPTIONS = [
  { id: "biggs", label: "Bigg's", detail: "Open-water hunter", tint: "#ffffff" },
  { id: "resident", label: "Resident", detail: "Salish Sea swimmer", tint: "#ffffff" },
] as const;
export type OrcaSkinId = (typeof ORCA_SKIN_OPTIONS)[number]["id"];
export interface OrcaSelectProps { selectedId: OrcaSkinId; onSelect: (id: OrcaSkinId) => void; }

function PreviewOrca(): JSX.Element {
  const { scene } = useGLTF("/orca/orca.glb");
  const model = useMemo(() => clone(scene), [scene]);
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 1.35) * 0.18;
    group.current.rotation.y = -0.55 + Math.sin(state.clock.elapsedTime * 0.45) * 0.13;
  });
  useMemo(() => model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const material = node.material as THREE.MeshStandardMaterial;
    if (material?.isMeshStandardMaterial) { material.envMapIntensity = 1.05; material.color.set("#ffffff"); }
  }), [model]);
  return <group ref={group} rotation={[0, -0.5, 0]} scale={0.92}><primitive object={model} /></group>;
}
function OrcaPreview(): JSX.Element {
  return <Canvas className="orca-strike-carousel-canvas" gl={{ alpha: true, antialias: false }} dpr={[1,1.35]} camera={{ position: [7.8, 2.8, 8.6], fov: 40 }}>
    <ambientLight intensity={1.3} color="#dcfffb" /><directionalLight position={[5,7,5]} intensity={2.3} color="#ffffff" /><pointLight position={[-4,2,2]} intensity={2.8} color="#5ee5db" /><PreviewOrca />
  </Canvas>;
}

export default function OrcaSelect({ selectedId, onSelect }: OrcaSelectProps): JSX.Element {
  const index = ORCA_SKIN_OPTIONS.findIndex((orca) => orca.id === selectedId);
  const startX = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  function move(direction: -1 | 1): void { const next = (index + direction + ORCA_SKIN_OPTIONS.length) % ORCA_SKIN_OPTIONS.length; onSelect(ORCA_SKIN_OPTIONS[next].id); }
  useEffect(() => {
    const cycle = window.setInterval(() => move(1), 5000);
    const keyboard = (event: KeyboardEvent) => { if (event.code === "ArrowLeft") move(-1); if (event.code === "ArrowRight") move(1); };
    window.addEventListener("keydown", keyboard);
    return () => { window.clearInterval(cycle); window.removeEventListener("keydown", keyboard); };
  // The carousel only needs to re-register when selected type changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  return <section className="orca-strike-orca-select" onPointerDown={(e)=>{startX.current=e.clientX;setDragging(true)}} onPointerUp={(e)=>{if(startX.current!==null&&Math.abs(e.clientX-startX.current)>42)move(e.clientX<startX.current?1:-1);startX.current=null;setDragging(false)}}>
    <div className="orca-strike-carousel-track" style={{ transform:`translateX(-${index*50}%)`, transition: dragging ? "none" : "transform 480ms cubic-bezier(.2,.82,.25,1)" }}>
      {ORCA_SKIN_OPTIONS.map((orca) => <article className="orca-strike-carousel-slide" key={orca.id} aria-hidden={orca.id!==selectedId}><OrcaPreview /><div className="orca-strike-carousel-copy"><p>CHOOSE YOUR ORCA</p><h2>{orca.label}</h2><span>{orca.detail}</span></div></article>)}
    </div>
    <button className="orca-strike-carousel-arrow is-left" type="button" onClick={()=>move(-1)} aria-label="Previous orca">←</button><button className="orca-strike-carousel-arrow is-right" type="button" onClick={()=>move(1)} aria-label="Next orca">→</button>
    <div className="orca-strike-carousel-dots">{ORCA_SKIN_OPTIONS.map((orca,i)=><button key={orca.id} className={i===index?"is-active":""} onClick={()=>onSelect(orca.id)} aria-label={`Choose ${orca.label}`}/>)}</div>
  </section>;
}
export function defaultOrcaSkinId(): OrcaSkinId { return ORCA_SKIN_OPTIONS[0].id; }
export function buildSpawnSelection(islandId: string, lat: number, lng: number, depthM: number, orcaSkinId: OrcaSkinId): StrikeSpawnSelection { return { islandId, lat, lng, depthM, orcaSkinId }; }
