// STRIKE-W3e — O-key sonar scoring hook (sonar_new_blip, 50 pts once per blip).

import type { HydrophoneSonarEmitResult } from "./hydrophoneSonar";
import { applyScore } from "./scoring";
import { createScoringState } from "./scoring";
import type { ScoringState, ScoreEvent } from "./types";

export interface SonarScoringState {
  discoveredBlipIds: Set<string>;
  scoring: ScoringState;
}

export function createSonarScoringState(): SonarScoringState {
  return {
    discoveredBlipIds: new Set<string>(),
    scoring: createScoringState(),
  };
}

export interface SonarBlipCandidate {
  id: string;
  x: number;
  z: number;
}

export interface SonarRevealInput {
  orcaX: number;
  orcaZ: number;
  pulseRadiusM: number;
  candidates: readonly SonarBlipCandidate[];
}

/** Return blip IDs newly revealed by an expanding O-key pulse. */
export function blipsRevealedByPulse(
  input: SonarRevealInput,
  alreadyDiscovered: ReadonlySet<string>,
): string[] {
  const revealed: string[] = [];
  for (const blip of input.candidates) {
    if (alreadyDiscovered.has(blip.id)) continue;
    const dx = blip.x - input.orcaX;
    const dz = blip.z - input.orcaZ;
    const dist = Math.hypot(dx, dz);
    if (dist <= input.pulseRadiusM) {
      revealed.push(blip.id);
    }
  }
  return revealed;
}

export interface SonarScoreTickInput {
  emitResult: HydrophoneSonarEmitResult;
  sceneElapsedS: number;
  orcaX: number;
  orcaZ: number;
  candidates: readonly SonarBlipCandidate[];
}

export interface SonarScoreTickResult {
  state: SonarScoringState;
  events: ScoreEvent[];
  pointsAwarded: number;
  newlyRevealed: string[];
}

/**
 * After `hydrophoneSonar.emitSonar()`, score any blips the pulse reveals.
 * W4 passes radar/place targets as candidates each O press.
 */
export function scoreSonarEmit(
  state: SonarScoringState,
  input: SonarScoreTickInput,
): SonarScoreTickResult {
  if (input.emitResult.skipped) {
    return { state, events: [], pointsAwarded: 0, newlyRevealed: [] };
  }

  const pulse = input.emitResult.pulse;
  const age = input.sceneElapsedS - pulse.startTimeS;
  const radius =
    age <= 0 || age >= pulse.durationS
      ? pulse.maxRadiusM
      : pulse.maxRadiusM * (age / pulse.durationS);

  const newlyRevealed = blipsRevealedByPulse(
    {
      orcaX: input.orcaX,
      orcaZ: input.orcaZ,
      pulseRadiusM: radius,
      candidates: input.candidates,
    },
    state.discoveredBlipIds,
  );

  let scoring = state.scoring;
  const events: ScoreEvent[] = [];
  let pointsAwarded = 0;
  const discovered = new Set(state.discoveredBlipIds);

  for (const id of newlyRevealed) {
    discovered.add(id);
    const event: ScoreEvent = { type: "sonar_new_blip", targetId: id };
    const result = applyScore(scoring, event);
    if (result.applied) {
      scoring = result.state;
      pointsAwarded += result.points;
      events.push(event);
    }
  }

  return {
    state: { discoveredBlipIds: discovered, scoring },
    events,
    pointsAwarded,
    newlyRevealed,
  };
}

/** Merge sonar scoring totals into match scoring state. */
export function mergeSonarScoringIntoMatch(
  matchScoring: ScoringState,
  sonarScoring: ScoringState,
): ScoringState {
  if (sonarScoring.total <= matchScoring.total) return matchScoring;
  return {
    total: sonarScoring.total,
    scoredKeys: new Set(sonarScoring.scoredKeys),
    breakdown: [...sonarScoring.breakdown],
    deckWin: matchScoring.deckWin || sonarScoring.deckWin,
  };
}
