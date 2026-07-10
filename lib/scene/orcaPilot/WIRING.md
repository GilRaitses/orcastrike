# WIRING.md, the orcaPilot module

HUNT-W2 Agent A, `web/lib/scene/orcaPilot/`. Player-input/pose/camera core for
the orca-boat-hunt arcade feature. This directory owns input capture, the
dead-reckoning position/pose integrator, the `PilotTrack` (a
`BiologgingTrack`-shaped live pose source), and a third-person chase camera.
It makes exactly one edit to a pre-existing file: an additive optional
`track?: BiologgingTrack` field on `OrcaControllerOptions` in
`web/lib/scene/orca/OrcaController.ts` (see the diff in
`wavves/lanes/20260709_orca-boat-hunt/findings/HUNT-W2-AGENT-A.md`). It never
edits `OrcaRig.ts` or `biologging.ts`, and it has no import from
`web/lib/scene/tiles/`, `web/lib/scene/boats/`, or `web/lib/scene/sonar/`.

## Exports

```ts
import {
  createOrcaPilotInputSampler,
  createOrcaPilot,
  createPilotTrack,
  createChaseCamera,
  type OrcaPilotInput,
  type OrcaPilotInputSampler,
  type OrcaPilot,
  type OrcaPilotOptions,
  type GetSeabedClearanceM,
  type ChaseCamera,
  type ChaseCameraOptions,
} from "@/lib/scene/orcaPilot";
```

## How a future integrator wires this into a route

This is route-level wiring for `HUNT-INT` (a new `web/app/(sandbox)/orca-strike/`
route, per `waveset.md` locked decision 6). Not implemented here; this module
is pure library code with no route/page files.

1. **Construct the input sampler on the canvas DOM element**, once the r3f
   canvas exists (e.g. inside a `useEffect` after `gl` is available from
   `useThree`, matching the `"use client"` + effect-only browser-API
   convention in `OrcaSandboxScene.tsx`):

   ```ts
   const sampler = createOrcaPilotInputSampler(gl.domElement);
   // ... later, on unmount: sampler.dispose();
   ```

2. **Construct the pilot integrator**, optionally supplying
   `worldUnitsPerMeter` (matching whatever value the route passes to
   `createOrcaController`) and `getSeabedClearanceM` once the bathymetry
   tiles probe exists (see the contract note below):

   ```ts
   const pilot = createOrcaPilot({ worldUnitsPerMeter: wupm });
   ```

3. **Pass `pilot.track` into `createOrcaController`** so it skips
   `loadBiologging` and drives from the live pose:

   ```ts
   const controller = await createOrcaController({
     env,
     worldUnitsPerMeter: wupm,
     track: pilot.track,
   });
   ```

4. **Each frame, in this exact order**, inside `useFrame`:

   ```ts
   const input = sampler.getInput();
   pilot.update(input, dt, controller.root);
   controller.update(dt, elapsed, camera.position);
   const heading = pilot.track.sample(0).yaw; // sample() ignores its arg
   chaseCam.update(camera, controller.root.getWorldPosition(tmp), heading, dt);
   ```

   `pilot.update()` must run BEFORE `controller.update()` each frame: it
   writes `controller.root.position.x/z` and refreshes the pose that
   `pilot.track.sample()` returns, which `controller.update()` then samples
   and feeds through `driveOrca` (orientation, depth, fluke). The `elapsed`
   argument passed to `controller.update()` is irrelevant to the pose (the
   `PilotTrack.sample()` ignores its `t` argument entirely) but is still
   consumed for LOD/eye-gaze/mouth timing inside `OrcaController.update()`,
   so pass a real per-frame clock value there as usual (e.g.
   `state.clock.elapsedTime`).

   The pilot's current heading for the chase camera is the same `pose.yaw`
   the integrator just wrote; either read it back via
   `pilot.track.sample(0).yaw` (cheap, ignores `t`) or have the integrator
   also expose it directly if a future revision adds that convenience getter.

5. **Disable/detach `OrbitControls` while the pilot is active** (specifically
   while `input.pointerLocked` is true, or for the whole pilot session,
   integrator's choice), so orbit-drag and mouse-look never fight over the
   camera transform in the same frame. This module has NO dependency on
   `OrbitControls` and does not do this itself; see HUNT-INPUT.md's
   coexistence note for detail size (`makeDefault` swap or `enabled={false}`).

6. **Cleanup on unmount**: call `sampler.dispose()` (removes listeners, exits
   pointer lock if held). The pilot integrator (`createOrcaPilot`'s return)
   holds no listeners or timers and needs no `dispose()`.

## `getSeabedClearanceM` contract (bathymetry integration point)

`OrcaPilotOptions.getSeabedClearanceM?: (worldX: number, worldZ: number) =>
number | null` returns the maximum safe `depthM` (metres below the surface,
already net of any safety margin) at a given world XZ, or `null` when no data
is available yet at that point. The integrator derives this from the tiles
probe's `getSurfaceY(worldX, worldZ)` (the same probe shape used by
`web/lib/scene/camera/types.ts`'s `CameraDirectorHandle.getSurfaceY`) plus
`worldUnitsPerMeter`, converting the probed seabed elevation into metres and
subtracting a clearance margin. `orcaPilot/` has no import from
`web/lib/scene/tiles/` itself; omit this option (or let it return `null`) and
the integrator falls back to a fixed `[0, 25]` m depth band, which is also
the correct behavior for the documented flat-plane fallback (locked decision
8) if the real tileset does not fit in time.

## Chosen numeric constants

All are declared and commented in `deadReckoning.ts` and `chaseCamera.ts`;
restated here so a reviewer or the integrator does not need to open the
source to know what to expect:

| Constant | Value | Meaning |
|---|---|---|
| cruise speed | 2.2 m/s | sustained forward speed |
| boost speed | 5.5 m/s | Shift-held top speed |
| reverse speed | 1.2 m/s | max backward speed |
| acceleration | 3.0 m/s^2 | toward desired speed |
| damping | 4.5 m/s^2 | braking/coast deceleration |
| extra turn rate | 1.4 rad/s | additive A/D turn-rate assist (not a strafe) |
| max pitch | 20 deg | bounded cosmetic dive/climb angle |
| max roll | 15 deg | bounded cosmetic bank angle |
| pitch return rate | 2.5 /s | spring-back-to-level decay constant |
| bank gain | 0.35 | roll radians per (rad/s) of turn rate |
| dive/climb rate | 1.5 m/s | depth change rate at max pitch |
| default depth band | 0-25 m | fallback safe band with no seabed probe |
| fluke rate range | 0.15-0.6 Hz | idle to full-boost fluke beat rate |
| chase camera distance/height/smoothing | 8 / 3 / 8 (defaults) | third-person follow standoff and ease rate |

## Input semantics (`left`/`right`)

Implemented as an additive yaw-rate turn ASSIST on top of mouse yaw, not a
strafe: holding A/D never moves the orca sideways relative to its own
heading, it only turns faster. Mouse yaw (`yawDelta`) is the primary steering
input; A/D is an arcade-feel accelerant on top of it.

## Validation

`npm run typecheck` (`tsc --noEmit`) passes with exit code 0 against the
whole `web/` project, including these new files and the `OrcaController.ts`
edit.

`npm run lint` (`next lint`) could not be run to completion in this
workspace: the repo has **no ESLint config anywhere** (`web/.eslintrc*`,
`web/eslint.config.*`, and any `eslintConfig` key in `web/package.json` are
all absent, and `node_modules` has no `eslint` package installed), so `next
lint` stops at an interactive "How would you like to configure ESLint?"
prompt that cannot be answered non-interactively without either installing a
new dependency or writing a new top-level ESLint config file, both outside
this task's file-scope (`web/lib/scene/orcaPilot/` plus the one
`OrcaController.ts` edit only). This is a pre-existing repo condition, not
something introduced by this change; it is called out in
`HUNT-W2-AGENT-A.md` as a named gap/escalation for O0 rather than worked
around by adding an out-of-scope config file. Cursor's own linter
(`ReadLints`) reports zero errors on every file this module touched or
created.
