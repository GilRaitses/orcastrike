// Public API for the Scenic Decorator module (WS-SCENIC, phase A, producer 2).
//
// Phase-B integrator: import from "@/lib/scene/decor". See WIRING-decor.md in
// this directory for the exact mount steps and the background-ownership
// recommendation. This module owns only web/lib/scene/decor/ and the baked
// horizon asset under web/public/geo/. It reads the realism public barrel and
// sceneIntent, and edits no convergence file.

export { makeSkyDome, type SkyDomeOptions, type SkyDomeHandle, type SkyDomeMode } from "./sky";

export {
  makeHorizonRing,
  loadHorizonField,
  geoRadiusMeters,
  HORIZON_RING_URL,
  TILESET_BOUNDS,
  DEFAULT_WORLD_UNITS_PER_METER,
  type HorizonField,
  type HorizonRingOptions,
  type HorizonRingHandle,
  type HorizonRingFallback,
} from "./horizonRing";

export {
  tuneFog,
  makeTunedFog,
  tunedFogColor,
  rollInFog,
  easeInOutCubic,
  type FogTuningOptions,
  type TweenHandle,
  type FogTarget,
  type RollInFogOptions,
} from "./fogTuning";
