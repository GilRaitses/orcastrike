// Shared intent vocabulary emitted by the 3D scene and consumed by the adaptive
// console. Scene interactions are first-class intent inputs to the orchestrator
// turn (see ORCHESTRATOR_NARRATOR_FRAMEWORK.md sec 3).

export type SceneIntent =
  | { type: "cell"; lat: number; lng: number; depth_m?: number }
  | {
      type: "hydrophone";
      id: string | number | null;
      name?: string | null;
      lat: number;
      lng: number;
      streamUrl?: string | null;
    };

export interface HeightmapBounds {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

export interface Heightmap {
  source?: string;
  dataset?: string;
  bounds: HeightmapBounds;
  step_deg: number;
  cols: number;
  rows: number;
  min_depth: number;
  max_depth: number;
  depths: number[][];
}

export interface HydrophoneNode {
  id: string | number | null;
  name?: string | null;
  location?: string | null;
  latitude: number;
  longitude: number;
  status?: string;
  streamUrl?: string | null;
  source?: string;
}

// Orcasound public roster fallback when the backend hydrophone route is
// unreachable. Coordinates restricted to the San Juan / Salish modeled bbox.
export const ORCASOUND_FALLBACK: HydrophoneNode[] = [
  { id: "rpi_orcasound_lab", name: "Orcasound Lab (Haro Strait)", latitude: 48.5583, longitude: -123.1735, status: "online", source: "Orcasound" },
  { id: "rpi_port_townsend", name: "Port Townsend", latitude: 48.1364, longitude: -122.7615, status: "online", source: "Orcasound" },
  { id: "rpi_bush_point", name: "Bush Point", latitude: 48.0336, longitude: -122.6039, status: "online", source: "Orcasound" },
  { id: "rpi_sunset_bay", name: "Sunset Bay", latitude: 47.8666, longitude: -122.3344, status: "online", source: "Orcasound" },
];

// Scene-space extents (three.js units). The terrain plane spans these; lat/lng
// project into this box so beacons and click targets line up with the mesh.
export const SCENE_WIDTH = 120;

export function sceneDepth(bounds: HeightmapBounds): number {
  const lngSpanKm = (bounds.max_lng - bounds.min_lng) * 73.6; // ~km per deg lng @48.5N
  const latSpanKm = (bounds.max_lat - bounds.min_lat) * 111.0;
  return SCENE_WIDTH * (latSpanKm / lngSpanKm);
}

export const HEIGHT_SCALE = 0.04; // metres -> scene units (vertical exaggeration)

export function projectToScene(
  lat: number,
  lng: number,
  bounds: HeightmapBounds,
  depth: number,
): [number, number] {
  const x = ((lng - bounds.min_lng) / (bounds.max_lng - bounds.min_lng) - 0.5) * SCENE_WIDTH;
  const z = -(((lat - bounds.min_lat) / (bounds.max_lat - bounds.min_lat)) - 0.5) * depth;
  return [x, z];
}

export function unprojectFromScene(
  x: number,
  z: number,
  bounds: HeightmapBounds,
  depth: number,
): { lat: number; lng: number } {
  const lng = (x / SCENE_WIDTH + 0.5) * (bounds.max_lng - bounds.min_lng) + bounds.min_lng;
  const lat = (-z / depth + 0.5) * (bounds.max_lat - bounds.min_lat) + bounds.min_lat;
  return { lat, lng };
}

// Bilinear-ish nearest sample of the grid for a given lat/lng (scene Y at a point).
export function sampleDepth(map: Heightmap, lat: number, lng: number): number {
  const { bounds, rows, cols, depths } = map;
  const fr = ((lat - bounds.min_lat) / (bounds.max_lat - bounds.min_lat)) * (rows - 1);
  const fc = ((lng - bounds.min_lng) / (bounds.max_lng - bounds.min_lng)) * (cols - 1);
  const r = Math.max(0, Math.min(rows - 1, Math.round(fr)));
  const c = Math.max(0, Math.min(cols - 1, Math.round(fc)));
  return depths[r]?.[c] ?? 0;
}
