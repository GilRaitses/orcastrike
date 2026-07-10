"use client";

// Wave 2 picking-perf: a lightweight performance HUD for the integration gate.
// Reads the live `WebGLRenderer.info` and frame timing from inside the r3f loop
// and renders a fixed DOM overlay (via a portal to document.body) so the gate can
// confirm the streamed twin renders at interactive frame rate.
//
// Usage: place `<PerfHud />` ANYWHERE inside the `<Canvas>` (it needs the r3f
// context for `useThree` / `useFrame`). It draws nothing into the 3D scene; its
// readout is portalled to the document body and pinned to a screen corner.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFrame, useThree } from "@react-three/fiber";

export interface PerfSample {
  /** Mean frame time over the sampling window, milliseconds. */
  ms: number;
  /** Frames per second derived from the mean frame time. */
  fps: number;
  /** Draw calls in the last frame (`renderer.info.render.calls`). */
  calls: number;
  /** Live geometry count (`renderer.info.memory.geometries`). */
  geometries: number;
}

export interface PerfHudProps {
  /** How often to refresh the readout, milliseconds. Default 250. */
  updateMs?: number;
  /** Which screen corner to pin the overlay to. Default "top-left". */
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Optional callback fired on each refresh, e.g. to log gate metrics. */
  onSample?: (sample: PerfSample) => void;
}

const cornerStyle: Record<NonNullable<PerfHudProps["corner"]>, React.CSSProperties> = {
  "top-left": { top: 8, left: 8 },
  "top-right": { top: 8, right: 8 },
  "bottom-left": { bottom: 8, left: 8 },
  "bottom-right": { bottom: 8, right: 8 },
};

export function PerfHud({
  updateMs = 250,
  corner = "top-left",
  onSample,
}: PerfHudProps = {}) {
  const gl = useThree((state) => state.gl);
  const [sample, setSample] = useState<PerfSample>({
    ms: 0,
    fps: 0,
    calls: 0,
    geometries: 0,
  });
  // Portalling to document.body has to wait for the client; guard SSR.
  const [mounted, setMounted] = useState(false);
  const window_ = useRef({ frames: 0, elapsed: 0, last: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useFrame(() => {
    const now = performance.now();
    const w = window_.current;
    if (w.last === 0) {
      w.last = now;
      return;
    }
    w.elapsed += now - w.last;
    w.last = now;
    w.frames += 1;
    if (w.elapsed >= updateMs && w.frames > 0) {
      const ms = w.elapsed / w.frames;
      const next: PerfSample = {
        ms,
        fps: ms > 0 ? 1000 / ms : 0,
        calls: gl.info.render.calls,
        geometries: gl.info.memory.geometries,
      };
      setSample(next);
      onSample?.(next);
      w.elapsed = 0;
      w.frames = 0;
    }
  });

  if (!mounted || typeof document === "undefined") return null;

  const overlay = (
    <div
      style={{
        position: "fixed",
        ...cornerStyle[corner],
        zIndex: 1000,
        pointerEvents: "none",
        font: "11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
        color: "#d8f3ff",
        background: "rgba(8, 18, 26, 0.72)",
        border: "1px solid rgba(120, 180, 210, 0.35)",
        borderRadius: 6,
        padding: "6px 9px",
        minWidth: 116,
        backdropFilter: "blur(2px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>frame</span>
        <span>{sample.ms.toFixed(1)} ms</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>fps</span>
        <span>{sample.fps.toFixed(0)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>draw calls</span>
        <span>{sample.calls}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>geometries</span>
        <span>{sample.geometries}</span>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
