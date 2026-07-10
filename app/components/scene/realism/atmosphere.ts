// Atmosphere helpers for the Salish Sea twin: distance fog + a sky/background
// color that tracks the sun's elevation. Built only on `three`.
//
// These are mostly pure: they return Three.js objects / colors. applyRealism()
// is the one place that mutates a scene (sets scene.fog and scene.background).

import * as THREE from "three";

export interface FogOptions {
  /** Fog color; default tracks a hazy marine horizon. */
  color?: THREE.Color | string;
  /** Linear fog near distance (scene units). Default 120. */
  near?: number;
  /** Linear fog far distance (scene units). Default 520. */
  far?: number;
}

/**
 * Build a linear distance fog tuned to the SalishScene camera (positioned ~95
 * units out, far plane 2000). Pure: returns a THREE.Fog, mutates nothing.
 */
export function makeFog(opts: FogOptions = {}): THREE.Fog {
  const color = new THREE.Color(opts.color ?? "#9fb8cc");
  return new THREE.Fog(color, opts.near ?? 120, opts.far ?? 520);
}

/**
 * Sky / clear color as a function of solar elevation. Night is the deep navy
 * the live scene already clears to (#08263d); daytime brightens to a marine
 * haze. Pure.
 *
 * @param elevationDeg solar elevation from makeSun().elevationDeg
 */
export function skyColor(elevationDeg: number): THREE.Color {
  const night = new THREE.Color("#08263d"); // matches SalishScene clear color
  const dusk = new THREE.Color("#3a5a78");
  const day = new THREE.Color("#9fc4e0");

  if (elevationDeg <= 0) {
    // Below horizon: blend night -> dusk over the last 6 deg of twilight.
    const t = clamp01((elevationDeg + 6) / 6);
    return night.clone().lerp(dusk, t);
  }
  // Above horizon: dusk -> day over the first ~20 deg.
  const t = clamp01(elevationDeg / 20);
  return dusk.clone().lerp(day, t);
}

/**
 * Fog color matched to the current sky color but pulled slightly toward the
 * water so the horizon line reads as sea haze rather than open sky. Pure.
 */
export function fogColorForSky(sky: THREE.Color): THREE.Color {
  return sky.clone().lerp(new THREE.Color("#1b4a6b"), 0.35);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
