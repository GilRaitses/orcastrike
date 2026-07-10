// Scenic Decorator: a true-scale DECORATIVE terrain ring beyond the served
// extent, so the Salish horizon is framed by land (Olympics south, Cascades and
// Mount Baker east, Vancouver Island north) instead of empty water.
//
// Data source. The ring is built from a baked static asset, web/public/geo/
// horizon-ring.json, produced by bakeHorizonRing.mjs in this directory from AWS
// Terrain Tiles (s3://elevation-tiles-prod), the Mapzen-derived global bare-earth
// DEM (SRTM, NASADEM, GMTED, NED, 3DEP). Every elevation in the asset is a real
// sample of that open DEM; nothing is invented (B.6). A runtime fetch path is
// available behind `fetchAtRuntime`, but the default consumes the baked asset.
//
// Honesty. The geometry is decorative, not surveyed. The returned Object3D is
// tagged `userData.decorativeNotSurveyed = true`, `userData.label`,
// `userData.source`, and `userData.attribution`, exactly as `buildSubstrateOverlay`
// tags its overlay, so any UI built from the scene graph surfaces the label.
//
// Scale and placement. Points are placed at true bearing and true scale around
// the origin using the `worldUnitsPerMeter` convention the journey scene already
// derives (sphere.radius / geoRadiusMeters). At ~0.0024 units/m a 120 km ring is
// ~290 units, inside the live 800-unit far plane, and Mount Baker reads ~8 units
// tall. The outer edge is skirted below sea level so no gap shows where the ring
// meets the water. The mesh shares scene.fog (material.fog = true) so it
// dissolves into the haze the way the served tiles do.
//
// Ownership: web/lib/scene/decor/ only. Reads SCENE_WIDTH and HeightmapBounds
// from sceneIntent and the realism palette from the realism barrel. Does NOT
// edit realism/ or tiles/ internals.

import * as THREE from "three";
import { SCENE_WIDTH, type HeightmapBounds } from "@/lib/sceneIntent";
import { landElevationColor, WATER_DEEP, WATER_SHALLOW } from "@/app/components/scene/realism";

/** Default static path of the baked ring asset under web/public/. */
export const HORIZON_RING_URL = "/geo/horizon-ring.json";

/** The served extent the live scene fits (matches SalishScene TILESET_BOUNDS). */
export const TILESET_BOUNDS: HeightmapBounds = {
  min_lat: 48.4,
  max_lat: 48.7,
  min_lng: -123.25,
  max_lng: -122.75,
};

/**
 * Fit-accurate world units per metre for the served extent. The live scene
 * scales the tileset so its bounding-sphere DIAMETER equals SCENE_WIDTH, i.e.
 * radius = SCENE_WIDTH / 2 over the geographic half-diagonal in metres. The
 * integrator should override this with the value `useTilesLayer.onFit` yields
 * (`sphere.radius / geoRadiusMeters`) once the tileset has fitted.
 */
export const DEFAULT_WORLD_UNITS_PER_METER =
  SCENE_WIDTH / 2 / geoRadiusMeters(TILESET_BOUNDS);

/** Geographic half-diagonal of a bounds box, metres (mirrors JourneyScene). */
export function geoRadiusMeters(b: HeightmapBounds): number {
  const latSpanM = (b.max_lat - b.min_lat) * 111_000;
  const lngSpanM = (b.max_lng - b.min_lng) * 73_600;
  return 0.5 * Math.hypot(latSpanM, lngSpanM);
}

/** Baked ring asset schema (orcast.horizon-ring.v1). */
export interface HorizonField {
  schema: string;
  decorativeNotSurveyed: boolean;
  label: string;
  source: string;
  dataset: string;
  attribution: string;
  center: { lat: number; lng: number };
  rMinMeters: number;
  rMaxMeters: number;
  nBearings: number;
  nRadii: number;
  zoom: number;
  bearingFromNorthClockwise: boolean;
  /** Row-major [bearing][radius] elevations in metres (length nBearings*nRadii). */
  elevMeters: number[];
}

export type HorizonRingFallback = "silhouette";

export interface HorizonRingOptions {
  /** Preloaded ring field. Mutually exclusive with `fetchAtRuntime`. */
  field?: HorizonField;
  /** Asset URL used when `fetchAtRuntime` is true. Default {@link HORIZON_RING_URL}. */
  url?: string;
  /**
   * When true and no `field` is passed, fetch the baked asset at runtime and
   * build the ring when it arrives. Default false: the integrator should
   * preload with {@link loadHorizonField} and pass `field`.
   */
  fetchAtRuntime?: boolean;
  /**
   * World units per metre. Default {@link DEFAULT_WORLD_UNITS_PER_METER}. Pass
   * the fit-accurate value from `useTilesLayer.onFit` for exact alignment.
   */
  worldUnitsPerMeter?: number;
  /**
   * Vertical world units per metre. Defaults to `worldUnitsPerMeter` so relief
   * is true-scale with no vertical exaggeration.
   */
  verticalUnitsPerMeter?: number;
  /** Outer-edge skirt depth in metres below sea level. Default 4000. */
  skirtDepthMeters?: number;
  /** Material roughness. Default 0.95 (matte distant land). */
  roughness?: number;
  /**
   * Build the lighter `silhouette` fallback instead of the full ring mesh, for
   * low-end devices: one camera-agnostic band at the outer radius whose top
   * follows the per-bearing max elevation. Documented in WIRING-decor.md.
   */
  fallback?: HorizonRingFallback;
}

export interface HorizonRingHandle {
  /** Mount with `<primitive object={handle.object3D} />`. */
  object3D: THREE.Object3D;
  /** Dispose any geometry/material built, and abort an in-flight fetch. */
  dispose(): void;
}

const DEFAULTS = {
  skirtDepthMeters: 4000,
  roughness: 0.95,
};

/** Load the baked ring asset. Mirrors the substrate loader pattern. */
export async function loadHorizonField(url: string = HORIZON_RING_URL): Promise<HorizonField> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`horizon ring asset ${url}: HTTP ${res.status}`);
  return (await res.json()) as HorizonField;
}

function tagDecorative(object: THREE.Object3D, field: HorizonField, fallback?: string): void {
  object.name = `decor-horizon-ring${fallback ? `-${fallback}` : ""} (${field.label})`;
  object.userData.decorativeNotSurveyed = true;
  object.userData.label = field.label;
  object.userData.source = field.source;
  object.userData.dataset = field.dataset;
  object.userData.attribution = field.attribution;
  object.userData.zoom = field.zoom;
  object.frustumCulled = true;
}

/** Scene-frame direction for a bearing (deg, clockwise from north): +X east, -Z north. */
function bearingDir(bearingDeg: number): { sx: number; sz: number } {
  const a = (bearingDeg * Math.PI) / 180;
  return { sx: Math.sin(a), sz: -Math.cos(a) };
}

function distanceForRadius(field: HorizonField, j: number): number {
  const t = field.nRadii === 1 ? 0 : j / (field.nRadii - 1);
  return field.rMinMeters + t * (field.rMaxMeters - field.rMinMeters);
}

function vertexColor(target: THREE.Color, elevM: number): void {
  if (elevM >= 0) {
    target.copy(landElevationColor(elevM));
  } else {
    // Below sea level samples (channels beyond the served tiles) read as water.
    const t = Math.min(1, -elevM / 400);
    target.copy(WATER_SHALLOW).lerp(WATER_DEEP, t);
  }
}

function buildRingMesh(field: HorizonField, opts: HorizonRingOptions): THREE.Mesh {
  const upm = opts.worldUnitsPerMeter ?? DEFAULT_WORLD_UNITS_PER_METER;
  const vpm = opts.verticalUnitsPerMeter ?? upm;
  const skirtDepth = opts.skirtDepthMeters ?? DEFAULTS.skirtDepthMeters;
  const nB = field.nBearings;
  const nR = field.nRadii;
  const ringCount = nR + 1; // + 1 skirt ring at the outer edge

  const vertCount = nB * ringCount;
  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < nB; i++) {
    const bearing = (i / nB) * 360;
    const { sx, sz } = bearingDir(bearing);
    for (let j = 0; j < nR; j++) {
      const elevM = field.elevMeters[i * nR + j];
      const dM = distanceForRadius(field, j);
      const r = dM * upm;
      const vi = (i * ringCount + j) * 3;
      positions[vi] = r * sx;
      positions[vi + 1] = elevM * vpm;
      positions[vi + 2] = r * sz;
      vertexColor(tmp, elevM);
      colors[vi] = tmp.r;
      colors[vi + 1] = tmp.g;
      colors[vi + 2] = tmp.b;
    }
    // Skirt vertex: same outer radius, dropped below sea level.
    const rOut = field.rMaxMeters * upm;
    const si = (i * ringCount + nR) * 3;
    positions[si] = rOut * sx;
    positions[si + 1] = -skirtDepth * vpm;
    positions[si + 2] = rOut * sz;
    tmp.copy(WATER_DEEP);
    colors[si] = tmp.r;
    colors[si + 1] = tmp.g;
    colors[si + 2] = tmp.b;
  }

  const indices: number[] = [];
  for (let i = 0; i < nB; i++) {
    const iNext = (i + 1) % nB; // wrap the ring
    for (let j = 0; j < ringCount - 1; j++) {
      const a = i * ringCount + j;
      const b = iNext * ringCount + j;
      const c = i * ringCount + j + 1;
      const d = iNext * ringCount + j + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: opts.roughness ?? DEFAULTS.roughness,
    metalness: 0,
    // Share the scene fog so the ring dissolves into the horizon haze.
    fog: true,
    side: THREE.FrontSide,
  });

  return new THREE.Mesh(geometry, material);
}

function buildSilhouette(field: HorizonField, opts: HorizonRingOptions): THREE.Mesh {
  const upm = opts.worldUnitsPerMeter ?? DEFAULT_WORLD_UNITS_PER_METER;
  const vpm = opts.verticalUnitsPerMeter ?? upm;
  const skirtDepth = opts.skirtDepthMeters ?? DEFAULTS.skirtDepthMeters;
  const nB = field.nBearings;
  const nR = field.nRadii;
  const rOut = field.rMaxMeters * upm;

  // Two vertices per bearing: a top following the per-bearing max elevation and
  // a bottom skirted below sea level. Cheap band, ~nB*2 verts.
  const positions = new Float32Array(nB * 2 * 3);
  const colors = new Float32Array(nB * 2 * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < nB; i++) {
    const { sx, sz } = bearingDir((i / nB) * 360);
    let maxElev = 0;
    for (let j = 0; j < nR; j++) maxElev = Math.max(maxElev, field.elevMeters[i * nR + j]);
    const top = i * 2;
    const bot = i * 2 + 1;
    positions[top * 3] = rOut * sx;
    positions[top * 3 + 1] = maxElev * vpm;
    positions[top * 3 + 2] = rOut * sz;
    positions[bot * 3] = rOut * sx;
    positions[bot * 3 + 1] = -skirtDepth * vpm;
    positions[bot * 3 + 2] = rOut * sz;
    vertexColor(tmp, maxElev);
    colors[top * 3] = tmp.r;
    colors[top * 3 + 1] = tmp.g;
    colors[top * 3 + 2] = tmp.b;
    tmp.copy(WATER_DEEP);
    colors[bot * 3] = tmp.r;
    colors[bot * 3 + 1] = tmp.g;
    colors[bot * 3 + 2] = tmp.b;
  }

  const indices: number[] = [];
  for (let i = 0; i < nB; i++) {
    const iNext = (i + 1) % nB;
    const t0 = i * 2;
    const b0 = i * 2 + 1;
    const t1 = iNext * 2;
    const b1 = iNext * 2 + 1;
    indices.push(t0, b0, t1, t1, b0, b1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: opts.roughness ?? DEFAULTS.roughness,
    metalness: 0,
    fog: true,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

function build(field: HorizonField, opts: HorizonRingOptions): THREE.Mesh {
  return opts.fallback === "silhouette"
    ? buildSilhouette(field, opts)
    : buildRingMesh(field, opts);
}

/**
 * Build a decorative horizon ring. Returns a handle synchronously. The returned
 * `object3D` is a Group tagged decorative-not-surveyed; the built mesh is added
 * to it once a field is available.
 *
 * Provide a preloaded `field` (recommended, via {@link loadHorizonField}) for an
 * immediate build, or set `fetchAtRuntime` to load the baked asset behind the
 * flag and populate the group when it arrives.
 */
export function makeHorizonRing(opts: HorizonRingOptions = {}): HorizonRingHandle {
  const group = new THREE.Group();
  group.name = "decor-horizon-ring (decorative, not surveyed)";
  group.userData.decorativeNotSurveyed = true;
  group.userData.label = "decorative, not surveyed";

  let mesh: THREE.Mesh | null = null;
  let disposed = false;
  const controller = new AbortController();

  const mount = (field: HorizonField) => {
    if (disposed) return;
    mesh = build(field, opts);
    tagDecorative(group, field, opts.fallback);
    group.add(mesh);
  };

  if (opts.field) {
    mount(opts.field);
  } else if (opts.fetchAtRuntime) {
    fetch(opts.url ?? HORIZON_RING_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`horizon ring asset: HTTP ${res.status}`);
        return res.json() as Promise<HorizonField>;
      })
      .then(mount)
      .catch(() => {
        // Leave the group empty on failure; the horizon falls back to open water.
      });
  }

  return {
    object3D: group,
    dispose() {
      disposed = true;
      controller.abort();
      if (mesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        group.remove(mesh);
        mesh = null;
      }
    },
  };
}
