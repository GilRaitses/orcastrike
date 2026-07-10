"use client";

import { useCallback, useEffect, useState } from "react";
import { createMatchState, startCountdown } from "@/lib/scene/orcaStrike/match";
import type { MatchState } from "@/lib/scene/orcaStrike/match";
import type { PilotFsmOutput } from "@/lib/scene/orcaStrike/types";
import type { StrikeSpawnSelection } from "@/lib/scene/orcaStrike/types";
import LobbyShell from "./lobby/LobbyShell";
import OrcaStrikeHost from "./OrcaStrikeHost";
import ScoreHud from "./hud/ScoreHud";
import TrickCombo from "./hud/TrickCombo";

export default function OrcaStrikeGamePage(): JSX.Element {
  const [spawn, setSpawn] = useState<StrikeSpawnSelection | null>(null);
  const [match, setMatch] = useState<MatchState>(() => createMatchState());
  const [fsmOutput, setFsmOutput] = useState<PilotFsmOutput | null>(null);

  const handleStart = useCallback((selection: StrikeSpawnSelection) => {
    setSpawn(selection);
    setMatch(startCountdown(createMatchState()));
    setFsmOutput(null);
  }, []);

  useEffect(() => {
    if (spawn && match.phase === "lobby") {
      setSpawn(null);
      setFsmOutput(null);
    }
  }, [match.phase, spawn]);

  if (spawn) {
    return (
      <>
        <OrcaStrikeHost
          spawn={spawn}
          match={match}
          onMatchUpdate={setMatch}
          onFsmOutput={setFsmOutput}
        />
        <ScoreHud match={match} />
        <TrickCombo fsm={fsmOutput} />
      </>
    );
  }

  return <LobbyShell onStart={handleStart} />;
}
