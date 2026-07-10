# Behavior-clip ethogram — wiring (BRE-owned)

Net-new/extended. The behavior -> motion-clip ethogram that lets a spawned orca
play a kinematic behavior window instead of one fixed clip. Sandbox-only until
the O0-gated integrator mounts the reenactment into SalishScene.

## Files

| File | Role |
|------|------|
| `clipSampleTime.ts` | fold a playhead second into a clip window; optional per-instance `phaseOffsetS` |
| `ethogram.ts` | build a behavior -> clip ethogram from the manifest; per-instance assignment; disclosed modeled labels |
| `../../../../public/orca/motion/clips/manifest.json` | the REAL clip manifest (web-served at `/orca/motion/clips/manifest.json`) |

## Honesty (locked, R04/R05)

- Every clip is a time window `[t0_s, t1_s]` INTO the measured SRKW driver, so
  `track.sample()` always returns measured telemetry, never synthesized motion.
- The behavior NAME (Traveling, Side_rolls, ...) is a MODELED kinematic match to
  the humpback 9-class ethogram (`behavior_mapping.json`), disclosed as such,
  never presented as measured orca behavior. `modeledClipLabel(clip)` builds the
  on-screen disclosed string.
- WHICH clip an orca plays is a KINEMATIC choice (this module). It is NEVER
  driven by the acoustic classifier, which only decides presence / how many.
- The mandatory representativeness label travels on the manifest
  (`manifest.representativeness`) and is re-exposed via `ethogram.representativeness`.

## Derivation (offline)

`modeling/acoustic/derive_srkw_clips.py` reads
`web/public/orca/motion/orca_srkw_oo14_driver.bin` (measured, CC-BY-4.0) and
writes the small manifest (in git). It scores candidate windows by kinematic
fingerprint and emits a class only when a real SRKW window matches the
signature; Surface_Active (7) and Vertical_loop (9) are guarded so a class is
never a mislabeled fallback window. Large derived motion stays in the driver bin
(box-bound elsewhere); only the KB-scale manifest ships in the repo.

## Consumers

`ethogram.ts` is consumed by `web/lib/scene/reenactment/spawnFromClassification.ts`
(per-instance clip assignment) and re-exported from the reenactment barrel.
