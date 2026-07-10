# OMAT-R - orca skin shading + countershading (research, read-only)

Lane: **OMAT** (family ORCA). Wave: OMAT-R (research). Status: findings only; no source
edited; no dependency installed. Build is O0-gated.

**Honesty statement.** This specifies the *appearance* of a MODELED orca lit by the MODELED
twin environment. It asserts nothing measured about a real individual; coloration is the
generic Southern Resident killer whale (SRKW) countershading pattern, not a named whale's
photo-ID markings.

---

## 1. Texture-set vs procedural-mask recommendation

**Recommendation: a hybrid - a hand-authored region MASK texture plus a small albedo set,
not a pure procedural mask and not a fully painted hero albedo.**

Why not pure procedural: the SRKW pattern is anatomically placed, not parametric. The white
eyepatch is an oval above and behind the eye, the grey saddle patch sits behind the dorsal
fin and is the feature used for individual photo-ID, and the chin/ventral/flank whites have
crisp pigment boundaries. A noise/SDF procedural mask cannot place these correctly across
the OM UV layout without effectively encoding the same hand-authored boundaries, so it buys
nothing over a painted mask.

Why not a single painted hero albedo: a flat RGB albedo bakes one lighting/wetness read and
loses the ability to vary roughness and subsurface per region (black dorsal must stay
glossier and less translucent than the thin white chin).

Proposed asset set, authored on the **OM** UVs (cross-lane dependency, see section 5):

| Map | Purpose | Notes |
|---|---|---|
| `orca_albedo` | base pigment | black dorsal, white ventral/eyepatch/chin, grey saddle |
| `orca_regionMask` | RGBA region IDs | R=dorsal-black, G=ventral-white, B=saddle-grey, A=eyepatch |
| `orca_normal` | skin micro-relief, dorsal-fin/fluke creases | low amplitude, wet skin is smooth |
| `orca_roughness` | per-region gloss | drives the wet read; packs with mask where possible |

The region mask lets the shader (or material onBeforeCompile patch) modulate roughness, a
subtle subsurface weight, and the saddle's softer pigment edge without four separate
materials. One mesh, one material.

**Reference citations for the pattern (external claims):**
- NOAA Fisheries, Southern Resident Killer Whale species page and ID guidance (countershading,
  eyepatch, saddle patch as the photo-ID feature). https://www.fisheries.noaa.gov/species/killer-whale
- Center for Whale Research, saddle-patch/eyepatch photo-identification of SRKW.
  https://www.whaleresearch.com
- Ford, J.K.B., Ellis, G.M., Balcomb, K.C., *Killer Whales* (UBC Press) - coloration and
  pigment-region anatomy of resident killer whales.

---

## 2. Wet-skin BRDF spec (concrete values)

Wet cetacean skin is a smooth dielectric with a thin water film: high specular, low
roughness, no metalness, shallow subsurface in thin pale areas. The black must read as
**glossy near-black**, never crushed matte.

Target as `MeshPhysicalMaterial` parameters (linear space, three r0.169):

| Region | baseColor (sRGB hex) | roughness | metalness | clearcoat | clearcoatRoughness | SSS / sheen weight |
|---|---|---|---|---|---|---|
| Dorsal black | `#0b0d10` (not `#000`) | 0.16 | 0.0 | 0.35 | 0.08 | ~0.0 |
| Ventral / chin white | `#e7eaec` | 0.24 | 0.0 | 0.25 | 0.12 | 0.25 (thin areas) |
| Eyepatch white | `#eef1f2` | 0.22 | 0.0 | 0.30 | 0.10 | 0.15 |
| Saddle grey | `#7d858b` | 0.30 | 0.0 | 0.20 | 0.15 | 0.10 |

Notes that make it read correctly:
- **F0 / specular.** Dielectric skin under a wet film sits near IOR 1.33-1.40, so normal-
  incidence reflectance is about 0.02-0.05. Leave `specularIntensity` at the physical default
  (do not crush it) so the black keeps its sheen.
- **Black stays glossy.** Keep baseColor a very dark blue-grey (`#0b0d10`), not pure black,
  and keep roughness low (~0.16) plus the thin `clearcoat` water layer. Pure-black + high-
  roughness is the failure mode that reads as matte rubber.
- **Subsurface.** Real SSS is expensive. Use the cheap route first: `sheen`/`sheenColor` on
  the pale regions, or a wrap-diffuse term injected via `onBeforeCompile`, gated by the region
  mask so only thin white areas get it. Reserve `transmission`/`thickness` true SSS for a
  hero close-up LOD only (perf, section 6).
- No emissive, no cartoon rim light (charter lock).

**External reference for wet-dielectric specular / clearcoat film:** Karis B., "Real Shading
in Unreal Engine 4" (SIGGRAPH 2013) for the F0/roughness conventions three's PBR follows;
three.js `MeshPhysicalMaterial` clearcoat docs. https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial

---

## 3. Binding the WFX environment (above-water PMREM + underwater absorption)

This is the central cross-lane item. The orca must be lit by the **same** environment as the
water or it reads pasted in. WFX (`.cca/catalogue/O0/20260628_water-fx/`) owns that
environment. **The WFX research findings docs do not exist yet** (the `research/` folder is
currently empty), so the exact API must be reconciled at O0 build time. This lane proposes
the handoff WFX must expose.

### Proposed handoff interface (name: `WfxEnvHandle`)

```ts
// Produced by WFX, consumed by OMAT (and OEYE catch-light). Names are a proposal
// for O0 reconciliation, not an adopted API.
interface WfxEnvHandle {
  // ABOVE water: image-based lighting for the orca's PBR material.
  pmremEnvironment: THREE.Texture;  // PMREM of the WFX procedural sky (WFX-R04/R05)
  sunDirection: THREE.Vector3;      // already available via realism/sun.ts makeSun()
  sunColor: THREE.Color;
  sunIntensity: number;
  // BELOW water: the same volumetric model depthWater.ts uses, so the orca dims/tints to match.
  underwater: {
    absorption: THREE.Vector3;      // per-channel extinction, inverse scene units (WFX-R09)
    inScatterColor: THREE.Color;    // turbid-green Salish in-scatter (WFX-R08/R11)
    waterLevelY: number;            // scene Y of the surface (depthWater.ts uses 0)
    visibility: number;             // scene units of useful sight distance
  };
}
```

### How OMAT binds it
- **Above water:** set `scene.environment = pmremEnvironment` (or pass it to the material's
  `envMap`) so the material's IBL specular/diffuse comes from the WFX sky, and use the same
  `makeSun()` direction/color/intensity (`web/app/components/scene/realism/sun.ts`) as the
  directional key. No private studio light on the orca.
- **Below water:** apply the **same Beer-Lambert tint** the water uses. `depthWater.ts`
  currently colors by `colorT = 1 - exp(-column / uDepthColorScale)` and the pending
  per-channel request `web/lib/scene/bathy/style/WATER2_TUNING_REQUEST.md` proposes
  `transmittance = exp(-uAbsorption * column)` with `uAbsorption ~ vec3(3.0, 1.6, 0.9)`. OMAT
  must inject `exp(-absorption * depthBelowSurface)` (the orca's own depth below `waterLevelY`)
  as a multiplicative tint on its lit color, plus add the WFX `inScatterColor` weighted by
  view distance, via an `onBeforeCompile` patch on the standard material. That keeps the orca
  on the identical optical model as the surrounding water.

### Flag for O0 / WFX coordination (build-time reconciliation)
1. WFX must **publish a PMREM environment texture** from its procedural sky. Today only a flat
   `scene.background` sky color exists (`applyRealism.ts` sets `scene.background`); there is no
   PMREM. This is owned by WFX-R04 (sky-atmosphere) + WFX-R05 (lighting-tonemap), which are
   **not yet written**. Without it the orca's IBL is a flat color and will look disjoint.
2. WFX must **publish the underwater absorption vector + in-scatter color** as shared uniforms
   (owned by WFX-R08 + WFX-R09 + WFX-R11, also not yet written). OMAT must consume the **same**
   numbers, not a private copy, or the orca and water diverge as WFX tunes.
3. The `WfxEnvHandle` shape above is a **proposal**; O0 must reconcile names/ownership with the
   WFX synthesis before OMAT-BUILD.

---

## 4. Material implementation: three PBR vs custom shader

**Recommendation: `MeshPhysicalMaterial` (clearcoat for the wet film) with an `onBeforeCompile`
patch for the WFX underwater tint + region-mask SSS. Do not write a full custom shader.**

Rationale: the wet dielectric + clearcoat + IBL is exactly what `MeshPhysicalMaterial` already
does, and it consumes `scene.environment` (the WFX PMREM) for free. The only thing it cannot do
out of the box is the underwater Beer-Lambert tint/in-scatter and the per-region SSS weighting;
both are small additive injections via `onBeforeCompile`, far cheaper to maintain than a
hand-written orca shader that would re-derive IBL. A full custom shader is only justified if
WFX's underwater model becomes too complex to inject, which should return to O0.

---

## 5. Cross-lane dependencies and build-time reconciliation

- **OM (mesh/UVs):** all four textures are authored against OM's UV layout and topology.
  OMAT-BUILD cannot start until OM exposes a UV-unwrapped mesh. If OM ships multiple material
  slots, the region mask collapses them to one.
- **OR (rig):** none directly for skin, but OMAT must not fight OEYE/OMOU sub-meshes that sit
  on OR bones (shared head region around the eyepatch boundary, section overlaps OEYE).
- **OG (motion):** none for shading. Optional: an honest, labeled "behavioral tint" hook
  (dive context) is explicitly out of OMAT scope unless O0 asks.
- **WFX (environment):** section 3. The single largest reconciliation item: the PMREM env and
  the underwater absorption/in-scatter must be the **same** objects the water uses. **The WFX
  research docs are not yet written** - flag to O0.
- **OEYE boundary:** the eyepatch is **skin** owned by OMAT; the eye mesh (OEYE) sits below/
  behind it. OMAT supplies the eyepatch mask region; OEYE places the eye relative to it.

---

## 6. Perf note

- **Texture budget:** albedo + normal + roughness + region mask at 2K each, KTX2/Basis
  compressed, lands around 1.0-1.5 MB total on the wire; 1K halves that and is the
  recommended LOD-1 set. The twin already uses the KTX2/meshopt path for tiles
  (`3d-tiles-renderer` in `web/package.json`), so KTX2 is in-budget.
- **Shader cost:** `MeshPhysicalMaterial` + clearcoat is heavier than `MeshStandardMaterial`
  by roughly one extra specular lobe; for a single hero orca this is negligible against the
  scene's existing depth pre-pass (one full extra scene render, per `depthWater.ts`). The
  `onBeforeCompile` underwater tint adds a handful of ALU ops per fragment.
- **LOD plan:** hero close = `MeshPhysicalMaterial` + clearcoat + 2K + optional true SSS;
  mid = `MeshStandardMaterial` + 1K + sheen approximation; far = `MeshStandardMaterial` + 512
  albedo, no clearcoat. Far LOD drops the eye mesh to a baked dark spot (coordinate with OEYE).
- **Budget frame:** 60fps desktop / 30fps laptop (same budget WFX states). A single orca
  material is not the bottleneck; the WFX water passes are. No new dependency.
