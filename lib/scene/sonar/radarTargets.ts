import { GAZETTEER } from "@/lib/geo/gazetteer";
import { projectToScene, type HeightmapBounds } from "@/lib/sceneIntent";

export type SonarTargetKind = "boat" | "place";

export interface SonarTarget {
  id: string;
  kind: SonarTargetKind;
  label: string;
  /** World-space X/Z of the target. */
  x: number;
  z: number;
  /**
   * Relative bearing from the orca to this target, in radians.
   *
   * Convention matches the orca's own heading definition in
   * `web/lib/scene/orcaPilot/deadReckoning.ts` (world forward at yaw =
   * heading is `(cos(heading), -sin(heading))` in world X/Z, the same
   * convention `OrcaRig.setOrientation`'s `rotateY(yaw)` produces): a target
   * exactly along the orca's current forward ray has `bearingRad === 0`
   * regardless of `orcaHeadingRad`. The returned value is normalized to
   * [-PI, PI], with 0 straight ahead and positive values to the orca's right
   * (the same rotational sense as increasing heading, i.e. the "turn right"
   * input in `deadReckoning.ts`).
   */
  bearingRad: number;
  /** Range from the orca to this target, world units. */
  rangeWorldUnits: number;
  /** Range in metres, computed as world units divided by worldUnitsPerMeter. */
  rangeMeters: number;
}

export interface SonarSourceTarget {
  id: string;
  x: number;
  z: number;
  label?: string;
}

export interface SonarPlaceSourceTarget {
  id: string;
  label: string;
  x: number;
  z: number;
}

export const CURATED_PLACE_IDS = [
  "friday-harbor",
  "roche-harbor",
  "deer-harbor",
  "lime-kiln",
  "jones-island",
  "orcas-village",
  "east-sound",
  "san-juan-island",
] as const;

const TWO_PI = Math.PI * 2;

function normalizeAngleRad(angleRad: number): number {
  return ((((angleRad + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
}

// Inverts the orca's own forward mapping (see the doc comment on
// `SonarTarget.bearingRad` above): `heading -> (cos(heading), -sin(heading))`,
// so `atan2(-dz, dx)` recovers `heading` exactly for a point lying on the
// forward ray, keeping this module's bearing convention consistent with
// `orcaPilot/deadReckoning.ts` without importing it.
function targetBearingRad(orcaX: number, orcaZ: number, targetX: number, targetZ: number): number {
  const dx = targetX - orcaX;
  const dz = targetZ - orcaZ;
  return Math.atan2(-dz, dx);
}

function placeInBounds(place: { lat: number; lng: number }, bounds: HeightmapBounds): boolean {
  return (
    place.lat >= bounds.min_lat &&
    place.lat <= bounds.max_lat &&
    place.lng >= bounds.min_lng &&
    place.lng <= bounds.max_lng
  );
}

export function getCuratedPlaceTargets(
  bounds: HeightmapBounds,
  depth: number,
): SonarPlaceSourceTarget[] {
  const placesById = new Map(GAZETTEER.map((place) => [place.id, place]));

  return CURATED_PLACE_IDS.flatMap((id) => {
    const place = placesById.get(id);
    if (!place || !placeInBounds(place, bounds)) return [];

    const [x, z] = projectToScene(place.lat, place.lng, bounds, depth);
    return [{ id: place.id, label: place.name, x, z }];
  });
}

export function buildRadarTargets(opts: {
  orcaX: number;
  orcaZ: number;
  orcaHeadingRad: number;
  /**
   * Plain live boat data. Callers may map from their boat module, but this module
   * deliberately imports no boat or orca code.
   */
  boats: SonarSourceTarget[];
  /**
   * Optional projected gazetteer targets from getCuratedPlaceTargets, or any
   * caller-owned static targets in the same plain X/Z shape.
   */
  places?: SonarPlaceSourceTarget[];
  /** Scene units per metre. Range metres are worldUnits / worldUnitsPerMeter. */
  worldUnitsPerMeter?: number;
  /** Optional range filter in world units. Omit or Infinity to include all targets. */
  maxRangeWorldUnits?: number;
}): SonarTarget[] {
  const {
    orcaX,
    orcaZ,
    orcaHeadingRad,
    boats,
    places = [],
    worldUnitsPerMeter = 1,
    maxRangeWorldUnits = Infinity,
  } = opts;

  const unitsPerMeter = worldUnitsPerMeter > 0 ? worldUnitsPerMeter : 1;

  const makeTarget = (
    source: SonarSourceTarget | SonarPlaceSourceTarget,
    kind: SonarTargetKind,
  ): SonarTarget | null => {
    const dx = source.x - orcaX;
    const dz = source.z - orcaZ;
    const rangeWorldUnits = Math.hypot(dx, dz);
    if (rangeWorldUnits > maxRangeWorldUnits) return null;

    const absoluteBearingRad = targetBearingRad(orcaX, orcaZ, source.x, source.z);
    const bearingRad = normalizeAngleRad(absoluteBearingRad - orcaHeadingRad);
    const label = source.label ?? source.id;

    return {
      id: `${kind}:${source.id}`,
      kind,
      label,
      x: source.x,
      z: source.z,
      bearingRad,
      rangeWorldUnits,
      rangeMeters: rangeWorldUnits / unitsPerMeter,
    };
  };

  const targets = [
    ...boats.map((boat) => makeTarget(boat, "boat")),
    ...places.map((place) => makeTarget(place, "place")),
  ].filter((target): target is SonarTarget => target !== null);

  return targets.sort((a, b) => a.rangeWorldUnits - b.rangeWorldUnits);
}
