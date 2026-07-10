// STRIKE-W2d — slow-mo orbit replay camera (W1d: 3 s, 0.35×, 120° orbit).

import * as THREE from "three";
import type { ReplaySample } from "../types";
import { interpolateReplaySample } from "../replayBuffer";

export interface ReplayCameraOptions {
  /** Real-time playback duration, seconds. */
  playbackDurationS?: number;
  /** Orbit radius around splash anchor, world units. */
  orbitRadius?: number;
  /** Eye height above anchor Y. */
  orbitHeight?: number;
  /** Total orbit sweep, radians (W1d: 120°). */
  orbitSweepRad?: number;
  positionSmoothing?: number;
}

export interface ReplayCamera {
  /** Begin replay orbit at splash anchor using buffer window. */
  start(anchor: THREE.Vector3, samples: readonly ReplaySample[], startSceneT: number): void;
  stop(): void;
  isPlaying(): boolean;
  /** 0–1 normalized replay progress. */
  progress(): number;
  update(camera: THREE.Camera, sceneElapsedS: number, dt: number): void;
}

const DEFAULT_PLAYBACK_DURATION_S = 3.0;
const DEFAULT_ORBIT_RADIUS = 14;
const DEFAULT_ORBIT_HEIGHT = 3;
const DEFAULT_ORBIT_SWEEP_RAD = (120 * Math.PI) / 180;
const DEFAULT_POSITION_SMOOTHING = 8;

export function createReplayCamera(opts: ReplayCameraOptions = {}): ReplayCamera {
  const playbackDurationS = opts.playbackDurationS ?? DEFAULT_PLAYBACK_DURATION_S;
  const orbitRadius = opts.orbitRadius ?? DEFAULT_ORBIT_RADIUS;
  const orbitHeight = opts.orbitHeight ?? DEFAULT_ORBIT_HEIGHT;
  const orbitSweepRad = opts.orbitSweepRad ?? DEFAULT_ORBIT_SWEEP_RAD;
  const positionSmoothing = opts.positionSmoothing ?? DEFAULT_POSITION_SMOOTHING;

  const anchor = new THREE.Vector3();
  const desiredEye = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let playing = false;
  let playStartSceneT = 0;
  let progress01 = 0;
  let samples: readonly ReplaySample[] = [];

  return {
    start(anchorPos, replaySamples, startSceneT) {
      anchor.copy(anchorPos);
      samples = replaySamples;
      playStartSceneT = startSceneT;
      playing = true;
      progress01 = 0;
    },
    stop() {
      playing = false;
      progress01 = 0;
      samples = [];
    },
    isPlaying() {
      return playing;
    },
    progress() {
      return progress01;
    },
    update(camera, sceneElapsedS, dtRaw) {
      const dt = Number.isFinite(dtRaw) && dtRaw > 0 ? dtRaw : 0;
      if (!playing) return;

      const elapsed = sceneElapsedS - playStartSceneT;
      progress01 = clamp01(elapsed / playbackDurationS);
      if (progress01 >= 1) {
        playing = false;
        return;
      }

      const orbitAngle = progress01 * orbitSweepRad;
      desiredEye.set(
        anchor.x + Math.cos(orbitAngle) * orbitRadius,
        anchor.y + orbitHeight,
        anchor.z + Math.sin(orbitAngle) * orbitRadius,
      );

      const tPos = 1 - Math.exp(-positionSmoothing * dt);
      camera.position.lerp(desiredEye, tPos);

      const lookSample = sampleAtReplayTime(samples, sceneElapsedS - elapsed * 0.35);
      lookTarget.set(
        lookSample?.position.x ?? anchor.x,
        (lookSample?.position.y ?? anchor.y) + 1.2,
        lookSample?.position.z ?? anchor.z,
      );
      camera.lookAt(lookTarget);
    },
  };
}

/** Pick interpolated replay pose at scene time (pure helper for ghost mesh). */
export function sampleAtReplayTime(
  samples: readonly ReplaySample[],
  t: number,
): ReplaySample | null {
  if (samples.length === 0) return null;
  if (t <= samples[0].t) return samples[0];
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (t >= a.t && t <= b.t) {
      return interpolateReplaySample(a, b, t);
    }
  }
  return samples[samples.length - 1];
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export const REPLAY_CAMERA_PLAYBACK_DURATION_S = DEFAULT_PLAYBACK_DURATION_S;
export const REPLAY_TIME_SCALE = 0.35;
