# OPHYS-R - orca secondary-motion dynamics (research, read-only)

Lane: **OPHYS** (family ORCA). Wave: OPHYS-R (research). Status: findings only; no source
edited; no dependency installed. Build is O0-gated.

**Honesty statement.** OPHYS is animation polish layered on a MODELED pose driven by SIMULATED
telemetry. It adds only bounded, clamped secondary motion; the trajectory, depth, heading,
pitch, roll, and fluke-beat rate remain OG's. It fabricates no movement the data did not show.

---

## 1. Secondary-dynamics model: which chains, what dynamics

OG (`ORCA-MOTION_CHARTER.md`) sets the **primary** DOFs from telemetry: `body_yaw` from heading,
`body_pitch` from pitch, `body_roll` from roll, world-Y from depth, and `setFluke(phase,
amplitude)` from the accelerometer Az oscillation (mapping table in `ORCA-MOTION_CHARTER.md`).
A pose set directly from samples is stiff; OPHYS adds lag, overshoot, and elastic flex **on top**.

| Chain (OR DOFs) | Dynamics | Why | Suggested coefficients |
|---|---|---|---|
| Spine (thoracic/lumbar) | **Spine IK** for body-follows-heading + critically damped smoothing | body should arc into its heading, not pivot rigidly | damping ratio zeta = 1.0 (no overshoot), omega_n ~ 3-5 rad/s |
| Caudal / fluke chain | **Under-damped follow-through spring** (lag + slight overshoot on the beat) | a real fluke trails and whips slightly behind the driven beat | zeta ~ 0.6-0.8, omega_n ~ 6-12 rad/s (scaled to fluke-beat rate) |
| Pectoral flippers L/R | **Damped trailing flex** | flippers lag the body in turns/glide | zeta ~ 0.7, omega_n ~ 3-5 rad/s |

- **Spine IK for heading-follow.** Solve a short IK/curve so the thoracic-lumbar chain bends
  smoothly toward `body_yaw` (a 2-3 joint analytic bend or a CCD pass over the spine bones),
  rather than yawing the whole body as one rigid object. The IK target is derived from OG's own
  heading; it adds no new heading.
- **Follow-through springs.** Each driven joint angle theta_drive (from OG/IK) feeds a damped
  spring whose output theta_vis lags it: a standard second-order system
  `theta_vis'' = omega_n^2 (theta_drive - theta_vis) - 2*zeta*omega_n*theta_vis'`. Under-damping
  on the caudal chain gives the lively whip; critical damping on the spine gives clean follow.
- **Drag / banking lean derived from OG turn rate.** Compute yaw rate `r = d(body_yaw)/dt` from
  the OG stream. Derive a small additional **bank flex distributed along the spine**:
  `leanFlex = clamp(k_bank * r, -maxLeanDeg, +maxLeanDeg)` with `maxLeanDeg ~ 8-12 deg` total
  across the chain. This is **consistent with roll** (a turning body banks) and is a SECONDARY
  flex; the authoritative roll value stays OG's `body_roll`. The displayed roll is OG roll plus
  this bounded flex, and the flex must stay within the section-2 tolerance.

**External references (technique):**
- Larsson, D., "Secondary Motion for Game Characters" / the common "spring bones" pattern;
  three.js has **no built-in** secondary-dynamics solver, confirmed against `web/package.json`
  (`three ^0.169.0`, `@react-three/drei ^9.122.0`, no physics lib).
- Damped harmonic oscillator / semi-implicit (symplectic) Euler integration for stable springs;
  e.g. Witkin & Baraff, "Physically Based Modeling" (SIGGRAPH course notes) for the integrator
  stability conditions.
- CCD / analytic two-bone IK for the spine bend (standard real-time IK).

---

## 2. HARD LINE + concrete data-tracking tolerance

**Hard line (charter lock):** position, depth, heading, pitch, roll, and fluke-beat RATE come
from OG. OPHYS adds only bounded, clamped secondary motion. The fluke-beat **rate** is never
changed; OPHYS may only shape **phase lag and amplitude envelope** within a bound.

### Proposed tolerance bound (the verifiable contract)

Per frame, compare the OPHYS-polished pose to the raw OG pose:

| Quantity | Bound (deviation of polished from OG) |
|---|---|
| Heading (yaw) | <= 3 deg RMS, <= 5 deg peak |
| Pitch | <= 3 deg RMS, <= 5 deg peak |
| Roll (incl. banking flex) | <= 4 deg RMS, <= 6 deg peak |
| World position / depth (Y) | <= 0.5% of the local water-column depth, and <= 0.2 scene units absolute |
| Fluke-beat **rate** | **exactly 0 deviation** (rate is OG's; OPHYS must not alter it) |
| Fluke **phase** | <= 15 deg phase lag (the follow-through), bounded and decaying |

The headline number to report to O0: **secondary motion keeps every primary orientation axis
within +/-3 deg RMS (roll +/-4 deg) and never alters the fluke-beat rate or the depth track
beyond 0.5% of column.**

### How to verify
A headless verification harness (net-new, in the `/orca` sandbox or a `.test.mts` under
`web/lib/scene/orca/physics/`) that:
1. loads the simulated fixture (`data/dtag_analysis_results.json`) through the OG driver to get
   the raw per-frame OG pose,
2. runs the OPHYS layer to get the polished pose,
3. logs both, computes per-channel RMS and peak deviation, and **asserts each is within the
   table above**,
4. re-runs at **30, 60, and 120 fps** fixed and variable steps and asserts the deviation curves
   match within a small epsilon (frame-rate independence, section 3).

This makes "the polish still tracks the telemetry" a checkable test, not a claim. If any channel
exceeds its bound, OPHYS-BUILD reduces the corresponding coefficient or tightens the clamp; if
the model cannot stay in bounds, return to O0.

---

## 3. Stability + frame-rate independence

- **Integrator.** Use semi-implicit (symplectic) Euler or an analytic damped-spring step. Both
  are stable for the zeta/omega_n above when the step is bounded.
- **Clamp everything.** Clamp each spring output angle to its joint limit (from OR), clamp
  velocities, and clamp the banking flex to `maxLeanDeg`. No unbounded accumulation.
- **Frame-rate independence.** Drive the springs from a **fixed-timestep accumulator** (e.g.
  120 Hz internal substeps) so behavior is identical across display rates, and **cap dt** (e.g.
  clamp delta to <= 1/30 s) so a stall cannot inject a huge impulse. Never feed raw variable dt
  into the spring without the accumulator.
- **NaN guard.** Guard against NaN/Inf (e.g. after a tab-suspend) by resetting the spring state
  to the driven angle.

---

## 4. Cross-lane dependencies and build-time reconciliation

- **OR (rig DOFs):** OPHYS drives the **same named DOFs** OR exposes - `body_yaw/pitch/roll`,
  the `caudal[]` chain, `pectoral_L/R` - and reads their **joint limits** for clamps. **OR's DOF
  names, joint counts, axes, and limits are a contract in `docs/orca/SKELETON.md` /
  `web/lib/scene/orca/rig/`, which may not exist yet.** Flag to O0: confirm the spine bone count
  for the IK bend and the caudal chain length before OPHYS-BUILD. The proposed coefficients are
  expressed as zeta/omega_n so they survive a change in joint count.
- **OG (telemetry base pose):** OPHYS layers strictly on top of the OG pose and reads OG's
  per-frame `body_yaw` to derive turn rate. **OG's driver API (`driveOrca(rig, t)`) is not yet
  built.** Flag to O0: OPHYS must run **after** OG each frame, and the verification harness needs
  OG's raw pose exposed for the A/B comparison. Reconcile the per-frame ordering: OG -> OPHYS ->
  (OEYE gaze last).
- **OEYE/OMOU:** OEYE gaze composes after OPHYS (see `OEYE-R_eyes.md` section 3); OMOU jaw is an
  independent DOF OPHYS does not touch.
- **WFX:** none. OPHYS is geometry/motion only; lighting is OMAT/WFX.

---

## 5. Hand-rolled vs small lib (costed recommendation)

**Recommendation: hand-rolled, no new dependency.**

- The whole model is a handful of second-order springs + one short IK bend over maybe a dozen
  joints (spine ~3-5, caudal ~5, two pectorals). That is roughly **120-200 LOC** of plain
  three.js math, **zero bundle cost**, and fully under OPHYS's control for the tolerance proof.
- A full physics/rigid-body lib (e.g. rapier-wasm, hundreds of KB) is **overkill and rejected**:
  it adds bundle weight, a wasm load, and a solver whose outputs are harder to clamp to the
  tolerance contract. The charter forbids a full rigid-body engine.
- `@react-three/drei` is already present but offers no secondary-dynamics solver, so it adds
  nothing here. Any dependency proposal returns to O0 (charter escalation).

---

## 6. Perf note

- Cost is O(joints): about a dozen damped-spring updates + one short IK pass per frame, run on
  the CPU in the animation step. Estimated **well under 0.1 ms/frame** for a single orca,
  negligible against the scene's existing depth pre-pass (one full extra scene render per
  `depthWater.ts`) and the WFX water passes.
- The fixed-timestep accumulator at 120 Hz is a few extra substeps per frame, still trivial for
  this joint count.
- LOD: at far distance, drop the springs to the raw OG pose (no follow-through is visible on a
  tiny silhouette), saving even this small cost. Within the 60/30 fps budget. No new dependency.
