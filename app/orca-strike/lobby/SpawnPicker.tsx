"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { STRIKE_ISLANDS, canvasPxToNormalized, getStrikeIsland, islandCropBounds, normalizedToCanvasPx, normalizedToLatLng, type StrikeIslandId } from "@/lib/scene/orcaStrike";
const MAP_SIZE_PX = 420; const MAP_PADDING_PX = 14;
export interface SpawnPickerProps { islandId: StrikeIslandId; onIslandChange:(id:StrikeIslandId)=>void; spawnU:number; spawnV:number; onSpawnChange:(u:number,v:number,lat:number,lng:number)=>void; }

/** Hand-drawn shoreline silhouettes keep the spawn portal useful before remote terrain arrives. */
// Simplified, geographically arranged silhouettes: San Juan to the west,
// Orcas to the north-east, and Lopez to the south-east. They are stylized map
// art, but preserve the islands' relative layout for an understandable portal.
const ISLAND_SHAPES: Record<string, [number, number][]> = {
  "friday-harbor": [[.055,.23],[.10,.17],[.17,.13],[.27,.105],[.37,.12],[.44,.18],[.48,.27],[.45,.35],[.41,.42],[.46,.49],[.52,.55],[.47,.61],[.39,.67],[.29,.66],[.20,.63],[.13,.57],[.08,.49]],
  "eastsound": [[.45,.15],[.51,.09],[.59,.045],[.69,.03],[.80,.07],[.89,.14],[.95,.24],[.93,.32],[.86,.39],[.79,.42],[.82,.50],[.88,.57],[.84,.63],[.75,.65],[.67,.62],[.60,.55],[.54,.48],[.48,.40],[.43,.31]],
  "iceberg-point": [[.43,.67],[.49,.60],[.59,.56],[.70,.54],[.80,.58],[.88,.65],[.92,.74],[.90,.83],[.83,.91],[.74,.95],[.65,.94],[.57,.89],[.50,.84],[.45,.76]],
};
const ISLAND_LABELS: Record<string, [string, number, number]> = {
  "friday-harbor": ["SAN JUAN", .13, .39], "eastsound": ["ORCAS", .61, .28], "iceberg-point": ["LOPEZ", .62, .76],
};
export default function SpawnPicker({islandId,onIslandChange,spawnU,spawnV,onSpawnChange}:SpawnPickerProps):JSX.Element {
 const canvasRef=useRef<HTMLCanvasElement>(null);const island=getStrikeIsland(islandId)??STRIKE_ISLANDS[0];const crop=useMemo(()=>islandCropBounds(island),[island]);
 const drawMap=useCallback(()=>{const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;const w=MAP_SIZE_PX,h=MAP_SIZE_PX;ctx.clearRect(0,0,w,h);const sea=ctx.createLinearGradient(0,0,w,h);sea.addColorStop(0,"#0a3145");sea.addColorStop(.5,"#08738a");sea.addColorStop(1,"#063a59");ctx.fillStyle=sea;ctx.fillRect(0,0,w,h);for(let i=0;i<14;i++){ctx.strokeStyle=`rgba(155,245,240,${.025+i*.004})`;ctx.beginPath();ctx.arc(w*.49,h*.49,22+i*25,0,Math.PI*2);ctx.stroke()}Object.entries(ISLAND_SHAPES).forEach(([id,shape])=>{ctx.beginPath();shape.forEach(([u,v],i)=>i?ctx.lineTo(u*w,v*h):ctx.moveTo(u*w,v*h));ctx.closePath();const active=id===island.id;ctx.fillStyle=active?"#6d9669":"#3e765d";ctx.fill();ctx.strokeStyle=active?"#fff0a5":"#b4c68a";ctx.lineWidth=active?3:1.5;ctx.stroke();const [label,u,v]=ISLAND_LABELS[id];ctx.fillStyle=active?"#fff5b5":"#d7ead2";ctx.font=`${active?"700":"600"} 12px Impact, sans-serif`;ctx.fillText(label,u*w,v*h)});const marker=normalizedToCanvasPx(spawnU,spawnV,MAP_SIZE_PX,MAP_PADDING_PX);ctx.strokeStyle="#f8f2c2";ctx.lineWidth=2;ctx.beginPath();ctx.arc(marker.x,marker.y,12,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#ffcf5a";ctx.beginPath();ctx.arc(marker.x,marker.y,6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e8fff9";ctx.font="700 15px Impact, sans-serif";ctx.fillText(island.label.toUpperCase(),20,h-24);},[island.id,island.label,spawnU,spawnV]);
 useEffect(()=>{drawMap()},[drawMap]);const click=(e:React.MouseEvent<HTMLCanvasElement>)=>{const r=canvasRef.current!.getBoundingClientRect();const n=canvasPxToNormalized((e.clientX-r.left)/r.width*MAP_SIZE_PX,(e.clientY-r.top)/r.height*MAP_SIZE_PX,MAP_SIZE_PX,MAP_PADDING_PX);const p=normalizedToLatLng(n.u,n.v,crop);onSpawnChange(n.u,n.v,p.lat,p.lng)};
 return <div className="orca-strike-spawn-picker"><h2 className="orca-strike-panel-title">Spawn portal</h2><div className="orca-strike-island-tabs">{STRIKE_ISLANDS.map(entry=><button key={entry.id} type="button" className={`orca-strike-island-tab${entry.id===islandId?" is-active":""}`} onClick={()=>onIslandChange(entry.id as StrikeIslandId)}>{entry.label}</button>)}</div><p className="orca-strike-spawn-hint">Choose a harbour approach, then click water to set your spawn.</p><canvas ref={canvasRef} width={MAP_SIZE_PX} height={MAP_SIZE_PX} className="orca-strike-spawn-canvas" onClick={click} role="img" aria-label={`Spawn map for ${island.label}`}/></div>;
}
