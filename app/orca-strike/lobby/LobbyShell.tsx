"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_STRIKE_ISLAND_ID,
  getStrikeIsland,
  type StrikeIslandId,
} from "@/lib/scene/orcaStrike";
import type { StrikeSpawnSelection } from "@/lib/scene/orcaStrike/types";
import OrcaSelect, {
  buildSpawnSelection,
  defaultOrcaSkinId,
  type OrcaSkinId,
} from "./OrcaSelect";
import SpawnPicker from "./SpawnPicker";

export interface LobbyShellProps {
  onStart?: (selection: StrikeSpawnSelection) => void;
}

export default function LobbyShell({ onStart }: LobbyShellProps): JSX.Element {
  const [orcaSkinId, setOrcaSkinId] = useState<OrcaSkinId>(defaultOrcaSkinId());
  const [islandId, setIslandId] = useState<StrikeIslandId>(DEFAULT_STRIKE_ISLAND_ID);
  const [spawnU, setSpawnU] = useState(0.5);
  const [spawnV, setSpawnV] = useState(0.5);
  const [spawnLat, setSpawnLat] = useState(48.55);
  const [spawnLng, setSpawnLng] = useState(-123.05);

  const island = useMemo(() => getStrikeIsland(islandId), [islandId]);
  const defaultDepthM = island?.defaultDepthM ?? 8;

  const handleSpawnChange = (u: number, v: number, lat: number, lng: number): void => {
    setSpawnU(u);
    setSpawnV(v);
    setSpawnLat(lat);
    setSpawnLng(lng);
  };

  const handleStart = (): void => {
    const selection = buildSpawnSelection(
      islandId,
      spawnLat,
      spawnLng,
      defaultDepthM,
      orcaSkinId,
    );
    onStart?.(selection);
  };

  return (
    <div className="orca-strike-lobby">
      <header className="orca-strike-lobby-header">
        <h1>Orca Strike</h1>
        <p className="orca-strike-lobby-sub">Solo timed round. Pick orca and spawn.</p>
      </header>
      <div className="orca-strike-orca-stage">
        <OrcaSelect selectedId={orcaSkinId} onSelect={setOrcaSkinId} />
      </div>
      <div className="orca-strike-lobby-grid">
        <SpawnPicker
          islandId={islandId}
          onIslandChange={setIslandId}
          spawnU={spawnU}
          spawnV={spawnV}
          onSpawnChange={handleSpawnChange}
        />
      </div>
      <footer className="orca-strike-lobby-footer">
        <button type="button" className="orca-strike-start-btn" onClick={handleStart}>
          Start round
        </button>
      </footer>
      <style jsx>{`
        .orca-strike-lobby {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 2rem;
          background: #061018;
          color: #e8f4ff;
          font-family: system-ui, sans-serif;
        }
        .orca-strike-lobby-header h1 {
          margin: 0;
          font-size: 1.75rem;
          letter-spacing: 0.04em;
        }
        .orca-strike-lobby-sub {
          margin: 0.35rem 0 0;
          opacity: 0.75;
          font-size: 0.95rem;
        }
        .orca-strike-orca-stage {
          position: relative;
          height: min(49vh, 430px);
          min-height: 285px;
          overflow: hidden;
          margin: -1.5rem -2rem 0;
          background: radial-gradient(ellipse at 50% 50%, rgba(21, 106, 122, 0.5), transparent 62%);
        }
        .orca-strike-lobby-grid {
          display: grid;
          grid-template-columns: minmax(240px, 560px);
          justify-content: center;
          gap: 1.25rem;
        }
        .orca-strike-lobby-footer {
          display: flex;
          justify-content: center;
        }
        .orca-strike-start-btn {
          background: #3ecfff;
          color: #041018;
          border: none;
          border-radius: 8px;
          padding: 0.85rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }
        .orca-strike-start-btn:hover {
          background: #67dbff;
        }
        :global(.orca-strike-panel-title) {
          margin: 0 0 0.75rem;
          font-size: 1rem;
          font-weight: 600;
        }
        :global(.orca-strike-orca-select) { height: 100%; position: relative; overflow: hidden; touch-action: pan-y; }
        :global(.orca-strike-carousel-track) { display: flex; width: 200%; height: 100%; }
        :global(.orca-strike-carousel-slide) { position: relative; width: 50%; height: 100%; flex: 0 0 50%; }
        :global(.orca-strike-carousel-canvas) { position: absolute !important; inset: 0; width: 100% !important; height: 100% !important; }
        :global(.orca-strike-carousel-copy) { position: absolute; left: clamp(1.25rem, 7vw, 8rem); bottom: 2rem; pointer-events: none; }
        :global(.orca-strike-carousel-copy p) { margin: 0 0 .25rem; font: .68rem ui-monospace,monospace; letter-spacing: .18em; color: #9aece4; }
        :global(.orca-strike-carousel-copy h2) { margin: 0; font-family: Impact, Haettenschweiler, "Arial Black", sans-serif; font-style: italic; font-size: clamp(2rem, 5vw, 4.2rem); letter-spacing: .015em; line-height: .9; color: #fff6d2; text-shadow: 3px 3px 0 #142c39, 0 0 18px rgba(90,235,217,.6); transform: skewX(-8deg); }
        :global(.orca-strike-carousel-copy span) { opacity: .75; }
        :global(.orca-strike-carousel-arrow) { position: absolute; top: 48%; z-index: 2; width: 3rem; height: 3rem; border-radius: 50%; border: 1px solid rgba(176,255,246,.5); background: rgba(4,24,33,.38); color: #dffffa; font-size: 1.4rem; cursor: pointer; }
        :global(.orca-strike-carousel-arrow.is-left) { left: 1.25rem; } :global(.orca-strike-carousel-arrow.is-right) { right: 1.25rem; }
        :global(.orca-strike-carousel-dots) { position: absolute; z-index: 2; bottom: 1.4rem; left: 50%; transform: translateX(-50%); display: flex; gap: .55rem; }
        :global(.orca-strike-carousel-dots button) { width: .55rem; height: .55rem; padding: 0; border: 1px solid #c8fff8; border-radius: 50%; background: transparent; cursor: pointer; }
        :global(.orca-strike-carousel-dots button.is-active) { background: #c8fff8; }
        :global(.orca-strike-island-tabs) {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-bottom: 0.75rem;
        }
        :global(.orca-strike-island-tab) {
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          border: 1px solid rgba(120, 200, 255, 0.25);
          background: rgba(8, 28, 42, 0.8);
          color: inherit;
          font-size: 0.8rem;
          cursor: pointer;
        }
        :global(.orca-strike-island-tab.is-active) {
          border-color: #3ecfff;
          background: rgba(30, 90, 120, 0.5);
        }
        :global(.orca-strike-spawn-hint) {
          margin: 0 0 0.5rem;
          font-size: 0.8rem;
          opacity: 0.7;
        }
        :global(.orca-strike-spawn-canvas) {
          width: 100%;
          max-width: 420px;
          border-radius: 8px;
          border: 1px solid rgba(120, 200, 255, 0.3);
          cursor: crosshair;
        }
      `}</style>
    </div>
  );
}

const MAP_SIZE_PX = 220;
