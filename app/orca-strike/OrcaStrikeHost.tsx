"use client";

import dynamic from "next/dynamic";
import type { MatchState } from "@/lib/scene/orcaStrike/match";
import type { PilotFsmOutput } from "@/lib/scene/orcaStrike/types";
import type { StrikeSpawnSelection } from "@/lib/scene/orcaStrike/types";

const OrcaStrikeScene = dynamic(() => import("./OrcaStrikeScene"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
        color: "#9fb6c8",
      }}
    >
      Loading Orca Strike…
    </div>
  ),
});

export interface OrcaStrikeHostProps {
  spawn: StrikeSpawnSelection;
  match: MatchState;
  onMatchUpdate: (match: MatchState) => void;
  onFsmOutput: (fsm: PilotFsmOutput | null) => void;
}

export default function OrcaStrikeHost({
  spawn,
  match,
  onMatchUpdate,
  onFsmOutput,
}: OrcaStrikeHostProps): JSX.Element {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <OrcaStrikeScene
        spawn={spawn}
        match={match}
        onMatchUpdate={onMatchUpdate}
        onFsmOutput={onFsmOutput}
      />
    </div>
  );
}
