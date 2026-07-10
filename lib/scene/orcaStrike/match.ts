// STRIKE-W3b — solo match phases, 180s timer, deck win (W1d). Pure state machine.

import {
  applyScore,
  createScoringState,
  resetScoringState,
  type ApplyScoreResult,
} from "./scoring";
import type { MatchEndReason, MatchPhase, ScoreEvent, ScoringState } from "./types";

export const MATCH_COUNTDOWN_S = 3;
export const MATCH_ROUND_DURATION_S = 180;
export const MATCH_RESULTS_OVERLAY_S = 8;
export const MATCH_REPLAY_PHASE_S = 3;
export const MATCH_TIMER_WARNING_S = 30;

export interface MatchState {
  phase: MatchPhase;
  phaseTimeS: number;
  roundTimeRemainingS: number;
  scoring: ScoringState;
  endReason: MatchEndReason | null;
  controlsEnabled: boolean;
  replayRequested: boolean;
}

export function createMatchState(): MatchState {
  return {
    phase: "lobby",
    phaseTimeS: 0,
    roundTimeRemainingS: MATCH_ROUND_DURATION_S,
    scoring: createScoringState(),
    endReason: null,
    controlsEnabled: true,
    replayRequested: false,
  };
}

export interface MatchTickInput {
  dt: number;
  scoreResults?: readonly ApplyScoreResult[];
  requestReplay?: boolean;
}

export function tickMatch(state: MatchState, input: MatchTickInput): MatchState {
  const dt = Number.isFinite(input.dt) && input.dt > 0 ? input.dt : 0;
  let next: MatchState = {
    ...state,
    phaseTimeS: state.phaseTimeS + dt,
    scoring: state.scoring,
  };

  if (input.scoreResults?.some((r) => r.applied && r.state.deckWin)) {
    return endRound(next, "deck_win");
  }

  if (input.requestReplay && next.phase === "active") {
    next = { ...next, replayRequested: true };
  }

  switch (next.phase) {
    case "lobby":
      next.controlsEnabled = true;
      break;
    case "countdown":
      next.controlsEnabled = false;
      if (next.phaseTimeS >= MATCH_COUNTDOWN_S) {
        next = startActivePhase(next);
      }
      break;
    case "active": {
      next.controlsEnabled = true;
      next.roundTimeRemainingS = Math.max(0, next.roundTimeRemainingS - dt);
      if (next.replayRequested) {
        next = {
          ...next,
          phase: "replay",
          phaseTimeS: 0,
          controlsEnabled: false,
        };
        break;
      }
      if (next.roundTimeRemainingS <= 0) {
        next = endRound(next, "timer");
      }
      break;
    }
    case "replay":
      next.controlsEnabled = false;
      if (next.phaseTimeS >= MATCH_REPLAY_PHASE_S) {
        next = {
          ...next,
          phase: "ended",
          phaseTimeS: 0,
          endReason: next.endReason ?? "timer",
        };
      }
      break;
    case "ended":
      next.controlsEnabled = false;
      if (next.phaseTimeS >= MATCH_RESULTS_OVERLAY_S) {
        next = returnToLobby(next);
      }
      break;
    default: {
      const _exhaustive: never = next.phase;
      return _exhaustive;
    }
  }

  if (input.scoreResults) {
    let scoring = next.scoring;
    for (const result of input.scoreResults) {
      if (result.applied) scoring = result.state;
    }
    next = { ...next, scoring };
  }

  return next;
}

export function startCountdown(state: MatchState): MatchState {
  return {
    ...state,
    phase: "countdown",
    phaseTimeS: 0,
    roundTimeRemainingS: MATCH_ROUND_DURATION_S,
    scoring: resetScoringState(),
    endReason: null,
    controlsEnabled: false,
    replayRequested: false,
  };
}

function startActivePhase(state: MatchState): MatchState {
  return {
    ...state,
    phase: "active",
    phaseTimeS: 0,
    controlsEnabled: true,
    roundTimeRemainingS: MATCH_ROUND_DURATION_S,
  };
}

export function endRound(state: MatchState, reason: MatchEndReason): MatchState {
  if (state.phase === "ended" || state.phase === "lobby") return state;
  return {
    ...state,
    phase: reason === "deck_win" ? "ended" : state.replayRequested ? "replay" : "ended",
    phaseTimeS: 0,
    endReason: reason,
    controlsEnabled: false,
    roundTimeRemainingS: reason === "deck_win" ? state.roundTimeRemainingS : 0,
  };
}

export function returnToLobby(state: MatchState): MatchState {
  return createMatchState();
}

export function applyMatchScoreEvent(
  state: MatchState,
  event: ScoreEvent,
  trickIndexInAir = 0,
): { match: MatchState; result: ApplyScoreResult } {
  const result = applyScore(state.scoring, event, trickIndexInAir);
  let match: MatchState = { ...state, scoring: result.state };
  if (result.applied && result.state.deckWin) {
    match = endRound(match, "deck_win");
  }
  return { match, result };
}

export function formatMatchTimer(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function isTimerWarning(state: MatchState): boolean {
  return (
    state.phase === "active" &&
    state.roundTimeRemainingS <= MATCH_TIMER_WARNING_S &&
    state.roundTimeRemainingS > 0
  );
}
