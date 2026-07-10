// Named spawn regions within the Salish Sea game envelope. Spawn centers sit
// near harbour approaches so a new round opens into readable water and land.
import type { IslandDefinition, LatLonBounds } from "../types";

export const TILESET_LAT_LON_BOUNDS: LatLonBounds = [-123.25, 48.4, -122.75, 48.7];
export const STRIKE_ISLANDS: readonly IslandDefinition[] = [
  { id: "iceberg-point", label: "Iceberg Point · Lopez Island", bounds: [-122.96, 48.43, -122.84, 48.51], defaultDepthM: 7, thumb: "/orca-strike/islands/iceberg-point.png" },
  { id: "eastsound", label: "Eastsound · Orcas Island", bounds: [-123.02, 48.66, -122.88, 48.73], defaultDepthM: 8, thumb: "/orca-strike/islands/eastsound.png" },
  { id: "friday-harbor", label: "Friday Harbor · San Juan Island", bounds: [-123.05, 48.50, -122.92, 48.59], defaultDepthM: 8, thumb: "/orca-strike/islands/friday-harbor.png" },
] as const;
export type StrikeIslandId = (typeof STRIKE_ISLANDS)[number]["id"];
export const DEFAULT_STRIKE_ISLAND_ID: StrikeIslandId = "friday-harbor";
export function getStrikeIsland(id: string): IslandDefinition | undefined { return STRIKE_ISLANDS.find((island) => island.id === id); }
export function getDefaultStrikeIsland(): IslandDefinition { return STRIKE_ISLANDS[0]; }
export function isLatLngInIsland(lat: number, lng: number, island: IslandDefinition): boolean { const [w,s,e,n]=island.bounds; return lng>=w&&lng<=e&&lat>=s&&lat<=n; }
export function assertIslandsWithinTileset(tileset: LatLonBounds = TILESET_LAT_LON_BOUNDS): boolean { const [tw,ts,te,tn]=tileset; return STRIKE_ISLANDS.every(({bounds:[w,s,e,n]})=>w>=tw&&s>=ts&&e<=te&&n<=tn); }
