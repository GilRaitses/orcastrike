// STRIKE-W2 shared types. Pure data contracts for controls, FSM, replay, and
// island defs. No React imports in this module.

/** Pilot articulation / locomotion mode (W1b locked set). */
export type PilotMode =
  | "idle"
  | "swim"
  | "dive"
  | "surface"
  | "roll_left"
  | "roll_right"
  | "boost"
  | "breach_charge"
  | "breach_air"
  | "breach_land"
  | "blowhole_charge"
  | "blowhole_squirt";

/** WGS84 bounds as [west, south, east, north] = [minLng, minLat, maxLng, maxLat]. */
export type LatLonBounds = [west: number, south: number, east: number, north: number];

export interface IslandDefinition {
  id: string;
  label: string;
  bounds: LatLonBounds;
  /** Default spawn depth below the surface, metres (HUNT 0–25 m band). */
  defaultDepthM: number;
  /** Optional lobby thumbnail path (W3f). */
  thumb?: string;
}

/** Per-frame control snapshot consumed by the pilot FSM (W1b contract). */
export interface StrikeControls {
  forward: boolean;
  reverse: boolean;
  dive: boolean;
  surface: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  /** Space held or mashed this frame. */
  breachMash: boolean;
  /** B keydown edge this frame. */
  blowholeTap: boolean;
  /** O keydown edge this frame. */
  sonarEmit: boolean;
  /** F keydown edge this frame (HUNT radar carry-over). */
  radarPing: boolean;
  yawDelta: number;
  pitchDelta: number;
  boost: boolean;
}

/** Minimal FSM hints required by `inputAdapter` before W3a lands. */
export interface PilotFsmAdapterInput {
  mode: PilotMode;
  inBreachPhase: boolean;
  /** When false, mouse pitch is cosmetic-only (Q/E depth modes). */
  usePitchForDepth: boolean;
}

export interface ReplayVec3 {
  x: number;
  y: number;
  z: number;
}

export interface ReplayEuler {
  x: number;
  y: number;
  z: number;
}

/** One ring-buffer sample (W1d: 5 s @ 30 Hz). */
export interface ReplaySample {
  t: number;
  position: ReplayVec3;
  rotation: ReplayEuler;
  mode: PilotMode;
  charge: number;
}

export const REPLAY_BUFFER_DURATION_S = 5.0;
export const REPLAY_BUFFER_HZ = 30;
export const REPLAY_BUFFER_CAPACITY =
  Math.ceil(REPLAY_BUFFER_DURATION_S * REPLAY_BUFFER_HZ);

/** HUNT depth band lock (0–25 m below surface). */
export const STRIKE_MIN_DEPTH_M = 0;
export const STRIKE_MAX_DEPTH_M = 25;

/** Rig articulation blend weights (W1c). */
export interface RigBlendWeights {
  swim: number;
  roll: number;
  breach: number;
  blowhole: number;
}

/** STRIKE-only pose overlays applied after `driveOrca`. */
export interface MotionOverrides {
  headOffsetYaw?: number;
  headOffsetPitch?: number;
  pectoralL?: number;
  pectoralR?: number;
  jawOpen?: number;
  pitchOffsetRad?: number;
  rollOffsetRad?: number;
  flukeAmpScale?: number;
  speedScale?: number;
}

/** FSM transition side-effects for scene wiring (W4). */
export type PilotTransitionEvent =
  | { type: "breach_launch"; charge: number }
  | { type: "breach_land"; chargeAtLaunch: number; trickScored: boolean }
  | { type: "blowhole_squirt"; charge: number }
  | { type: "replay_trigger"; reason: string };

/** Per-frame FSM output consumed by adapter, breach, scoring, and scene. */
export interface PilotFsmOutput {
  mode: PilotMode;
  modeTimeS: number;
  breachCharge: number;
  blowholeCharge: number;
  airTimeS: number;
  trickSlots: number;
  depthRateMps: number;
  bodyRollTargetRad: number;
  verticalVelocityMps: number;
  breachChargeAtLaunch: number;
  rigBlend: RigBlendWeights;
  motionOverrides: MotionOverrides;
  inBreachPhase: boolean;
  usePitchForDepth: boolean;
  transitionEvents: readonly PilotTransitionEvent[];
}

/** Mutable FSM state persisted across frames. */
export interface PilotFsmState {
  mode: PilotMode;
  modeTimeS: number;
  idleTimerS: number;
  breachCharge: number;
  blowholeCharge: number;
  airTimeS: number;
  trickSlots: number;
  lastWDownS: number;
  depthRateMps: number;
  bodyRollTargetRad: number;
  prevDepthM: number;
  verticalVelocityMps: number;
  breachChargeAtLaunch: number;
  noBreachMashTimerS: number;
  worldPosY: number;
}

/** Minimal pose sample from pilot track for FSM guards. */
export interface PilotFsmPoseSample {
  depthM: number;
  yaw: number;
  pitch: number;
  roll: number;
  speedMps?: number;
}

/** Match phase machine (W1d). */
export type MatchPhase = "lobby" | "countdown" | "active" | "replay" | "ended";

export type MatchEndReason = "timer" | "deck_win" | "abort";

/** Score event IDs (locked W1d table). */
export type ScoreEventId =
  | "breach_over_kayak"
  | "blowhole_hit_kayak"
  | "ram_sink_boat"
  | "land_on_deck"
  | "sonar_new_blip"
  | "trick_t1"
  | "trick_t2"
  | "trick_t3"
  | "trick_t4";

export type TrickSlotId = "t1" | "t2" | "t3" | "t4";

export type ScoreEvent =
  | { type: "breach_over_kayak"; kayakId: string }
  | { type: "blowhole_hit_kayak"; kayakId: string }
  | { type: "ram_sink_boat"; boatId: string }
  | { type: "land_on_deck"; boatId: string }
  | { type: "sonar_new_blip"; targetId: string }
  | { type: "trick"; slot: TrickSlotId };

export interface ScoreBreakdownEntry {
  eventId: ScoreEventId;
  points: number;
  key: string;
}

export interface ScoringState {
  total: number;
  scoredKeys: Set<string>;
  breakdown: ScoreBreakdownEntry[];
  deckWin: boolean;
}

/** Lobby spawn selection for W3f / W4 scene mount. */
export interface StrikeSpawnSelection {
  islandId: string;
  lat: number;
  lng: number;
  depthM: number;
  orcaSkinId: string;
}
