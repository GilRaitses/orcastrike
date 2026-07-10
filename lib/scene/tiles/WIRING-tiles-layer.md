# WIRING-tiles-layer.md, the reusable tiles layer hook

Wave 2, agent `tiles-layer` of the orcast terrain+bathymetry 3D twin. This is the
productionized form of the Wave 1 sandbox hook
`web/app/(sandbox)/tiles3d/useTilesRenderer.ts`. It owns only
`web/lib/scene/tiles/` and never edits `SalishScene.tsx`, `web/lib/sceneIntent.ts`,
or `web/package.json`.

## Exports

```ts
import { useTilesLayer, type UseTilesLayerOptions } from "@/lib/scene/tiles";
```

`web/lib/scene/tiles/index.ts` re-exports the hook and its options type.

## Hook signature

```ts
function useTilesLayer(options: UseTilesLayerOptions): TilesRenderer | null
```

`TilesRenderer` is imported from `3d-tiles-renderer` (no new dependency). The hook
returns the live instance once constructed, or `null` until then. The integrator
uses the returned instance to wire picking (raycast against `tiles.group`) and to
read `tiles.getBoundingSphere`.

## Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `url` | `string` | required | Tileset root URL (`tileset.json`). |
| `errorTarget` | `number` | `12` | Screen-space error in px. Lower means more detail and more tiles. |
| `maxDepth` | `number` | `Infinity` | Cap LoD depth. |
| `enabled` | `boolean` | `true` | When false the per-frame `update()` is skipped and tiles never stream. |
| `enableShadows` | `boolean` | `true` | Set `castShadow`/`receiveShadow` on tile meshes as they load. |
| `groupRotationX` | `number` | `-Math.PI / 2` | Rotation applied to `tiles.group.rotation.x` to map 3D-Tiles z-up to three.js y-up. |
| `fitScaleToWidth` | `number \| null` | `null` | When a number, on first tileset load uniformly scale and recenter the group so its bounding-sphere diameter equals this many scene units. |
| `onFit` | `(sphere: THREE.Sphere) => void` | none | Called once on first tileset load, after any fit, with the resulting WORLD-space bounding sphere. |

## Lifecycle (same as the sandbox)

1. Construct `new TilesRenderer(url)` on url change, dispose on unmount/change.
2. Register `ImplicitTilingPlugin` and
   `GLTFExtensionsPlugin({ meshoptDecoder: MeshoptDecoder })`. The meshopt decoder
   is imported from `three/addons/libs/meshopt_decoder.module.js`, so the orcast
   pilot glb (`EXT_meshopt_compression` + `KHR_mesh_quantization`) loads with no
   further setup.
3. Register the active r3f camera with `setCamera`, unregister on change.
4. Per frame: `camera.updateMatrixWorld()`, then
   `setResolutionFromRenderer(camera, gl)`, then `update()`.
5. `needs-update` calls `invalidate()` so a `frameloop="demand"` host still settles
   the LoD.
6. On `load-model`, when `enableShadows`, traverse the loaded scene and set
   `castShadow`/`receiveShadow` on every mesh.
7. `dispose()` on unmount.

## Fit-to-frame behavior

`getBoundingSphere` returns the sphere in the group-local (tile content) frame,
before `tiles.group`'s own rotation and scale. The fit runs once per frame loop
until it succeeds, which is the first frame after the root tileset has loaded and
its bounding volume exists. The fit:

1. Re-applies `groupRotationX` to `tiles.group.rotation.x`.
2. When `fitScaleToWidth` is a number, sets `tiles.group.scale` uniformly to
   `fitScaleToWidth / (sphere.radius * 2)` so the diameter equals the target.
3. Sets `tiles.group.position` so the rotated, scaled sphere center lands at the
   world origin. The transform is composed as translation then rotation then
   scale, so a local point `p` lands at `position + R * (scale * p)`.
4. Calls `onFit` once with the WORLD-space sphere
   (`sphere.clone().applyMatrix4(tiles.group.matrixWorld)`). After a numeric fit
   this sphere is centered at the origin with radius `fitScaleToWidth / 2`, which
   the caller uses to set camera distance and OrbitControls min/max.

Changing `groupRotationX` or `fitScaleToWidth` re-arms the fit so the group
rescales on the next frame.

The scale comes from the RUNTIME bounding sphere, not from `pilot.bounds.json`
(stale per the wave dispatch). The pilot is real meters and true-scale, so a
uniform scale preserves true relief; no vertical exaggeration is baked in. The
integrator may apply an optional exaggeration factor on the group Y separately.

## How the Wave 2 integrator mounts it

```tsx
import { useTilesLayer } from "@/lib/scene/tiles";
import { SCENE_WIDTH } from "@/lib/sceneIntent";

const PILOT_URL = "https://d8kxxpcnj3ub5.cloudfront.net/3dtwin/pilot/tileset.json";

function TilesLayer({ onFit }: { onFit: (s: THREE.Sphere) => void }) {
  const tiles = useTilesLayer({
    url: PILOT_URL,
    groupRotationX: -Math.PI / 2,
    fitScaleToWidth: SCENE_WIDTH, // 120
    enableShadows: true,
    onFit,
  });

  // tiles is also returned so the integrator can wire picking against it.
  return tiles ? <primitive object={tiles.group} /> : null;
}
```

The `onFit` sphere (center near origin, radius `SCENE_WIDTH / 2 = 60`) frames the
camera and sets `OrbitControls` `minDistance`/`maxDistance`. The water plane stays
at Y 0 because the tileset's elevation 0 m maps to scene Y 0 under the chosen
rotation and uniform scale.

## Validation

`cd web && npm run typecheck` passes with exit code 0. No `next dev` and no
`next build` were run, per the parallel-phase rule. Rendering is verified at the
Wave 2 gate by the integrator.
