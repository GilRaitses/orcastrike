"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { STRIKE_ISLANDS, canvasPxToNormalized, getStrikeIsland, islandCropBounds, normalizedToCanvasPx, normalizedToLatLng, type StrikeIslandId } from "@/lib/scene/orcaStrike";
const MAP_SIZE_PX = 420; const MAP_PADDING_PX = 14;
export interface SpawnPickerProps { islandId: StrikeIslandId; onIslandChange:(id:StrikeIslandId)=>void; spawnU:number; spawnV:number; onSpawnChange:(u:number,v:number,lat:number,lng:number)=>void; }

/** Hand-drawn shoreline silhouettes keep the spawn portal useful before remote terrain arrives. */
const SHORELINES: Record<string, [number, number][]> = {
  "lopez-harbor": [[.08,.18],[.34,.08],[.55,.18],[.71,.1],[.94,.27],[.85,.48],[.96,.76],[.68,.91],[.4,.78],[.17,.88],[.06,.63]],
  "eastsound": [[.09,.16],[.42,.04],[.58,.21],[.86,.1],[.96,.37],[.76,.51],[.88,.81],[.55,.9],[.39,.7],[.1,.8],[.18,.51]],
  "san-juan-harbor": [[.06,.23],[.3,.08],[.57,.2],[.88,.1],[.94,.39],[.77,.58],[.93,.8],[.6,.92],[.4,.75],[.16,.85],[.08,.55]],
};
export default function SpawnPicker({islandId,onIslandChange,spawnU,spawnV,onSpawnChange}:SpawnPickerProps):JSX.Element {
 const canvasRef=useRef<HTMLCanvasElement>(null);const island=getStrikeIsland(islandId)??STRIKE_ISLANDS[0];const crop=useMemo(()=>islandCropBounds(island),[island]);
 const drawMap=useCallback(()=>{const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;const w=MAP_SIZE_PX,h=MAP_SIZE_PX;ctx.clearRect(0,0,w,h);const sea=ctx.createLinearGradient(0,0,w,h);sea.addColorStop(0,"#0b3446");sea.addColorStop(.55,"#075d72");sea.addColorStop(1,"#063a57");ctx.fillStyle=sea;ctx.fillRect(0,0,w,h);for(let i=0;i<18;i++){ctx.strokeStyle=`rgba(155,245,240,${.035+i*.003})`;ctx.beginPath();ctx.arc(w*.5,h*.5,30+i*20,0,Math.PI*2);ctx.stroke()}const shore=SHORELINES[island.id]??SHORELINES["san-juan-harbor"];ctx.beginPath();shore.forEach(([u,v],i)=>{const x=u*w,y=v*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fillStyle="#406e57";ctx.fill();ctx.strokeStyle="#c7b879";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="rgba(225,245,202,.35)";for(let i=0;i<shore.length;i++){const [u,v]=shore[i];ctx.beginPath();ctx.arc(u*w,v*h,12,0,Math.PI*2);ctx.fill()}const marker=normalizedToCanvasPx(spawnU,spawnV,MAP_SIZE_PX,MAP_PADDING_PX);ctx.strokeStyle="#f8f2c2";ctx.lineWidth=2;ctx.beginPath();ctx.arc(marker.x,marker.y,12,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#ffcf5a";ctx.beginPath();ctx.arc(marker.x,marker.y,6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e8fff9";ctx.font="700 15px Impact, sans-serif";ctx.letterSpacing="1px";ctx.fillText(island.label.toUpperCase(),20,h-24);},[island.id,island.label,spawnU,spawnV]);
 useEffect(()=>{drawMap()},[drawMap]);const click=(e:React.MouseEvent<HTMLCanvasElement>)=>{const r=canvasRef.current!.getBoundingClientRect();const n=canvasPxToNormalized((e.clientX-r.left)/r.width*MAP_SIZE_PX,(e.clientY-r.top)/r.height*MAP_SIZE_PX,MAP_SIZE_PX,MAP_PADDING_PX);const p=normalizedToLatLng(n.u,n.v,crop);onSpawnChange(n.u,n.v,p.lat,p.lng)};
 return <div className="orca-strike-spawn-picker"><h2 className="orca-strike-panel-title">Spawn portal</h2><div className="orca-strike-island-tabs">{STRIKE_ISLANDS.map(entry=><button key={entry.id} type="button" className={`orca-strike-island-tab${entry.id===islandId?" is-active":""}`} onClick={()=>onIslandChange(entry.id as StrikeIslandId)}>{entry.label}</button>)}</div><p className="orca-strike-spawn-hint">Choose a harbour approach, then click water to set your spawn.</p><canvas ref={canvasRef} width={MAP_SIZE_PX} height={MAP_SIZE_PX} className="orca-strike-spawn-canvas" onClick={click} role="img" aria-label={`Spawn map for ${island.label}`}/></div>;
}
