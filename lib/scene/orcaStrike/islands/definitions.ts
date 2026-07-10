// Named spawn regions within the Salish Sea game envelope. Spawn centers sit
// near harbour approaches so a new round opens into readable water and land.
import type { IslandDefinition, LatLonBounds } from "../types";

export const TILESET_LAT_LON_BOUNDS: LatLonBounds = [-123.25, 48.4, -122.75, 48.7];
export const STRIKE_ISLANDS: readonly IslandDefinition[] = [
  { id: "lopez-harbor", label: "Lopez Harbor", bounds: [-122.94, 48.46, -122.82, 48.54], defaultDepthM: 7, thumb: "/orca-strike/islands/lopez-harbor.png" },
  { id: "eastsound", label: "Eastsound · Orcas Island", bounds: [-123.02, 48.66, -122.88, 48.73], defaultDepthM: 8, thumb: "/orca-strike/islands/eastsound.png" },
  { id: "san-juan-harbor", label: "San Juan Harbor", bounds: [-123.16, 48.48, -123.00, 48.60], defaultDepthM: 8, thumb: "/orca-strike/islands/san-juan-harbor.png" },
] as const;
export type StrikeIslandId = (typeof STRIKE_ISLANDS)[number]["id"];
export const DEFAULT_STRIKE_ISLAND_ID: StrikeIslandId = "san-juan-harbor";
export function getStrikeIsland(id: string): IslandDefinition | undefined { return STRIKE_ISLANDS.find((island) => island.id === id); }
export function getDefaultStrikeIsland(): IslandDefinition { return STRIKE_ISLANDS[0]; }
export function isLatLngInIsland(lat: number, lng: number, island: IslandDefinition): boolean { const [w,s,e,n]=island.bounds; return lng>=w&&lng<=e&&lat>=s&&lat<=n; }
export function assertIslandsWithinTileset(tileset: LatLonBounds = TILESET_LAT_LON_BOUNDS): boolean { const [tw,ts,te,tn]=tileset; return STRIKE_ISLANDS.every(({bounds:[w,s,e,n]})=>w>=tw&&s>=ts&&e<=te&&n<=tn); }
