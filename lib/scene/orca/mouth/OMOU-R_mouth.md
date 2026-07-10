# OMOU-R - orca mouth: teeth, jaw, tongue, articulation (research, read-only)

Lane: **OMOU** (family ORCA). Wave: OMOU-R (research). Status: findings only; no source
edited; no dependency installed. Build is O0-gated.

**Honesty statement.** The mouth and any mouth-open cue are MODELED behavior on a MODELED
animal driven by SIMULATED telemetry. A mouth-open tied to a buzz/foraging moment is a
labeled animation cue; it does NOT assert the animal fed or caught prey.

---

## 1. Anatomy

- **Teeth.** Killer whales are homodont odontocetes with **about 40-56 conical interlocking
  teeth**, roughly **10-14 per quadrant** (upper-left, upper-right, lower-left, lower-right),
  a single permanent set, no baleen. Teeth are conical and curve slightly inward; upper and
  lower teeth **interlock** when the mouth closes (they do not meet tip-to-tip like a shark
  grin). Tooth diameter is large, up to roughly 2.5 cm.
- **Jaw.** The **mandible (lower jaw) hinges** at the jaw joint; the rostrum/upper jaw is
  effectively **fixed**. Articulation is a single hinge rotation, not a complex bite rig.
- **Tongue / cavity.** A large fleshy tongue and a dark oral cavity; the gum line follows the
  tooth row. For a real-time twin the tongue is a simple low-poly fleshy form, not a detailed
  muscular model.

**Reference citations (external claims):**
- NOAA Fisheries, killer whale - dentition and feeding morphology.
  https://www.fisheries.noaa.gov/species/killer-whale
- Ford, Ellis, Balcomb, *Killer Whales* (UBC Press) - tooth count and interlocking conical
  dentition of resident killer whales.
- Heyning, J.E. & Mead, J.G., odontocete cranial/dentition anatomy (review literature) for the
  homodont conical tooth plan.

---

## 2. Interior sub-mesh plan (revealed by the OR `jaw` DOF)

A **separate interior sub-mesh**, hidden when the jaw is closed and revealed as the OR `jaw`
DOF opens (charter lock; OR already exposes a `jaw` DOF, see `ORCA-RIG_CHARTER.md`).

Sub-mesh parts:
- **Upper tooth row + upper gum** - rigidly parented to the head/rostrum (fixed).
- **Lower tooth row + lower gum** - rigidly parented to the **mandible bone**, so it swings
  with the `jaw` DOF.
- **Tongue** - parented to the mandible/floor of the mouth, low-poly.
- **Oral cavity shell** - a dark interior surface so the open mouth does not show through to
  the body backfaces.

Teeth count is built to the anatomical range (target ~12 per quadrant -> ~48 total), conical
and interlocking, deliberately **not** an exaggerated shark grin (charter).

### Jaw articulation curve
- Rotation about the **jaw hinge axis** (head-local lateral axis), one DOF.
- Angle band: **closed/relaxed = 0-3 deg** (default), **subtle open = 8-15 deg**, **hard cap
  < ~25 deg** (no aggressive gaping, charter lock).
- Curve: ease-in-out (smoothstep) open and close, with a short hold; opening is slow and calm,
  never a snap. The lower tooth row + tongue ride the mandible bone rigidly, so the interlock
  releases naturally as the angle grows.

---

## 3. OG trigger mapping (foraging/buzz -> subtle open), with the honesty caveat

The mouth-open cue is driven by **OG** behavior context when a stream is loaded, otherwise a
rare idle. Default state is **closed/relaxed**.

Source signals in the dtag fixture (`data/dtag_analysis_results.json`, served read-only by
`src/aws_backend/routers/dtag.py`):
- per-dive `foraging_indicators.buzz_events` (fixture range 40-78),
- `foraging_indicators.click_rate` (~59-61),
- `foraging_indicators.foraging_intensity` (~5.4-9.7),
- `dive_type` (`deep_travel`, `deep_exploration`) and `behavioral_context`.

Proposed mapping (modeled, labeled):
- While a loaded stream is **in a dive** with **elevated buzz_events / foraging_intensity
  relative to that deployment's own distribution**, raise the *probability* of an occasional
  subtle jaw open (8-15 deg), gated by a minimum re-trigger interval (e.g. no more than one open
  every several seconds) and a smoothing envelope so it never chatters.
- Outside those windows, and when no stream is loaded, the jaw stays relaxed with only a rare
  idle open.
- The cue modulates **probability and timing of a subtle open**, never forces a gape and never
  changes any OG primary DOF.

### Honesty caveat (hard)
The in-repo fixture is explicit that this is **not** a feeding claim: `foraging_dives` is
**0**, every `prey_pursuit_events` is `"0"`, `success_probability` is ~0.53 (near uniform), and
`src/aws_backend/routers/dtag.py` reports `model_state: "not_trained"` with a uniform-probability
caveat. Therefore the mouth-open cue must be presented in the HUD as **modeled behavior cued by
biologging context**, explicitly NOT "the whale is eating." Buzz/echolocation activity is an
acoustic indicator, not observed prey capture. This is the OMOU/OG honesty lock.

---

## 4. LOD plan

| LOD | Distance | Interior |
|---|---|---|
| Near (hero) | close | full tooth rows (geo), tongue, cavity; jaw articulates |
| Mid | mid | reduced tooth geo or normal-mapped strip; tongue simplified; jaw articulates |
| Far | distant | interior culled; jaw locked closed; no open cue |

When the jaw is closed, the interior sub-mesh is hidden regardless of LOD (cheap default state).
Far LOD disables the open cue entirely (an articulating mouth on a tiny silhouette adds nothing).

---

## 5. Cross-lane dependencies and build-time reconciliation

- **OM (head/jaw geometry):** the interior sub-mesh and tooth rows are authored to OM's head and
  jaw geometry and UVs. Reconcile the rostrum-vs-mandible vertex split at build time.
- **OR (`jaw` DOF):** the entire articulation rides the OR `jaw` DOF and a mandible bone. **OR's
  `jaw` axis, pivot, and limits are a contract in `docs/orca/SKELETON.md`, which may not exist
  yet.** Flag to O0: confirm the `jaw` hinge axis/pivot and that the lower tooth row + tongue can
  skin/parent to the mandible bone.
- **OG (triggers):** the open cue consumes OG behavior context (buzz/foraging/dive). **OG's
  per-frame behavior-context API is not yet defined** (`OG-R_h5_mapping.md` may not exist yet).
  Flag to O0: confirm how OG surfaces "in a dive" + a normalized foraging-intensity signal per
  frame. Until then, OMOU-BUILD can tune against the fixture's per-dive values directly.
- **OMAT (lips/skin around the gape):** the exterior lip line and skin are OMAT; OMOU owns only
  the interior. Reconcile the gape boundary so no gap shows between skin and interior at full
  open.

---

## 6. Perf note

- Interior is hidden in the default closed state, so the common-case cost is ~zero.
- Tooth rows are the only heavy element: build them as a single low-poly merged strip per jaw
  (not 48 separate meshes) to keep draw calls at one or two; conical detail via geometry near,
  normal map mid. KTX2 for any interior textures.
- Jaw articulation is a single bone rotation per frame, trivial.
- No new dependency. Within the 60/30 fps budget; the orca's cost stays dominated by skin and
  the existing WFX water passes, not the mouth.
