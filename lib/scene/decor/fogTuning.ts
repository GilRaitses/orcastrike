// Scenic Decorator: optional fog retuning, set dressing only.
//
// Refines the distance haze the realism rig already put on `scene.fog`. It
// operates ONLY on the fog object you pass in, never on realism/ internals. The
// color is derived from the realism `fogColorForSky(skyColor(elevationDeg))` so
// the haze stays in the live atmosphere family, then warmed toward the sun when
// the sun is low so the sun side of the sky reads warmer.
//
// Honesty: fog is a labeled atmosphere effect, not measured visibility.
//
// Note on directionality. A `THREE.Fog` color is uniform across the whole sky;
// three has no per-direction fog. So the "tinted toward the sun" refinement is a
// global warmth applied when the sun is low, strongest near the horizon, rather
// than a directional gradient. The `azimuthDeg` is accepted for parity with
// `makeSun()` but does not drive a directional tint.
//
// The frame-driven tween helpers in web/lib/scene/atmosphere/transition.ts are
// re-exported so the integrator can animate the retune over a camera cut without
// this module owning any timing.

import * as THREE from "three";
import { fogColorForSky, skyColor } from "@/app/components/scene/realism";

export {
  rollInFog,
  easeInOutCubic,
  type TweenHandle,
  type FogTarget,
  type RollInFogOptions,
} from "@/lib/scene/atmosphere/transition";

export interface FogTuningOptions {
  /** Solar elevation (deg) from `makeSun().elevationDeg`, drives the haze color. */
  elevationDeg?: number;
  /** Solar azimuth (deg). Accepted for parity; uniform fog has no direction. */
  azimuthDeg?: number;
  /** Linear fog near distance (scene units). Left unchanged when omitted. */
  near?: number;
  /** Linear fog far distance (scene units). Left unchanged when omitted. */
  far?: number;
  /**
   * How far to warm the haze toward the low-sun color, in [0, 1]. The applied
   * amount also scales down as the sun climbs, so high noon stays neutral.
   * Default 0.35.
   */
  sunWarmth?: number;
  /** Warm tint blended in at low sun. Default a sea-level sun glow. */
  sunColor?: THREE.ColorRepresentation;
}

const DEFAULTS = {
  sunWarmth: 0.35,
  sunColor: "#ffb066" as THREE.ColorRepresentation,
};

/** Haze color for a sun elevation, warmed toward the sun when the sun is low. */
export function tunedFogColor(opts: FogTuningOptions = {}): THREE.Color {
  const elev = opts.elevationDeg ?? 30;
  const base = fogColorForSky(skyColor(elev));
  // Warm strongest at/below the horizon, fading out by ~12 deg of elevation.
  const lowSun = Math.max(0, Math.min(1, (12 - elev) / 12));
  const amount = (opts.sunWarmth ?? DEFAULTS.sunWarmth) * lowSun;
  if (amount <= 0) return base;
  return base.lerp(new THREE.Color(opts.sunColor ?? DEFAULTS.sunColor), amount);
}

/**
 * Retune the passed fog in place. Sets the color from {@link tunedFogColor} and,
 * for a linear `THREE.Fog`, applies `near`/`far` when provided. Mutates only the
 * fog object you pass; it never touches realism/ or the scene.
 */
export function tuneFog(fog: THREE.Fog | THREE.FogExp2, opts: FogTuningOptions = {}): void {
  fog.color.copy(tunedFogColor(opts));
  if ((fog as THREE.Fog).isFog) {
    const linear = fog as THREE.Fog;
    if (opts.near !== undefined) linear.near = opts.near;
    if (opts.far !== undefined) linear.far = opts.far;
  }
}

/**
 * Build a fresh linear fog tuned to the sun, for callers that want to swap
 * `scene.fog` rather than mutate the realism fog. Defaults near/far to the
 * realism `makeFog` defaults so the swap is a drop-in.
 */
export function makeTunedFog(opts: FogTuningOptions = {}): THREE.Fog {
  return new THREE.Fog(tunedFogColor(opts), opts.near ?? 120, opts.far ?? 520);
}
