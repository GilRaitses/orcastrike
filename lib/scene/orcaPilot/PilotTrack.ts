// HUNT-W2 Agent A - a `BiologgingTrack`-shaped live pose source.
//
// `OrcaController`'s `update()` only ever calls `track.sample(elapsed *
// timeScale)` (see web/lib/scene/orca/OrcaController.ts) and reads the
// returned `OrcaPose`. A `PilotTrack` structurally satisfies
// `BiologgingTrack` so it can be handed to `createOrcaController({ track })`
// unmodified, but every field except `sample()` is a harmless static stub:
// there is no baked manifest, no sample data, and no fixed duration for a
// live, input-driven pose.

import type { BiologgingManifest, BiologgingTrack, OrcaPose } from "../orca/motion/biologging";

const PILOT_MANIFEST: BiologgingManifest = {
  simulated: true,
  role: "player-piloted",
  bin_file: "",
  sample_rate_hz: 60,
  n_samples: 0,
  n_channels: 7,
  duration_s: Number.POSITIVE_INFINITY,
};

/**
 * Wrap a live pose getter as a `BiologgingTrack`. `sample(t)` ignores `t`
 * entirely and returns whatever `getPose()` returns at call time, so the
 * caller (the dead-reckoning integrator in `deadReckoning.ts`) owns advancing
 * the pose once per frame before `OrcaController.update()` samples it.
 */
export function createPilotTrack(getPose: () => OrcaPose): BiologgingTrack {
  return {
    manifest: PILOT_MANIFEST,
    data: new Float32Array(0),
    nSamples: 0,
    nChannels: 7,
    sampleRate: 60,
    duration: Number.POSITIVE_INFINITY,
    sample(_t: number): OrcaPose {
      return getPose();
    },
  };
}
