# OEYE-R - orca eye geometry, material, bounded gaze (research, read-only)

Lane: **OEYE** (family ORCA). Wave: OEYE-R (research). Status: findings only; no source
edited; no dependency installed. Build is O0-gated.

**Honesty statement.** The eye and its gaze are COSMETIC on a MODELED animal. The gaze is a
bounded look-at for liveliness; it asserts nothing measured about where a real whale looked.

---

## 1. Eye placement relative to the OMAT eyepatch

Anatomy: on a killer whale the actual eye is **small and dark**, set **low on the head, below
and slightly forward of the leading-lower edge of the white eyepatch**, roughly above the
corner of the gape. The white eyepatch is **skin pigment owned by OMAT** (see
`web/lib/scene/orca/materials/OMAT-R_shading.md`, region mask channel A); it is NOT the eye and
sits above-and-behind it. A common viewer error is to read the eyepatch as the eye, which is
why the eye must be placed as a distinct small feature below it.

Placement contract:
- Anchor the eye to an **OM head locator** (a named vertex/empty on the OM head mesh) positioned
  at the lower-leading corner of the OMAT eyepatch mask region, left and right.
- The eye is parented to the **OR head bone** (cross-lane, section 4) so it follows head pose.
- OEYE consumes the eyepatch mask boundary from OMAT to place itself; it does not paint the eye
  into the skin texture.

**Reference citations (external claims):**
- NOAA Fisheries, killer whale - eye position relative to the eyepatch.
  https://www.fisheries.noaa.gov/species/killer-whale
- Center for Whale Research, SRKW head/eyepatch morphology. https://www.whaleresearch.com
- Ford, Ellis, Balcomb, *Killer Whales* (UBC Press) - head and eye anatomy.

---

## 2. Eye mesh + material spec (cornea, iris, catch-light)

A **separate small mesh + material**, not painted into skin (charter lock), so it can hold a
specular catch-light and an optional gaze.

Geometry: a small sphere (eyeball), radius scaled to OM head (real orca eye is roughly tennis-
ball scale; in the twin metric frame, sub-centimetre against the body length, kept as a small
proportion of head width). A flattish clear cornea cap over a dark iris/pupil. Two segments of
detail are plenty for a real-time twin; avoid over-modelling (uncanny risk).

Material (`MeshPhysicalMaterial`, three r0.169):

| Part | baseColor | roughness | clearcoat | clearcoatRoughness | notes |
|---|---|---|---|---|---|
| Cornea / sclera shell | `#0c0e10` very dark | 0.10 | 1.0 | 0.04 | clear wet cap; catch-light lives here |
| Iris / pupil | `#050507` near-black | 0.20 | 0.0 | - | orca eye reads uniformly dark at distance |

Catch-light approach (two options, recommend A):
- **A (recommended): physical catch-light.** Let the `clearcoat` cornea reflect the **WFX
  environment + sun** (the same `WfxEnvHandle.pmremEnvironment` / `sunDirection` OMAT consumes,
  see OMAT-R section 3). The highlight then tracks the real key light and stays consistent with
  the body, and it dims/tints underwater with the same model. No baked speck.
- **B (fallback): baked speck.** A tiny near-white emissive dot offset toward the key. Cheaper,
  but it floats independent of lighting and can read fake when the camera orbits; use only on a
  low LOD or if the PMREM env is unavailable.

Real cetacean eyes have a flat-ish cornea and a reflective **tapetum lucidum**; for the twin a
clear-coat cornea + a single specular catch-light is sufficient and avoids uncanny over-detail
(charter). Reference: Mass & Supin, "Adaptive features of the cetacean eye," and the OEYE
charter grounding. https://www.fisheries.noaa.gov/species/killer-whale

---

## 3. Bounded look-at gaze model

**Gaze is a bounded, damped look-at layered on top of the OR head bone; it never writes body
orientation.**

- **Target source.** Primary: the active **W-CAM** camera. The camera director exposes the
  live camera and a look-at target (`web/lib/scene/camera/types.ts`: `CameraDirectorHandle.camera`
  and `CameraState.target`). Use the camera world position as the gaze target so the orca
  "notices" the viewer; optionally bias toward `CameraState.target` (what the camera itself is
  framing). Secondary/idle: a slow procedural drift when the camera is far or static.
- **Clamp range (relative to head-bone forward):** yaw within +/-25 deg, pitch within +/-15 deg.
  Beyond the cone, the gaze **saturates at the clamp** (the eye does not snap to follow), which
  is what keeps it believable rather than googly.
- **Slew + damping.** Limit angular velocity (about 60-90 deg/s) and critically damp toward the
  clamped target so the eye eases, never twitches. This shares the damped-follow math OPHYS uses
  (`web/lib/scene/orca/physics/OPHYS-R_dynamics.md`); keep one small helper.

### Composition order (hard rule, never overrides OG)
Per frame, the pose is built in this strict order:
1. **OG** sets body orientation (`body_yaw/pitch/roll`) from telemetry. Authoritative.
2. **OR** sets the head bone (any head DOF it exposes) on top of the OG body.
3. **OPHYS** adds bounded secondary flex (still within tolerance).
4. **OEYE gaze** rotates **only the eye meshes** in head-bone-local space toward the clamped
   target. Optionally it may add a tiny head-bone offset capped at <=5 deg, but it must **never**
   write `body_yaw/pitch/roll` and must compose after OG/OR/OPHYS so it can never override them.

If a real stream is loaded, gaze remains pure cosmetic overlay and changes no telemetry-driven
DOF.

---

## 4. LOD plan (perf + anti-uncanny)

| LOD | Distance (scene units, tune in sandbox) | Eye | Gaze | Catch-light |
|---|---|---|---|---|
| Near (hero) | close orbit | full eye mesh, clear-coat cornea | active, full clamp | physical (A) |
| Mid | mid range | eye mesh, simplified material | frozen forward or slow drift only | physical or baked |
| Far | distant | no eye mesh; dark spot in OMAT skin texture | none | none |

Dropping gaze and the eye mesh at distance removes the dominant uncanny risk (a tracking eye on
a tiny silhouette) and costs nothing. Coordinate the far "dark spot" with OMAT so the skin
texture carries it when the eye mesh is culled.

---

## 5. Cross-lane dependencies and build-time reconciliation

- **OM (head geometry):** needs a head locator vertex/empty at the lower-leading eyepatch
  corner, left/right, to anchor the eye. Reconcile the locator naming at build time.
- **OR (head bone):** gaze and the eye mesh parent to the OR head bone. **OR's exposed head DOF
  and bone name are a contract not yet finalized** (OR-R writes `docs/orca/SKELETON.md`, may not
  exist yet). Flag to O0: confirm the head-bone name and that a head DOF exists for the optional
  <=5 deg gaze head offset.
- **OG (orientation):** gaze composes strictly **after** OG and never overrides body
  orientation (section 3). This is the OEYE/OG honesty lock.
- **OMAT (eyepatch + catch-light env):** the eye sits below the OMAT eyepatch mask; the
  physical catch-light reuses the **same** `WfxEnvHandle` PMREM/sun OMAT consumes. **The WFX
  env API and the OMAT region mask are both pending** - flag to O0.
- **W-CAM:** gaze target reads `CameraDirectorHandle.camera` / `CameraState.target`. This is a
  read-only consume at runtime; no edit to camera code.

---

## 6. Perf note

- Two tiny spheres + a clear-coat material = negligible draw cost; one extra small mesh per eye.
- Gaze math is a clamped damped look-at, a few ops per frame, shared with OPHYS.
- The physical catch-light is free if `scene.environment` is already the WFX PMREM (OMAT sets
  it); otherwise the baked speck (option B) is the cheaper fallback.
- LOD culls the eye mesh and gaze entirely at distance, so OEYE never threatens the 60/30 fps
  budget. No new dependency.
