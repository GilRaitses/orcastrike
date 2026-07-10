export type { Boat, BoatState } from "./BoatEntity";
export { SEA_LEVEL_Y } from "./BoatEntity";
export {
  DEFAULT_BOAT_COLLISION_RADIUS,
  DEFAULT_BOAT_COUNT,
  DEFAULT_MAX_RADIUS,
  DEFAULT_MIN_RADIUS,
  spawnBoats,
  type SpawnBoatsOptions,
} from "./spawnBoats";
export { checkRamCollisions } from "./collision";
export {
  MAX_SINK_DEPTH_Y,
  MAX_SINK_TILT_RAD,
  PARTICLE_BURST_PROGRESS,
  SINK_DURATION_SECONDS,
  advanceSink,
  sinkTransform,
  type SinkVisualTransform,
} from "./sinkAnimation";
export { BoatMarker, type BoatMarkerProps } from "./BoatMarker";
export type { Kayak } from "./KayakEntity";
export {
  DEFAULT_KAYAK_COUNT,
  DEFAULT_KAYAK_MAX_RADIUS,
  DEFAULT_KAYAK_MIN_RADIUS,
  spawnKayaks,
  type SpawnKayaksOptions,
} from "./spawnKayaks";
export { KayakMarker, type KayakMarkerProps } from "./KayakMarker";
