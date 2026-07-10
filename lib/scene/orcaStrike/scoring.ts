// STRIKE-W3b — locked score table + once-per-round idempotency (W1d).

import type {
  ScoreBreakdownEntry,
  ScoreEvent,
  ScoreEventId,
  ScoringState,
  TrickSlotId,
} from "./types";

export const SCORE_TABLE: Record<ScoreEventId, number> = {
  breach_over_kayak: 500,
  blowhole_hit_kayak: 300,
  ram_sink_boat: 200,
  land_on_deck: 1000,
  sonar_new_blip: 50,
  trick_t1: 100,
  trick_t2: 100,
  trick_t3: 150,
  trick_t4: 200,
};

export const TRICK_COMBO_MULTIPLIERS = [1, 1.25, 1.5] as const;
export const TRICK_COMBO_CAP = 400;

export function createScoringState(): ScoringState {
  return {
    total: 0,
    scoredKeys: new Set<string>(),
    breakdown: [],
    deckWin: false,
  };
}

export function resetScoringState(): ScoringState {
  return createScoringState();
}

function eventToId(event: ScoreEvent): ScoreEventId {
  switch (event.type) {
    case "breach_over_kayak":
      return "breach_over_kayak";
    case "blowhole_hit_kayak":
      return "blowhole_hit_kayak";
    case "ram_sink_boat":
      return "ram_sink_boat";
    case "land_on_deck":
      return "land_on_deck";
    case "sonar_new_blip":
      return "sonar_new_blip";
    case "trick":
      return `trick_${event.slot}` as ScoreEventId;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

function scoreKey(event: ScoreEvent): string {
  switch (event.type) {
    case "breach_over_kayak":
      return `breach_over_kayak:${event.kayakId}`;
    case "blowhole_hit_kayak":
      return `blowhole_hit_kayak:${event.kayakId}`;
    case "ram_sink_boat":
      return `ram_sink_boat:${event.boatId}`;
    case "land_on_deck":
      return `land_on_deck:${event.boatId}`;
    case "sonar_new_blip":
      return `sonar_new_blip:${event.targetId}`;
    case "trick":
      return `trick:${event.slot}`;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export interface ApplyScoreResult {
  state: ScoringState;
  points: number;
  applied: boolean;
  eventId: ScoreEventId;
}

export function applyScore(
  state: ScoringState,
  event: ScoreEvent,
  trickIndexInAir = 0,
): ApplyScoreResult {
  const key = scoreKey(event);
  if (state.scoredKeys.has(key)) {
    return {
      state,
      points: 0,
      applied: false,
      eventId: eventToId(event),
    };
  }

  const eventId = eventToId(event);
  let points = SCORE_TABLE[eventId];

  if (event.type === "trick") {
    const mult = TRICK_COMBO_MULTIPLIERS[Math.min(trickIndexInAir, TRICK_COMBO_MULTIPLIERS.length - 1)];
    points = Math.min(TRICK_COMBO_CAP, Math.round(points * mult));
  }

  const nextKeys = new Set(state.scoredKeys);
  nextKeys.add(key);

  const entry: ScoreBreakdownEntry = { eventId, points, key };
  const next: ScoringState = {
    total: state.total + points,
    scoredKeys: nextKeys,
    breakdown: [...state.breakdown, entry],
    deckWin: state.deckWin || event.type === "land_on_deck",
  };

  return { state: next, points, applied: true, eventId };
}

export function trickSlotToEvent(slot: TrickSlotId): ScoreEvent {
  return { type: "trick", slot };
}
