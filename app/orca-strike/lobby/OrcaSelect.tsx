"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { StrikeSpawnSelection } from "@/lib/scene/orcaStrike/types";
import { buildOrcaRig } from "@/lib/scene/orca/rig/OrcaRig";

export const ORCA_SKIN_OPTIONS = [
  { id: "biggs", label: "Bigg's", detail: "Open-water hunter" },
  { id: "resident", label: "Resident", detail: "Salish Sea swimmer" },
] as const;
export type OrcaSkinId = (typeof ORCA_SKIN_OPTIONS)[number]["id"];
export interface OrcaSelectProps { selectedId: OrcaSkinId; onSelect: (id: OrcaSkinId) => void; }

/** The carousel uses the same generated GPU skin rig as the playable orca.
 * It idles in a Mario-Kart-style pose: pectoral fin wave plus an articulated fluke beat. */
function PreviewOrca({ kind }: { kind: OrcaSkinId }): JSX.Element | null {
  const { scene } = useGLTF("/orca/orca.glb");
  const rig = useMemo(() => {
    scene.updateMatrixWorld(true);
    let source: THREE.Mesh | null = null;
    scene.traverse((node) => { if (!source && node instanceof THREE.Mesh) source = node; });
    if (!source) return null;
    const mesh = source as THREE.Mesh;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    geometry.translate(-box.getCenter(new THREE.Vector3()).x, -box.getCenter(new THREE.Vector3()).y, -box.getCenter(new THREE.Vector3()).z);
    const sourceMaterial = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const material = sourceMaterial.clone();
    material.color.set("#ffffff"); material.roughness = 0.22; material.envMapIntensity = 1.2;
    return { handle: buildOrcaRig(geometry, material), scale: 6.8 / Math.max(size.x, size.y, size.z), material };
  }, [scene]);
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!rig || !group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = Math.sin(t * 1.25) * 0.14;
    group.current.rotation.y = kind === "biggs" ? Math.PI * 0.62 : -Math.PI * 0.62;
    rig.handle.setFluke(t * 5.4, 0.68);
    rig.handle.setPectoral(Math.sin(t * 2.5) * 0.42, -Math.sin(t * 2.5) * 0.42);
    rig.handle.setHeadOffset(Math.sin(t * 1.1) * 0.045, 0);
  });
  useEffect(() => () => { rig?.handle.dispose(); rig?.material.dispose(); }, [rig]);
  if (!rig) return null;
  return <group ref={group} scale={rig.scale}><primitive object={rig.handle.root} /></group>;
}
function OrcaPreview({ kind }: { kind: OrcaSkinId }): JSX.Element {
  return <Canvas className="orca-strike-carousel-canvas" gl={{ alpha: true, antialias: false }} dpr={[1,1.25]} camera={{ position: [7.5, 1.6, 9.2], fov: 38 }}>
    <ambientLight intensity={1.6} color="#e8fffb" /><directionalLight position={[5,7,5]} intensity={2.5} color="#ffffff" /><pointLight position={[-4,2,2]} intensity={3} color="#5ee5db" /><PreviewOrca kind={kind} />
  </Canvas>;
}

export default function OrcaSelect({ selectedId, onSelect }: OrcaSelectProps): JSX.Element {
  const index = ORCA_SKIN_OPTIONS.findIndex((orca) => orca.id === selectedId);
  const startX = useRef<number | null>(null); const [dragging, setDragging] = useState(false);
  function move(direction: -1 | 1): void { const next=(index+direction+ORCA_SKIN_OPTIONS.length)%ORCA_SKIN_OPTIONS.length; onSelect(ORCA_SKIN_OPTIONS[next].id); }
  useEffect(() => { const cycle=window.setInterval(()=>move(1),7000); const keyboard=(event:KeyboardEvent)=>{if(event.code==="ArrowLeft")move(-1);if(event.code==="ArrowRight")move(1)};window.addEventListener("keydown",keyboard);return()=>{window.clearInterval(cycle);window.removeEventListener("keydown",keyboard)}; // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedId]);
  return <section className="orca-strike-orca-select" onPointerDown={(e)=>{startX.current=e.clientX;setDragging(true)}} onPointerUp={(e)=>{if(startX.current!==null&&Math.abs(e.clientX-startX.current)>42)move(e.clientX<startX.current?1:-1);startX.current=null;setDragging(false)}}>
    <div className="orca-strike-carousel-track" style={{transform:`translateX(-${index*50}%)`,transition:dragging?"none":"transform 480ms cubic-bezier(.2,.82,.25,1)"}}>{ORCA_SKIN_OPTIONS.map((orca)=><article className="orca-strike-carousel-slide" key={orca.id} aria-hidden={orca.id!==selectedId}><OrcaPreview kind={orca.id}/><div className={`orca-strike-carousel-copy is-${orca.id}`}><p>CHOOSE YOUR ORCA</p><h2>{orca.label}</h2><span>{orca.detail}</span></div></article>)}</div>
    <button className="orca-strike-carousel-arrow is-left" type="button" onClick={()=>move(-1)} aria-label="Previous orca">←</button><button className="orca-strike-carousel-arrow is-right" type="button" onClick={()=>move(1)} aria-label="Next orca">→</button><div className="orca-strike-carousel-dots">{ORCA_SKIN_OPTIONS.map((orca,i)=><button key={orca.id} className={i===index?"is-active":""} onClick={()=>onSelect(orca.id)} aria-label={`Choose ${orca.label}`}/>)}</div>
  </section>;
}
export function defaultOrcaSkinId(): OrcaSkinId{return ORCA_SKIN_OPTIONS[0].id;}
export function buildSpawnSelection(islandId:string,lat:number,lng:number,depthM:number,orcaSkinId:OrcaSkinId):StrikeSpawnSelection{return{islandId,lat,lng,depthM,orcaSkinId};}
