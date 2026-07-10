# WIRING-realism.md - mounting the realism module into SalishScene.tsx

Wave 1, agent A. This tells the Wave 2 integrator (the sole editor of
`web/app/components/scene/SalishScene.tsx`) exactly how to mount the realism
module. Agent A did **not** edit `SalishScene.tsx`; the integrator applies
everything below.

The module lives in `web/app/components/scene/realism/` and adds **no new
dependency** (only `three`, `@react-three/fiber`, `@react-three/drei`, all
already in `web/package.json`).

## What it provides

| Export | Kind | Purpose |
|--------|------|---------|
| `applyRealism(scene, opts)` | imperative | installs sun + ambient + hemisphere lights, fog, sky background, and the animated water surface onto a `THREE.Scene`; returns a handle |
| `makeWater(opts)` | pure factory | builds the animated ocean mesh + shader; `{ mesh, material, update, setSunDirection, dispose }` |
| `makeSun(date, lat, lng)` | pure | NOAA solar position -> `{ direction, color, intensity, ambientIntensity, elevationDeg, azimuthDeg, isNight }` in SalishScene frame |
| `makeFog`, `skyColor`, `fogColorForSky` | pure | atmosphere helpers |
| `depthColor`, `oceanDepthColor`, `landElevationColor` | pure | color ramps (a faithful port of the live `depthColor`) + the palette constants |

## Coordinate frame (already matched)

The module uses the SalishScene frame from `web/lib/sceneIntent.ts`: `+X` east,
`+Y` up, `-Z` north (so `+Z` is south). `makeSun().direction` is the unit vector
pointing **toward the sun** - assign it (scaled) to a directional light's
`position`. The water plane is authored in XY and rotated `-PI/2` about X, the
same orientation as the existing `WaterPlane`.

---

## Option 1 (recommended): declarative, replace the light block + WaterPlane

This keeps SalishScene declarative and replaces the hard-coded lights and the
`WaterPlane` with sun-driven equivalents. Add a small client component inside
`SalishScene.tsx` (or a sibling file the integrator owns) that drives the water:

```tsx
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeSun, makeWater, makeFog, skyColor, fogColorForSky, type WaterHandle } from "./realism";

function RealismLayer({ depth, date = new Date() }: { depth: number; date?: Date }) {
  const { scene } = useThree();
  const sun = useMemo(() => makeSun(date, 48.5, -123), [date]);
  const waterRef = useRef<WaterHandle | null>(null);

  useEffect(() => {
    const water = makeWater({
      width: SCENE_WIDTH * 1.6,
      depth: depth * 1.6,
      sunDirection: sun.direction,
    });
    waterRef.current = water;
    scene.add(water.mesh);

    const sky = skyColor(sun.elevationDeg);
    const prevFog = scene.fog;
    const prevBg = scene.background;
    scene.fog = makeFog({ color: fogColorForSky(sky) });
    scene.background = sky;

    return () => {
      scene.remove(water.mesh);
      water.dispose();
      scene.fog = prevFog;
      scene.background = prevBg;
    };
  }, [scene, depth, sun]);

  useFrame((state) => waterRef.current?.update(state.clock.elapsedTime));

  return (
    <>
      <ambientLight intensity={sun.ambientIntensity} />
      <directionalLight
        position={sun.direction.clone().multiplyScalar(140).toArray()}
        intensity={sun.intensity}
        color={sun.color.getHex()}
        castShadow
      />
      <hemisphereLight args={["#8fc7ff", "#0a2540", 0.4]} />
    </>
  );
}
```

Then in the `SalishScene` `<Canvas>` body:

1. **Remove** the existing light block:
   ```tsx
   <ambientLight intensity={0.6} />
   <directionalLight position={[60, 90, 40]} intensity={1.1} castShadow />
   <hemisphereLight args={["#8fc7ff", "#0a2540", 0.4]} />
   ```
2. **Remove** `<WaterPlane depth={depth} />` (and the `WaterPlane` function if
   unused elsewhere).
3. **Add** `<RealismLayer depth={depth} />` in their place.
4. Optionally drop the inline `background`/`onCreated` clear color on `<Canvas>`
   since `RealismLayer` now sets `scene.background` from `skyColor`. Keeping them
   is harmless (they are overridden after mount).

`SCENE_WIDTH` is already imported in `SalishScene.tsx`; reuse it.

---

## Option 2: imperative one-call mount (smallest diff)

If you prefer one call, drop a rig component that uses `applyRealism` and remove
the light block + `WaterPlane` (it creates its own lights, fog, background, and
water):

```tsx
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { applyRealism, type RealismHandle } from "./realism";

function RealismRig({ depth }: { depth: number }) {
  const { scene } = useThree();
  const handleRef = useRef<RealismHandle | null>(null);
  useEffect(() => {
    const h = applyRealism(scene, {
      lat: 48.5,
      lng: -123,
      waterOptions: { width: SCENE_WIDTH * 1.6, depth: depth * 1.6 },
    });
    handleRef.current = h;
    return () => h.dispose();
  }, [scene, depth]);
  useFrame((s) => handleRef.current?.update(s.clock.elapsedTime));
  return null;
}
```

Place `<RealismRig depth={depth} />` in the Canvas and delete the old lights +
`<WaterPlane />`. `applyRealism` adds the lights, fog, and water and restores
the prior fog/background on dispose.

> Note: `applyRealism` sets `scene.background` to a `THREE.Color`. If you want to
> keep the CSS gradient on the `<Canvas>` element instead, pass
> `{ background: false }`.

---

## Depth-color continuity (for the terrain, Wave 2 tiles)

The terrain coloring in `SalishScene.tsx` (`depthColor`, and the `WATER_*` /
`LAND_*` constants) is reproduced exactly in `realism/palette.ts`. When the
Wave 2 tiles replace `salish_heightmap.json`, color the tile / mesh vertices
with `oceanDepthColor(depthMeters)` and `landElevationColor(elevMeters)` (or the
ported `depthColor(signed, minDepth, maxDepth)`) so the new geometry keeps the
same shoreline palette the current scene uses. The shoreline is the 0 m line,
matching the CUDEM NAVD88 0 m contour from agent B's recipe.

## Sun / time-of-day

`makeSun(date, lat, lng)` takes a UTC `Date`. To animate time of day, call
`handle.setDate(newDate)` (Option 2) or recompute `makeSun` and re-render
(Option 1). Default lat/lng (48.5, -123) is the Salish Sea study center.

## Do NOT

- Do not import `RealismSandbox.tsx`. It is a throwaway validation harness for
  Wave 1 only and is not meant for the live scene.
- Do not add a dependency; the module is `three`-only.

## Validation performed by agent A

`tsc --noEmit` over the seven module files passed clean (exit 0). The integrator
should re-run the full `npm run typecheck` after wiring, since that also checks
the edited `SalishScene.tsx`.
