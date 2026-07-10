// Color ramps for the Salish Sea twin, kept consistent with the live scene.
//
// These constants and the depthColor() function are a faithful port of the
// palette intent in web/app/components/scene/SalishScene.tsx (which this module
// does NOT edit). Wave 2 should treat this file as the single palette source so
// the realism module and the live terrain agree on shoreline/depth color.
//
// SalishScene reference (read-only):
//   WATER_SHALLOW = #2e6f9e  WATER_DEEP = #0a2540
//   LAND_LOW      = #3f6b3a  LAND_HIGH  = #9aa886
//   depthColor(depth, minDepth, maxDepth): depth<0 -> shallow..deep ramp,
//     depth>=0 -> land low..high ramp.

import * as THREE from "three";

export const WATER_SHALLOW = new THREE.Color("#2e6f9e");
export const WATER_DEEP = new THREE.Color("#0a2540");
export const LAND_LOW = new THREE.Color("#3f6b3a");
export const LAND_HIGH = new THREE.Color("#9aa886");

// The flat water plane color used by the current SalishScene WaterPlane; kept
// so the animated surface can blend toward the same family the live scene used.
export const WATER_SURFACE_TINT = new THREE.Color("#1b4a6b");

/**
 * Faithful port of SalishScene.depthColor. NAVD88-style convention: negative
 * values are below sea level (water), positive values are land elevation.
 *
 * @param depth     signed elevation (negative = below 0 m, positive = above)
 * @param minDepth  most-negative depth in the field (used to normalize water)
 * @param maxDepth  most-positive elevation in the field (used to normalize land)
 */
export function depthColor(depth: number, minDepth: number, maxDepth: number): THREE.Color {
  if (depth < 0) {
    // minDepth is negative; t in [0,1] for deep.
    const t = Math.min(1, depth / minDepth);
    return WATER_SHALLOW.clone().lerp(WATER_DEEP, t);
  }
  const t = maxDepth > 0 ? Math.min(1, depth / maxDepth) : 0;
  return LAND_LOW.clone().lerp(LAND_HIGH, t);
}

/**
 * Ocean depth ramp expressed in positive depth-below-surface meters
 * (0 m at the shoreline, deeper is larger). Returns shallow->deep.
 *
 * @param depthMeters    depth below sea level, meters (>= 0)
 * @param maxDepthMeters normalization floor, meters (> 0); default 250 m,
 *                       a reasonable Haro Strait / Salish Sea channel depth.
 */
export function oceanDepthColor(depthMeters: number, maxDepthMeters = 250): THREE.Color {
  const t = maxDepthMeters > 0 ? clamp01(depthMeters / maxDepthMeters) : 0;
  return WATER_SHALLOW.clone().lerp(WATER_DEEP, t);
}

/**
 * Land elevation ramp in positive meters above sea level. Returns low->high.
 *
 * @param elevMeters    elevation above sea level, meters (>= 0)
 * @param maxElevMeters normalization ceiling, meters (> 0); default 700 m,
 *                      covering San Juan / Vancouver Island foothill relief.
 */
export function landElevationColor(elevMeters: number, maxElevMeters = 700): THREE.Color {
  const t = maxElevMeters > 0 ? clamp01(elevMeters / maxElevMeters) : 0;
  return LAND_LOW.clone().lerp(LAND_HIGH, t);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
