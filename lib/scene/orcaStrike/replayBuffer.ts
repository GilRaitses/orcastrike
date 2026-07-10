// STRIKE-W2d — 5 s ring buffer @ 30 Hz for breach slow-mo replay (W1d).

import type { PilotMode, ReplayEuler, ReplaySample, ReplayVec3 } from "./types";
import {
  REPLAY_BUFFER_CAPACITY,
  REPLAY_BUFFER_DURATION_S,
  REPLAY_BUFFER_HZ,
} from "./types";

export { REPLAY_BUFFER_CAPACITY, REPLAY_BUFFER_DURATION_S, REPLAY_BUFFER_HZ };

export interface ReplayBufferPushInput {
  t: number;
  position: ReplayVec3;
  rotation: ReplayEuler;
  mode: PilotMode;
  charge?: number;
}

export interface ReplayWindow {
  /** Oldest sample time in the window. */
  startT: number;
  /** Newest sample time in the window. */
  endT: number;
  samples: readonly ReplaySample[];
}

export interface ReplayBuffer {
  push(input: ReplayBufferPushInput): void;
  /** Most recent sample, or null if empty. */
  latest(): ReplaySample | null;
  /** All samples with `t >= nowT - durationS`. */
  getWindow(nowT: number, durationS?: number): ReplayWindow;
  /** Sample count currently stored. */
  size(): number;
  clear(): void;
}

export interface ReplayBufferOptions {
  durationS?: number;
  hz?: number;
}

export function createReplayBuffer(opts: ReplayBufferOptions = {}): ReplayBuffer {
  const durationS = opts.durationS ?? REPLAY_BUFFER_DURATION_S;
  const hz = opts.hz ?? REPLAY_BUFFER_HZ;
  const capacity = Math.ceil(durationS * hz);
  const samples: ReplaySample[] = [];
  let lastPushT = -Infinity;
  const minInterval = 1 / hz;

  function push(input: ReplayBufferPushInput): void {
    if (input.t - lastPushT < minInterval * 0.5 && samples.length > 0) {
      samples[samples.length - 1] = {
        t: input.t,
        position: { ...input.position },
        rotation: { ...input.rotation },
        mode: input.mode,
        charge: input.charge ?? samples[samples.length - 1].charge,
      };
      lastPushT = input.t;
      trim(input.t);
      return;
    }

    samples.push({
      t: input.t,
      position: { ...input.position },
      rotation: { ...input.rotation },
      mode: input.mode,
      charge: input.charge ?? 0,
    });
    lastPushT = input.t;
    trim(input.t);
  }

  function trim(nowT: number): void {
    const cutoff = nowT - durationS;
    while (samples.length > capacity) {
      samples.shift();
    }
    while (samples.length > 0 && samples[0].t < cutoff) {
      samples.shift();
    }
  }

  return {
    push,
    latest(): ReplaySample | null {
      return samples.length > 0 ? samples[samples.length - 1] : null;
    },
    getWindow(nowT: number, windowDurationS = durationS): ReplayWindow {
      const cutoff = nowT - windowDurationS;
      const windowSamples = samples.filter((s) => s.t >= cutoff && s.t <= nowT);
      if (windowSamples.length === 0) {
        return { startT: nowT, endT: nowT, samples: [] };
      }
      return {
        startT: windowSamples[0].t,
        endT: windowSamples[windowSamples.length - 1].t,
        samples: windowSamples,
      };
    },
    size(): number {
      return samples.length;
    },
    clear(): void {
      samples.length = 0;
      lastPushT = -Infinity;
    },
  };
}

/** Interpolate position/rotation between two samples at `t` (pure). */
export function interpolateReplaySample(
  a: ReplaySample,
  b: ReplaySample,
  t: number,
): ReplaySample {
  if (a.t === b.t) return { ...a, t };
  const u = clamp01((t - a.t) / (b.t - a.t));
  return {
    t,
    position: {
      x: lerp(a.position.x, b.position.x, u),
      y: lerp(a.position.y, b.position.y, u),
      z: lerp(a.position.z, b.position.z, u),
    },
    rotation: {
      x: lerp(a.rotation.x, b.rotation.x, u),
      y: lerpAngle(a.rotation.y, b.rotation.y, u),
      z: lerp(a.rotation.z, b.rotation.z, u),
    },
    mode: u < 0.5 ? a.mode : b.mode,
    charge: lerp(a.charge, b.charge, u),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let delta = b - a;
  const twoPi = Math.PI * 2;
  while (delta > Math.PI) delta -= twoPi;
  while (delta < -Math.PI) delta += twoPi;
  return a + delta * t;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
