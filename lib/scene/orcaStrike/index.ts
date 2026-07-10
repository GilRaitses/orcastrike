// STRIKE-W3 module barrel. Pure library + lobby/HUD paths documented in asset map.

export type {
  PilotMode,
  LatLonBounds,
  IslandDefinition,
  StrikeControls,
  PilotFsmAdapterInput,
  PilotFsmOutput,
  PilotFsmState,
  PilotFsmPoseSample,
  RigBlendWeights,
  MotionOverrides,
  PilotTransitionEvent,
  ReplayVec3,
  ReplayEuler,
  ReplaySample,
  MatchPhase,
  MatchEndReason,
  ScoreEventId,
  TrickSlotId,
  ScoreEvent,
  ScoreBreakdownEntry,
  ScoringState,
  StrikeSpawnSelection,
} from "./types";

export {
  REPLAY_BUFFER_DURATION_S,
  REPLAY_BUFFER_HZ,
  REPLAY_BUFFER_CAPACITY,
  STRIKE_MIN_DEPTH_M,
  STRIKE_MAX_DEPTH_M,
} from "./types";

export {
  TILESET_LAT_LON_BOUNDS,
  STRIKE_ISLANDS,
  DEFAULT_STRIKE_ISLAND_ID,
  getStrikeIsland,
  getDefaultStrikeIsland,
  isLatLngInIsland,
  assertIslandsWithinTileset,
} from "./islands/definitions";

export type { StrikeIslandId } from "./islands/definitions";

export {
  unpackLatLonBounds,
  latLngToNormalized,
  normalizedToLatLng,
  normalizedToCanvasPx,
  canvasPxToNormalized,
  islandCropBounds,
  allIslandsCropBounds,
} from "./islands/maps";

export type { NormalizedMapPoint, LatLng } from "./islands/maps";

export {
  createStrikeControlsSampler,
  emptyStrikeControls,
} from "./controls";

export type { StrikeControlsSampler } from "./controls";

export {
  toOrcaPilotInput,
  defaultPilotFsmAdapterInput,
  toOrcaPilotInputFromFsm,
} from "./inputAdapter";

export type { AdaptedPilotInput } from "./inputAdapter";

export {
  createInitialPilotFsmState,
  tickPilotFsm,
  setPilotFsmTrickSlots,
  pilotFsmToAdapterInput,
  applyStrikeRigLayers,
  DIVE_DEPTH_RATE_MPS,
  SURFACE_DEPTH_RATE_MPS,
} from "./pilotStateMachine";

export type { PilotFsmTickResult } from "./pilotStateMachine";

export {
  SCORE_TABLE,
  TRICK_COMBO_MULTIPLIERS,
  TRICK_COMBO_CAP,
  createScoringState,
  resetScoringState,
  applyScore,
  trickSlotToEvent,
} from "./scoring";

export type { ApplyScoreResult } from "./scoring";

export {
  MATCH_COUNTDOWN_S,
  MATCH_ROUND_DURATION_S,
  MATCH_RESULTS_OVERLAY_S,
  MATCH_REPLAY_PHASE_S,
  MATCH_TIMER_WARNING_S,
  createMatchState,
  tickMatch,
  startCountdown,
  endRound,
  returnToLobby,
  applyMatchScoreEvent,
  formatMatchTimer,
  isTimerWarning,
} from "./match";

export type { MatchState, MatchTickInput } from "./match";

export {
  BREACH_CHARGE_PER_MASH,
  BREACH_MIN_LAUNCH_CHARGE,
  BREACH_REENTRY_DEPTH_M,
  ORCA_BREACH_AABB_HALF,
  KAYAK_AABB_HALF,
  TRICK_SLOT_POINTS,
  TRICK_SLOT_BITS,
  tickBreachCharge,
  isBreachLaunchGuard,
  computeBreachLaunchImpulse,
  isBreachReentry,
  tickBreachLand,
  detectBreachTrick,
  trickMotionOffsets,
  checkBreachKayakOverlaps,
  checkDeckLanding,
  shouldStartBreachReplay,
  tickBreachAirFrame,
} from "./breach";

export type {
  KayakHitbox,
  BreachLaunchImpulse,
  BreachLandResult,
  DeckLandingInput,
  BreachReplayHookInput,
  BreachAirTickInput,
  BreachAirTickResult,
} from "./breach";

export {
  BLOWHOLE_CHARGE_PER_TAP,
  BLOWHOLE_FIRE_THRESHOLD,
  BLOWHOLE_SQUIRT_DURATION_S,
  tickBlowholeCharge,
  canFireBlowhole,
  computeSquirtOrigin,
  checkSquirtConeHits,
  checkSquirtKayakAabb,
} from "./blowhole";

export type { BlowholeSquirtOrigin } from "./blowhole";

export {
  createSonarScoringState,
  blipsRevealedByPulse,
  scoreSonarEmit,
  mergeSonarScoringIntoMatch,
} from "./sonarScoring";

export type {
  SonarScoringState,
  SonarBlipCandidate,
  SonarRevealInput,
  SonarScoreTickInput,
  SonarScoreTickResult,
} from "./sonarScoring";

export {
  createHydrophoneSonar,
  hydrophonePulseRadiusAt,
  hydrophonePulseOpacityAt,
} from "./hydrophoneSonar";

export type {
  HydrophoneSonar,
  HydrophoneSonarOptions,
  HydrophoneSonarEmitResult,
  HydrophoneSonarPulseSpec,
  HydrophoneClassificationDoc,
  HydrophoneClassificationWindow,
} from "./hydrophoneSonar";

export {
  triggerBreachSplash,
  breachSplashStrengthAt,
  breachSplashToR3fProps,
} from "./vfx/breachSplash";

export type {
  BreachSplashSpec,
  BreachSplashKind,
  BreachSplashTriggerOpts,
  BreachSplashR3fProps,
} from "./vfx/breachSplash";

export {
  triggerBlowholeSpray,
  blowholeSprayStrengthAt,
  blowholeSprayToR3fProps,
} from "./vfx/blowholeSpray";

export type {
  BlowholeSpraySpec,
  BlowholeSprayTriggerOpts,
  BlowholeSprayR3fProps,
} from "./vfx/blowholeSpray";

export {
  createReplayBuffer,
  interpolateReplaySample,
} from "./replayBuffer";

export type {
  ReplayBuffer,
  ReplayBufferOptions,
  ReplayBufferPushInput,
  ReplayWindow,
} from "./replayBuffer";

export {
  createBreachCamera,
  restoreBreachCameraFov,
  BREACH_CAMERA_DEFAULT_FOV_DEG,
} from "./cameras/breachCamera";

export type { BreachCamera, BreachCameraOptions } from "./cameras/breachCamera";

export {
  createReplayCamera,
  sampleAtReplayTime,
  REPLAY_CAMERA_PLAYBACK_DURATION_S,
  REPLAY_TIME_SCALE,
} from "./cameras/replayCamera";

export type { ReplayCamera, ReplayCameraOptions } from "./cameras/replayCamera";
