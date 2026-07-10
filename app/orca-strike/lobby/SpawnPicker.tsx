"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  STRIKE_ISLANDS,
  canvasPxToNormalized,
  getStrikeIsland,
  islandCropBounds,
  normalizedToCanvasPx,
  normalizedToLatLng,
  type StrikeIslandId,
} from "@/lib/scene/orcaStrike";

const MAP_SIZE_PX = 220;
const MAP_PADDING_PX = 8;

export interface SpawnPickerProps {
  islandId: StrikeIslandId;
  onIslandChange: (id: StrikeIslandId) => void;
  spawnU: number;
  spawnV: number;
  onSpawnChange: (u: number, v: number, lat: number, lng: number) => void;
}

export default function SpawnPicker({
  islandId,
  onIslandChange,
  spawnU,
  spawnV,
  onSpawnChange,
}: SpawnPickerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const island = getStrikeIsland(islandId) ?? STRIKE_ISLANDS[0];
  const crop = useMemo(() => islandCropBounds(island), [island]);

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = MAP_SIZE_PX;
    const h = MAP_SIZE_PX;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#0d3d4a");
    grad.addColorStop(0.45, "#1a6b7a");
    grad.addColorStop(1, "#2d8f6f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(180, 240, 255, 0.35)";
    ctx.lineWidth = 1;
    const gridStep = w / 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(gridStep * i, MAP_PADDING_PX);
      ctx.lineTo(gridStep * i, h - MAP_PADDING_PX);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(MAP_PADDING_PX, gridStep * i);
      ctx.lineTo(w - MAP_PADDING_PX, gridStep * i);
      ctx.stroke();
    }

    const marker = normalizedToCanvasPx(spawnU, spawnV, MAP_SIZE_PX, MAP_PADDING_PX);
    ctx.fillStyle = "#ffcf5a";
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(island.label, MAP_PADDING_PX + 4, h - MAP_PADDING_PX - 4);
  }, [island.label, spawnU, spawnV]);

  useEffect(() => {
    drawMap();
  }, [drawMap]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MAP_SIZE_PX;
    const y = ((e.clientY - rect.top) / rect.height) * MAP_SIZE_PX;
    const norm = canvasPxToNormalized(x, y, MAP_SIZE_PX, MAP_PADDING_PX);
    const latLng = normalizedToLatLng(norm.u, norm.v, crop);
    onSpawnChange(norm.u, norm.v, latLng.lat, latLng.lng);
    requestAnimationFrame(drawMap);
  };

  return (
    <div className="orca-strike-spawn-picker">
      <h2 className="orca-strike-panel-title">Pick island and spawn</h2>
      <div className="orca-strike-island-tabs">
        {STRIKE_ISLANDS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`orca-strike-island-tab${entry.id === islandId ? " is-active" : ""}`}
            onClick={() => onIslandChange(entry.id as StrikeIslandId)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="orca-strike-spawn-hint">Click the map to set spawn</p>
      <canvas
        ref={canvasRef}
        width={MAP_SIZE_PX}
        height={MAP_SIZE_PX}
        className="orca-strike-spawn-canvas"
        onClick={handleMapClick}
        role="img"
        aria-label={`Spawn map for ${island.label}`}
      />
    </div>
  );
}
