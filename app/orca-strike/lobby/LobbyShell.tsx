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
      <div className="orca-strike-lobby-grid">
        <OrcaSelect selectedId={orcaSkinId} onSelect={setOrcaSkinId} />
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
        .orca-strike-lobby-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.25rem;
          flex: 1;
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
        :global(.orca-strike-skin-grid) {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        :global(.orca-strike-skin-card) {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(120, 200, 255, 0.25);
          background: rgba(8, 28, 42, 0.8);
          color: inherit;
          cursor: pointer;
          text-align: left;
        }
        :global(.orca-strike-skin-card.is-active) {
          border-color: #3ecfff;
          box-shadow: 0 0 0 1px #3ecfff;
        }
        :global(.orca-strike-skin-swatch) {
          width: 36px;
          height: 24px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
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
          max-width: ${MAP_SIZE_PX}px;
          border-radius: 8px;
          border: 1px solid rgba(120, 200, 255, 0.3);
          cursor: crosshair;
        }
      `}</style>
    </div>
  );
}

const MAP_SIZE_PX = 220;
