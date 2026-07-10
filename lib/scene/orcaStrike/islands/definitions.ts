// STRIKE-W2a — named spawn regions within the HUNT tileset bounds.
// TILESET_BOUNDS (OrcaStrikeScene): lat 48.4–48.7, lng -123.25..-122.75.

import type { IslandDefinition, LatLonBounds } from "../types";

/** Full tileset geographic envelope (reference only). */
export const TILESET_LAT_LON_BOUNDS: LatLonBounds = [-123.25, 48.4, -122.75, 48.7];

export const STRIKE_ISLANDS: readonly IslandDefinition[] = [
  {
    id: "san-juan-core",
    label: "San Juan Core",
    bounds: [-123.12, 48.48, -122.98, 48.62],
    defaultDepthM: 8,
    thumb: "/orca-strike/islands/san-juan-core.png",
  },
  {
    id: "haro-strait",
    label: "Haro Strait",
    bounds: [-123.25, 48.48, -123.08, 48.7],
    defaultDepthM: 10,
    thumb: "/orca-strike/islands/haro-strait.png",
  },
  {
    id: "puget-approach",
    label: "Puget Approach",
    bounds: [-122.98, 48.4, -122.75, 48.58],
    defaultDepthM: 6,
    thumb: "/orca-strike/islands/puget-approach.png",
  },
] as const;

export type StrikeIslandId = (typeof STRIKE_ISLANDS)[number]["id"];

export const DEFAULT_STRIKE_ISLAND_ID: StrikeIslandId = "san-juan-core";

export function getStrikeIsland(id: string): IslandDefinition | undefined {
  return STRIKE_ISLANDS.find((island) => island.id === id);
}

export function getDefaultStrikeIsland(): IslandDefinition {
  return STRIKE_ISLANDS[0];
}

/** True when lat/lng lies inside island bounds (inclusive). */
export function isLatLngInIsland(lat: number, lng: number, island: IslandDefinition): boolean {
  const [west, south, east, north] = island.bounds;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/** Sanity: every island must sit inside the tileset envelope. */
export function assertIslandsWithinTileset(
  tileset: LatLonBounds = TILESET_LAT_LON_BOUNDS,
): boolean {
  const [tWest, tSouth, tEast, tNorth] = tileset;
  return STRIKE_ISLANDS.every(({ bounds: [west, south, east, north] }) => {
    return west >= tWest && south >= tSouth && east <= tEast && north <= tNorth;
  });
}
