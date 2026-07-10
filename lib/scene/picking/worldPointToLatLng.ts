// Wave 2 picking-perf: invert a world-space raycast hit back to geographic
// lat/lng using the same synthetic-frame math as `unprojectFromScene` in
// `web/lib/sceneIntent.ts` (the orchestrator kept the SCENE_WIDTH frame for W2;
// a full metric migration is deferred to W5).
//
// `unprojectFromScene` is imported, not copied, so the picking conversion can
// never silently drift from the convergence-file definition the integrator and
// the rest of the scene rely on. `SCENE_WIDTH` is imported for the same reason.

import * as THREE from "three";
import {
  SCENE_WIDTH,
  unprojectFromScene,
  type HeightmapBounds,
} from "@/lib/sceneIntent";

// Scratch vector reused across calls so a hot picking path allocates nothing.
const groupOrigin = new THREE.Vector3();

/**
 * Map a world-space hit (e.g. `raycaster.intersectObject(tiles.group)[0].point`)
 * back to `{ lat, lng }`.
 *
 * Frame contract for Wave 2 (see WIRING-picking.md): the integrator fits and
 * positions `tiles.group` so the tileset footprint fills the synthetic scene box
 * that `projectToScene` / `unprojectFromScene` define (SCENE_WIDTH wide in world
 * X, `depth` deep in world Z, centred on the group origin, with the group's
 * `rotation.x = -PI/2` laying the z-up tileset flat). Because the r3f scene root
 * is the world frame, the hit's world X/Z are already the horizontal scene-frame
 * coordinates that `unprojectFromScene` expects. The `group` is used to subtract
 * any translation the integrator applied to `tiles.group`, so this stays correct
 * if the group is not centred exactly at the origin.
 *
 * The group's rotation and uniform fit scale are deliberately NOT inverted: doing
 * so (a literal `group.worldToLocal`) would land in the tileset's native metric
 * UTM frame, which is incompatible with the SCENE_WIDTH box `unprojectFromScene`
 * assumes. That metric path is W5 (precision-origin-shift), not W2.
 *
 * @param point  World-space intersection point from the raycast.
 * @param bounds Geographic bounds of the served tileset extent (lat/lng).
 * @param depth  Scene-Z span, i.e. `sceneDepth(bounds)` from `sceneIntent.ts`.
 * @param group  `tiles.group`; its world position recentres the hit.
 */
export function worldPointToLatLng(
  point: THREE.Vector3,
  bounds: HeightmapBounds,
  depth: number,
  group: THREE.Object3D,
): { lat: number; lng: number } {
  group.getWorldPosition(groupOrigin);
  const x = point.x - groupOrigin.x;
  const z = point.z - groupOrigin.z;
  return unprojectFromScene(x, z, bounds, depth);
}

export { SCENE_WIDTH };
export type { HeightmapBounds };
