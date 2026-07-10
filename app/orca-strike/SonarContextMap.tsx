"use client";

import { useEffect, useRef } from "react";
import type { SonarTarget } from "@/lib/scene/sonar";

const MAP_SIZE = 176;
const MAP_RADIUS_UNITS = 55;

const HUD_TEXT_STYLE: React.CSSProperties = {
  font: "11px/1.4 ui-monospace, monospace",
  color: "#cfe6ff",
};

interface SonarContextMapProps {
  orcaX: number;
  orcaZ: number;
  orcaHeadingRad: number;
  /** Filled in when a sonar ping is active; null when the ping has expired. */
  revealedTargets: SonarTarget[] | null;
  onSelectTarget?: (target: SonarTarget) => void;
}

function worldToCanvas(
  wx: number,
  wz: number,
  orcaX: number,
  orcaZ: number,
  orcaHeading: number,
): { x: number; y: number } | null {
  const dx = wx - orcaX;
  const dz = wz - orcaZ;
  const dist = Math.hypot(dx, dz);
  if (dist > MAP_RADIUS_UNITS) return null;

  const bearing = Math.atan2(-dz, dx);
  const rel = bearing - orcaHeading;
  const rx = dist * Math.cos(rel);
  const ry = dist * Math.sin(rel);
  const scale = (MAP_SIZE * 0.42) / MAP_RADIUS_UNITS;
  return {
    x: MAP_SIZE / 2 + rx * scale,
    y: MAP_SIZE / 2 - ry * scale,
  };
}

export default function SonarContextMap({
  orcaX,
  orcaZ,
  orcaHeadingRad,
  revealedTargets,
  onSelectTarget,
}: SonarContextMapProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    ctx.fillStyle = "rgba(6, 28, 44, 0.88)";
    ctx.beginPath();
    ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(120, 200, 255, 0.25)";
    ctx.lineWidth = 1;
    for (const r of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, (MAP_SIZE / 2 - 6) * r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (revealedTargets) {
      for (const target of revealedTargets) {
        const p = worldToCanvas(target.x, target.z, orcaX, orcaZ, orcaHeadingRad);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, target.kind === "boat" ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = target.kind === "boat" ? "#ff9b4a" : "#88aacc";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "rgba(207,230,255,0.45)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("ping sonar", MAP_SIZE / 2, MAP_SIZE / 2 + 4);
    }

    const cx = MAP_SIZE / 2;
    const cy = MAP_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-orcaHeadingRad + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fillStyle = "#f0f8ff";
    ctx.fill();
    ctx.strokeStyle = "#0b1a24";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "rgba(180, 220, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [orcaX, orcaZ, orcaHeadingRad, revealedTargets]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>): void {
    if (!revealedTargets || !onSelectTarget) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * MAP_SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * MAP_SIZE;

    let best: SonarTarget | null = null;
    let bestDist = 14;
    for (const target of revealedTargets) {
      const p = worldToCanvas(target.x, target.z, orcaX, orcaZ, orcaHeadingRad);
      if (!p) continue;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestDist) {
        bestDist = d;
        best = target;
      }
    }
    if (best) onSelectTarget(best);
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 88,
        width: MAP_SIZE,
        height: MAP_SIZE + 18,
        zIndex: 14,
        pointerEvents: "auto",
      }}
    >
      <div style={{ ...HUD_TEXT_STYLE, marginBottom: 4, opacity: 0.85 }}>Context map</div>
      <canvas
        ref={canvasRef}
        width={MAP_SIZE}
        height={MAP_SIZE}
        onClick={handleClick}
        style={{
          width: MAP_SIZE,
          height: MAP_SIZE,
          borderRadius: "50%",
          border: "1px solid rgba(207,230,255,0.28)",
          cursor: revealedTargets ? "pointer" : "default",
          touchAction: "manipulation",
        }}
      />
    </div>
  );
}
