"use client";

import type { StrikeSpawnSelection } from "@/lib/scene/orcaStrike/types";

export const ORCA_SKIN_OPTIONS = [
  { id: "srkw-oo14", label: "SRKW OO14", swatch: "#1a1a1a" },
  { id: "srkw-classic", label: "Classic B&W", swatch: "#f5f5f5" },
  { id: "srkw-patched", label: "Patched", swatch: "#8a8a8a" },
] as const;

export type OrcaSkinId = (typeof ORCA_SKIN_OPTIONS)[number]["id"];

export interface OrcaSelectProps {
  selectedId: OrcaSkinId;
  onSelect: (id: OrcaSkinId) => void;
}

export default function OrcaSelect({ selectedId, onSelect }: OrcaSelectProps): JSX.Element {
  return (
    <div className="orca-strike-orca-select">
      <h2 className="orca-strike-panel-title">Choose your orca</h2>
      <div className="orca-strike-skin-grid">
        {ORCA_SKIN_OPTIONS.map((skin) => {
          const active = skin.id === selectedId;
          return (
            <button
              key={skin.id}
              type="button"
              className={`orca-strike-skin-card${active ? " is-active" : ""}`}
              onClick={() => onSelect(skin.id)}
              aria-pressed={active}
            >
              <span
                className="orca-strike-skin-swatch"
                style={{ background: `linear-gradient(135deg, ${skin.swatch} 50%, #ffffff 50%)` }}
              />
              <span className="orca-strike-skin-label">{skin.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function defaultOrcaSkinId(): OrcaSkinId {
  return ORCA_SKIN_OPTIONS[0].id;
}

export function buildSpawnSelection(
  islandId: string,
  lat: number,
  lng: number,
  depthM: number,
  orcaSkinId: OrcaSkinId,
): StrikeSpawnSelection {
  return { islandId, lat, lng, depthM, orcaSkinId };
}
