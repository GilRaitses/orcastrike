# WIRING-picking.md

Accelerated raycasting and a perf HUD for the Wave 2 live scene. Owned by the
`picking-perf` agent. The integrator wires these into `SalishScene.tsx` during
Phase B. This module does not edit any convergence file.

## Dependency added

`three-mesh-bvh@0.9.10`, pinned exact in `web/package.json` dependencies. Its peer
range is `three >= 0.159.0`, which the project's `three@0.169` satisfies. Note the
transitive `three-mesh-bvh@0.7.8` under `@react-three/drei` is unrelated and
predates this wave; the top-level direct dependency resolves to `0.9.10`.

## Exports

```ts
import { accelerateTilesPicking, worldPointToLatLng, PerfHud } from "@/lib/scene/picking";
import type { PerfHudProps, PerfSample } from "@/lib/scene/picking";
```

### `accelerateTilesPicking(tiles: TilesRenderer): () => void`

Installs the `three-mesh-bvh` prototype patches (`BufferGeometry.computeBoundsTree`
/ `disposeBoundsTree`, `Mesh.prototype.raycast = acceleratedRaycast`), builds a
bounds tree for every tile mesh already loaded, and listens for `load-model` to
build a tree for each tile as it streams in. The returned cleanup function removes
the listener, disposes the bounds trees of currently loaded models, and restores
the original `Mesh.prototype.raycast`.

The accelerated raycast falls back to stock behaviour for any geometry without a
bounds tree, so installing it globally does not affect other meshes in the scene.

Wire it once the `TilesRenderer` exists (the instance `useTilesLayer` exposes):

```ts
const tiles = useTilesLayer({ url, groupRotationX: -Math.PI / 2, fitScaleToWidth: SCENE_WIDTH });
useEffect(() => {
  if (!tiles) return;
  const cleanup = accelerateTilesPicking(tiles);
  return cleanup;
}, [tiles]);
```

### `worldPointToLatLng(point, bounds, depth, group): { lat, lng }`

```ts
worldPointToLatLng(
  point: THREE.Vector3,   // world-space hit, e.g. intersects[0].point
  bounds: HeightmapBounds, // lat/lng bounds of the served tileset extent
  depth: number,           // sceneDepth(bounds) from sceneIntent.ts
  group: THREE.Object3D,   // tiles.group
): { lat: number; lng: number }
```

Inverts a world-space hit to geographic lat/lng using the convergence-file
`unprojectFromScene` (imported, not copied, so it cannot drift) plus `SCENE_WIDTH`.

#### Frame contract the integrator must honour

The conversion assumes the W2 reconciliation frame: `tiles.group` is fit and
positioned so the tileset footprint fills the synthetic scene box that
`projectToScene` / `unprojectFromScene` define, that is SCENE_WIDTH wide in world
X and `depth` deep in world Z, centred on the group origin, with the group's
`rotation.x = -PI/2` laying the z-up tileset flat. Because the r3f scene root is
the world frame, the hit's world X and Z are already the horizontal scene-frame
coordinates `unprojectFromScene` consumes. `group` is used only to subtract any
translation applied to `tiles.group`, so picking stays correct if the group is not
centred exactly at the origin.

The group's rotation and uniform fit scale are deliberately NOT inverted. A
literal `group.worldToLocal` would land in the tileset's native metric UTM frame
(z-up meters about the local origin 485245.194 E / 5377443.419 N), which is
incompatible with the SCENE_WIDTH box `unprojectFromScene` assumes. That metric
inversion is W5 (precision-origin-shift), not W2. The dispatch phrase "use
group.worldToLocal" is interpreted here as "invert the integrator's placement of
the group", which for the kept synthetic frame reduces to removing the group's
world translation. If W5 migrates the scene to metric coordinates, replace the
body of `worldPointToLatLng` with the inverse UTM projection rather than
`unprojectFromScene`.

#### Pick-to-intent wiring

```ts
// onPointerDown / raycast against tiles.group:
const hits = raycaster.intersectObject(tiles.group, true);
if (hits.length > 0) {
  const { lat, lng } = worldPointToLatLng(hits[0].point, bounds, depth, tiles.group);
  const depth_m = sampleSubstrate(field, lat, lng); // science-substrate module
  onSceneIntent({ type: "cell", lat, lng, depth_m });
}
```

`bounds` and `depth`: derive `bounds` from the served tileset (per the dispatch,
prefer the runtime bounding sphere over the stale `pilot.bounds.json`) and pass
`depth = sceneDepth(bounds)` so the inversion matches the projection the rest of
the scene uses.

### `<PerfHud />` (default export shape: named `PerfHud`)

```tsx
<Canvas>
  {/* ...scene... */}
  <PerfHud corner="top-right" onSample={(s) => {}} />
</Canvas>
```

Place it ANYWHERE inside `<Canvas>` (it uses `useThree` / `useFrame`). It renders
nothing into the 3D scene; its readout is portalled to `document.body` and pinned
to a screen corner with `position: fixed`, `pointerEvents: none`. Shows mean frame
time (ms), FPS, draw calls (`renderer.info.render.calls`) and geometry count
(`renderer.info.memory.geometries`). Props:

- `updateMs` (default 250): refresh interval.
- `corner` (default "top-left"): "top-left" | "top-right" | "bottom-left" | "bottom-right".
- `onSample(sample: PerfSample)`: optional callback per refresh for gate logging.

For the gate this gives the interactive-frame-rate evidence; remove or gate it
behind a flag for the shipped scene.

## Validation

`cd web && npm run typecheck` passes clean with these files in place.

## Ownership

Owns `web/lib/scene/picking/` and `web/package.json` (sole manifest editor this
wave). Does not edit `SalishScene.tsx` or `sceneIntent.ts`.
