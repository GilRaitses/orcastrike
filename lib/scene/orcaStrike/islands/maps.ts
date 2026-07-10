// STRIKE-W2a — lat/lon crop helpers for SonarContextMap-style minimap thumbnails
// and the W3f spawn picker.

import type { LatLonBounds } from "../types";
import type { IslandDefinition } from "../types";
import { TILESET_LAT_LON_BOUNDS } from "./definitions";

export interface NormalizedMapPoint {
  /** 0 = west edge, 1 = east edge of the crop bounds. */
  u: number;
  /** 0 = south edge, 1 = north edge of the crop bounds. */
  v: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Decompose [west, south, east, north] into scalar edges. */
export function unpackLatLonBounds(bounds: LatLonBounds): {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
} {
  const [west, south, east, north] = bounds;
  return {
    west,
    south,
    east,
    north,
    width: east - west,
    height: north - south,
  };
}

/** Map WGS84 to normalized 0–1 within `cropBounds`. Clamps to [0, 1]. */
export function latLngToNormalized(
  lat: number,
  lng: number,
  cropBounds: LatLonBounds,
): NormalizedMapPoint {
  const { west, south, width, height } = unpackLatLonBounds(cropBounds);
  if (width <= 0 || height <= 0) {
    return { u: 0.5, v: 0.5 };
  }
  const u = clamp01((lng - west) / width);
  const v = clamp01((lat - south) / height);
  return { u, v };
}

/** Inverse of `latLngToNormalized` for spawn picker click → lat/lon. */
export function normalizedToLatLng(
  u: number,
  v: number,
  cropBounds: LatLonBounds,
): LatLng {
  const { west, south, width, height } = unpackLatLonBounds(cropBounds);
  return {
    lng: west + clamp01(u) * width,
    lat: south + clamp01(v) * height,
  };
}

/**
 * Map normalized island coords to canvas pixels (SonarContextMap-style square
 * crop). Origin top-left; v increases upward on the map (north = top).
 */
export function normalizedToCanvasPx(
  u: number,
  v: number,
  mapSizePx: number,
  paddingPx = 0,
): { x: number; y: number } {
  const inner = Math.max(1, mapSizePx - paddingPx * 2);
  return {
    x: paddingPx + clamp01(u) * inner,
    y: paddingPx + (1 - clamp01(v)) * inner,
  };
}

/** Canvas click → normalized coords for an island thumbnail. */
export function canvasPxToNormalized(
  x: number,
  y: number,
  mapSizePx: number,
  paddingPx = 0,
): NormalizedMapPoint {
  const inner = Math.max(1, mapSizePx - paddingPx * 2);
  const u = clamp01((x - paddingPx) / inner);
  const v = clamp01(1 - (y - paddingPx) / inner);
  return { u, v };
}

/** Crop bounds for a single island (defaults to its own bounds). */
export function islandCropBounds(island: IslandDefinition): LatLonBounds {
  return island.bounds;
}

/** Crop bounds that frame all STRIKE islands inside the tileset (full context). */
export function allIslandsCropBounds(
  islands: readonly IslandDefinition[],
  fallback: LatLonBounds = TILESET_LAT_LON_BOUNDS,
): LatLonBounds {
  if (islands.length === 0) return fallback;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const island of islands) {
    const [w, s, e, n] = island.bounds;
    west = Math.min(west, w);
    south = Math.min(south, s);
    east = Math.max(east, e);
    north = Math.max(north, n);
  }
  return [west, south, east, north];
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
