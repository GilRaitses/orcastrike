// OG - biologging driver. Loads the offline-baked Float32 .bin + JSON manifest
// (Option B, SIGN_OFF decision 1) and drives the OrcaRig DOFs from the real
// per-sample channels, interpolated to the render frame so the swim is
// frame-rate independent.
//
// Channel order (locked, OG-PREBAKE_NOTES.md):
//   0 t_s | 1 body_yaw_rad | 2 body_pitch_rad | 3 body_roll_rad |
//   4 depth_m | 5 fluke_phase_rad | 6 fluke_amplitude
//
// HONESTY (hard line): the orca is driven by the REAL open SRKW DTAG
// (Tennessen et al. 2024, CC-BY 4.0; manifest simulated:false, role:driver).
// The humpback mn09_203a track is CONTRAST ONLY and never loaded here as a
// driver. A labeled simulated dev track stands in only when explicitly chosen.
// The fluke phase/amplitude are baked from the corrected ~0.2-0.35 Hz heave
// band (NOT the old 0.4-0.6 Hz); the per-segment dominant rate lives in the
// manifest `driver_stats.fluke_dsf` and is read, never hard-coded.

import * as THREE from "three";
import type { OrcaRig } from "../rig/OrcaRig";

export interface BiologgingManifest {
  simulated: boolean;
  species?: string;
  role?: string;
  bin_file: string;
  sample_rate_hz: number;
  n_samples: number;
  n_channels: number;
  duration_s: number;
  provenance?: string;
  license?: string;
  driver_stats?: {
    depth_range_m?: [number, number];
    roll_abs_p95_deg?: number;
    pitch_abs_p95_deg?: number;
    fluke_dsf?: { median_hz?: number; band_hz?: [number, number]; p25_hz?: number; p75_hz?: number };
  };
}

export interface OrcaPose {
  yaw: number;
  pitch: number;
  roll: number;
  depthM: number;
  flukePhase: number;
  flukeAmp: number;
}

export interface BiologgingTrack {
  manifest: BiologgingManifest;
  data: Float32Array;
  nSamples: number;
  nChannels: number;
  sampleRate: number;
  duration: number;
  /** Interpolated pose at time t (seconds), looping over the track. */
  sample(t: number): OrcaPose;
}

const CH = 7;

/** Load `<dir>/<name>.json` + its sibling `.bin`. */
export async function loadBiologging(jsonUrl: string): Promise<BiologgingTrack> {
  const manifest = (await (await fetch(jsonUrl)).json()) as BiologgingManifest;
  const base = jsonUrl.slice(0, jsonUrl.lastIndexOf("/") + 1);
  const binUrl = base + manifest.bin_file;
  const buf = await (await fetch(binUrl)).arrayBuffer();
  const data = new Float32Array(buf);

  const nChannels = manifest.n_channels ?? CH;
  const nSamples = manifest.n_samples ?? Math.floor(data.length / nChannels);
  const sampleRate = manifest.sample_rate_hz;
  const duration = manifest.duration_s ?? nSamples / sampleRate;

  if (data.length < nSamples * nChannels) {
    throw new Error(
      `biologging bin too short: ${data.length} < ${nSamples}*${nChannels}`,
    );
  }

  const pose: OrcaPose = { yaw: 0, pitch: 0, roll: 0, depthM: 0, flukePhase: 0, flukeAmp: 0 };

  function sample(t: number): OrcaPose {
    const tt = ((t % duration) + duration) % duration;
    const f = tt * sampleRate;
    const i0 = Math.min(nSamples - 1, Math.floor(f));
    const i1 = Math.min(nSamples - 1, i0 + 1);
    const a = f - i0;
    const b0 = i0 * nChannels;
    const b1 = i1 * nChannels;

    pose.yaw = lerpAngle(data[b0 + 1], data[b1 + 1], a);
    pose.pitch = lerp(data[b0 + 2], data[b1 + 2], a);
    pose.roll = lerpAngle(data[b0 + 3], data[b1 + 3], a);
    pose.depthM = lerp(data[b0 + 4], data[b1 + 4], a);
    pose.flukePhase = lerpPhase(data[b0 + 5], data[b1 + 5], a);
    pose.flukeAmp = lerp(data[b0 + 6], data[b1 + 6], a);
    return pose;
  }

  return { manifest, data, nSamples, nChannels, sampleRate, duration, sample };
}

/**
 * Apply a pose to the rig's PRIMARY (authoritative) DOFs. OPHYS layers on top
 * AFTER this; OEYE gaze composes last. worldUnitsPerMeter is read live from the
 * scene fit, never hard-coded.
 */
export function driveOrca(rig: OrcaRig, pose: OrcaPose, worldUnitsPerMeter: number): void {
  rig.setOrientation(pose.pitch, pose.roll, pose.yaw);
  rig.setDepthPose(pose.depthM, worldUnitsPerMeter);
  rig.setFluke(pose.flukePhase, pose.flukeAmp);
}

function lerp(x: number, y: number, t: number): number {
  return x + (y - x) * t;
}

/** Shortest-arc interpolation for heading/roll that may wrap +/-pi. */
function lerpAngle(x: number, y: number, t: number): number {
  let d = y - x;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return x + d * t;
}

/** Continuous phase interpolation across the [0,2pi) wrap. */
function lerpPhase(x: number, y: number, t: number): number {
  let d = y - x;
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  return x + d * t;
}
