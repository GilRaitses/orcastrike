# WIRING-decor

Integrator contract for the Scenic Decorator module, WS-SCENIC phase A producer
2. This module frames the horizon and refines the sky and haze as set dressing.
It is pure and framework-free. Every export returns a handle with an `object3D`
to mount and a `dispose` to tear down. The phase-B SCENIC editor mounts these
inside `TwinScene` in `SalishScene.tsx` and in the parallel `JourneyScene.tsx`.
This module edits no convergence file and no `realism/` or `tiles/` internal.

## What this module owns

- `web/lib/scene/decor/sky.ts`, the physical sky dome.
- `web/lib/scene/decor/horizonRing.ts`, the decorative terrain ring.
- `web/lib/scene/decor/fogTuning.ts`, optional fog retuning.
- `web/lib/scene/decor/index.ts`, the barrel.
- `web/lib/scene/decor/bakeHorizonRing.mjs`, the asset bake script.
- `web/public/geo/horizon-ring.json`, the baked ring asset.

## Honesty statements

- The sky is an atmosphere effect, not a measured sky. Tagged
  `userData.atmosphereEffect` and `userData.label` on the dome.
- The horizon ring is decorative, not surveyed. Tagged
  `userData.decorativeNotSurveyed`, `userData.label`, `userData.source`,
  `userData.dataset`, and `userData.attribution` on the mounted object, the same
  pattern `buildSubstrateOverlay` uses, so any UI built from the scene graph can
  surface the label.
- The fog is a labeled atmosphere effect, not measured visibility.

## sky.ts

`makeSkyDome(opts)` returns `{ object3D, setSun(direction), dispose() }`.

It wraps `three/addons/objects/Sky.js`, the core three Preetham daylight model,
a vendored three addon, so it adds no npm dependency and respects B.1. The dome
is one BackSide mesh, one draw call, no post-processing. Options cover
`turbidity`, `rayleigh`, `mieCoefficient`, `mieDirectionalG`, the dome `scale`,
and the initial `sunDirection`. A flat-gradient fallback dome is available with
`mode: "gradient"` for low-end devices, which reuses realism `skyColor` and
`fogColorForSky` and runs no scattering math.

Drive `setSun` from the realism sun so the sky, the directional light, and the
water glitter agree. The direction is the unit vector toward the sun in the
SalishScene frame, which is what `makeSun().direction` already returns.

```tsx
import { makeSun } from "@/app/components/scene/realism";
import { makeSkyDome } from "@/lib/scene/decor";

function SkyRig() {
  const sun = useMemo(() => makeSun(SCENE_TIME, 48.5, -123), []);
  const handle = useMemo(() => makeSkyDome({ sunDirection: sun.direction }), [sun]);
  useEffect(() => () => handle.dispose(), [handle]);
  // Pinned sun: setSun once. For animated time-of-day, call it each frame.
  return <primitive object={handle.object3D} />;
}
```

## Background ownership recommendation

The Sky dome produces the horizon gradient itself, so the realism flat
background and the dome would otherwise fight. The recommendation is to let the
Sky dome own the background by passing `background: false` to `applyRealism` in
`RealismRig`, and mount the dome. The dome draws at the far plane with
`depthWrite` off, so it sits behind all terrain and water. If a device uses the
gradient fallback, the same recommendation holds.

## horizonRing.ts

`makeHorizonRing(opts)` returns `{ object3D, dispose() }`. The `object3D` is a
Group tagged decorative-not-surveyed. The built mesh is added once a field is
available.

Data source is the baked asset `web/public/geo/horizon-ring.json`, produced by
`bakeHorizonRing.mjs` from AWS Terrain Tiles, bucket `s3://elevation-tiles-prod`,
the Mapzen-derived global bare-earth DEM that aggregates SRTM, NASADEM, GMTED,
NED, and 3DEP. Every elevation in the asset is a real sample of that open DEM at
the computed lat and lng. Nothing is invented, per B.6. The consumer carries the
per-source attribution, which the asset stores in `attribution` and the module
copies into `userData`.

Placement is true bearing and true scale around the origin using the
`worldUnitsPerMeter` convention the journey scene derives, which is
`sphere.radius / geoRadiusMeters`. The default is `DEFAULT_WORLD_UNITS_PER_METER`
at about 0.0024 units per metre. Pass the fit-accurate value from
`useTilesLayer.onFit` for exact alignment. The ring spans 28 km to 120 km, about
68 to 290 units, inside the live 800-unit far plane. The outer edge is skirted
below sea level so no gap shows where the ring meets the water. The mesh sets
`material.fog = true` so it shares `scene.fog` and dissolves into the haze.

Preload the field, then pass it for an immediate build.

```tsx
import { loadHorizonField, makeHorizonRing } from "@/lib/scene/decor";

function HorizonRig({ worldUnitsPerMeter }: { worldUnitsPerMeter?: number }) {
  const [field, setField] = useState<HorizonField | null>(null);
  useEffect(() => {
    loadHorizonField().then(setField).catch(() => setField(null));
  }, []);
  const handle = useMemo(
    () => (field ? makeHorizonRing({ field, worldUnitsPerMeter }) : null),
    [field, worldUnitsPerMeter],
  );
  useEffect(() => () => handle?.dispose(), [handle]);
  return handle ? <primitive object={handle.object3D} /> : null;
}
```

For low-end devices, pass `fallback: "silhouette"` for one cheap band at the
outer radius whose top follows the per-bearing max elevation. To skip the
preload and let the module fetch the baked asset itself, pass
`fetchAtRuntime: true`, which keeps the fetch behind that flag.

## fogTuning.ts, optional

`tuneFog(fog, opts)` mutates the passed fog in place. It sets the color from
`tunedFogColor`, which derives from realism `fogColorForSky(skyColor(elevationDeg))`
and warms toward the sun when the sun is low, and applies `near` and `far` to a
linear fog when provided. It touches only the fog object you pass.

```tsx
import { tuneFog } from "@/lib/scene/decor";

function FogTuneRig() {
  const scene = useThree((s) => s.scene);
  const sun = useMemo(() => makeSun(SCENE_TIME, 48.5, -123), []);
  useEffect(() => {
    if (scene.fog instanceof THREE.Fog) {
      tuneFog(scene.fog, { elevationDeg: sun.elevationDeg, azimuthDeg: sun.azimuthDeg });
    }
  }, [scene, sun]);
  return null;
}
```

A `THREE.Fog` color is uniform across the sky, so the sun-side warmth is a
global low-sun warmth, strongest near the horizon, not a directional gradient.
The `azimuthDeg` is accepted for parity with `makeSun` and does not drive a
directional tint. `makeTunedFog` returns a fresh fog for callers that swap
`scene.fog` rather than mutate it. The frame-driven `rollInFog` tween from
`web/lib/scene/atmosphere/transition.ts` is re-exported for animated retunes
over a camera cut.

## Re-baking the horizon asset

Run the bake from the repo root.

```bash
node web/lib/scene/decor/bakeHorizonRing.mjs
```

It fetches a small set of low-zoom terrain tiles, decodes the Terrarium height
encoding with Node builtins only, samples a polar grid of 360 bearings by 56
radial steps from 28 km to 120 km around the served-extent centre at 48.55,
-123.00, and writes `web/public/geo/horizon-ring.json`. The current asset is
about 71 KB, 20160 real samples, with a peak near 2891 m at the Mount Baker
bearing, confirming true georeferencing.

## Validation status, phase A

`cd web && npx tsc --noEmit` exits 0. The real rendered-frame visual check is
deferred to the phase-B acceptance gate, read by the Director. No frame is
claimed here.
