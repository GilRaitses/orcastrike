// OPHYS tolerance + stability harness (OPHYS-R section 2/3 made checkable).
//
// Proves: (1) every secondary output stays within its clamp; (2) the fluke-beat
// RATE is never altered by OPHYS (the layer outputs only spine/bank/caudal-lag,
// no phase term); (3) frame-rate independence: the spine-follow trajectory at
// 30/60/120 fps converges within a small epsilon thanks to the fixed 120 Hz
// accumulator. The OG-authoritative axes (yaw/pitch/roll/depth) have ZERO
// deviation by construction, because OPHYS never writes the root transform - it
// only emits the bounded bone-local offsets asserted here.
//
// Driven by the REAL SRKW driver bin when present (web/public/orca/motion/
// orca_srkw_oo14_driver.bin, box-bound), else the committed simulated dev track.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { makeSecondaryDynamics, DEFAULT_CONFIG } from "./secondaryDynamics.ts";

const DEG = Math.PI / 180;
const LIMITS = {
  spineFlexMax: 8 * DEG,
  bankMax: 10 * DEG,
  flukeJointMax: 11 * DEG,
  caudalLagMax: 15 * DEG,
};
const CH = 7;

function here(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function loadTrack(): { yaw: number[]; phase: number[]; amp: number[]; rate: number; label: string } {
  const motionDir = resolve(here(), "../../../../public/orca/motion");
  const real = resolve(motionDir, "orca_srkw_oo14_driver.bin");
  const sim = resolve(motionDir, "orca_dev_track.bin");
  const path = existsSync(real) ? real : sim;
  const label = existsSync(real) ? "REAL SRKW driver" : "SIMULATED dev track";
  const rate = path === real ? 25 : 50;
  const buf = readFileSync(path);
  const data = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  const n = Math.floor(data.length / CH);
  const yaw: number[] = [], phase: number[] = [], amp: number[] = [];
  for (let i = 0; i < n; i++) {
    yaw.push(data[i * CH + 1]);
    phase.push(data[i * CH + 5]);
    amp.push(data[i * CH + 6]);
  }
  return { yaw, phase, amp, rate, label };
}

function makeDyn() {
  return makeSecondaryDynamics({ ...DEFAULT_CONFIG, nCaudal: 5 }, LIMITS);
}

// Resample a per-sample track to a fixed render rate, returning yawRate + phase.
function* renderStream(track: ReturnType<typeof loadTrack>, fps: number, seconds: number) {
  const dt = 1 / fps;
  let prevYaw = track.yaw[0];
  const total = Math.min(seconds, track.yaw.length / track.rate);
  for (let t = 0; t < total; t += dt) {
    const f = t * track.rate;
    const i0 = Math.min(track.yaw.length - 1, Math.floor(f));
    const a = f - i0;
    const i1 = Math.min(track.yaw.length - 1, i0 + 1);
    const lerpA = (x: number, y: number) => {
      let d = y - x;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return x + d * a;
    };
    const yaw = lerpA(track.yaw[i0], track.yaw[i1]);
    const phase = lerpA(track.phase[i0], track.phase[i1]);
    const amp = track.amp[i0] + (track.amp[i1] - track.amp[i0]) * a;
    let yr = (yaw - prevYaw) / dt;
    while (yr > Math.PI / dt) yr -= (2 * Math.PI) / dt;
    prevYaw = yaw;
    yield { t, dt, yawRate: yr, phase, amp };
  }
}

test("OPHYS secondary motion stays within every clamp", () => {
  const track = loadTrack();
  const dyn = makeDyn();
  let maxSpine = 0, maxBank = 0, maxLag = 0;
  for (const s of renderStream(track, 60, 200)) {
    const o = dyn.step(s.yawRate, s.phase, s.amp, s.dt);
    maxSpine = Math.max(maxSpine, Math.abs(o.spineYaw));
    maxBank = Math.max(maxBank, Math.abs(o.bankRoll));
    for (const c of o.caudalFollow) maxLag = Math.max(maxLag, Math.abs(c));
    assert.ok(Number.isFinite(o.spineYaw) && Number.isFinite(o.bankRoll));
  }
  console.log(
    `[OPHYS] track=${track.label} maxSpine=${(maxSpine / DEG).toFixed(2)}deg ` +
      `maxBank=${(maxBank / DEG).toFixed(2)}deg maxCaudalLag=${(maxLag / DEG).toFixed(2)}deg`,
  );
  assert.ok(maxSpine <= LIMITS.spineFlexMax + 1e-9, "spine within 8 deg");
  assert.ok(maxBank <= LIMITS.bankMax + 1e-9, "bank within 10 deg");
  assert.ok(maxLag <= LIMITS.caudalLagMax + 1e-9, "caudal lag within 15 deg");
});

test("OPHYS is frame-rate independent (30/60/120 fps converge)", () => {
  const track = loadTrack();
  const seconds = 60;
  // Sample each rate's spineYaw at 1 s marks and compare.
  function trajectory(fps: number): Map<number, number> {
    const dyn = makeDyn();
    const m = new Map<number, number>();
    let nextMark = 1;
    for (const s of renderStream(track, fps, seconds)) {
      const o = dyn.step(s.yawRate, s.phase, s.amp, s.dt);
      if (s.t >= nextMark) {
        m.set(nextMark, o.spineYaw);
        nextMark += 1;
      }
    }
    return m;
  }
  const a = trajectory(30), b = trajectory(60), c = trajectory(120);
  let maxDiff = 0;
  for (const [k, va] of a) {
    if (b.has(k) && c.has(k)) {
      maxDiff = Math.max(maxDiff, Math.abs(va - b.get(k)!), Math.abs(va - c.get(k)!), Math.abs(b.get(k)! - c.get(k)!));
    }
  }
  console.log(`[OPHYS] frame-rate spineYaw max divergence = ${(maxDiff / DEG).toFixed(3)} deg`);
  assert.ok(maxDiff < 1.5 * DEG, "frame-rate divergence < 1.5 deg");
});

test("OPHYS never alters the fluke-beat RATE (no phase output)", () => {
  // The layer's output contract carries spineYaw, bankRoll, caudalFollow only -
  // no phase or rate. The fluke RATE is OG's; OPHYS adds only a bounded lag.
  const dyn = makeDyn();
  const o = dyn.step(0.3, 1.234, 0.8, 1 / 60);
  assert.deepEqual(Object.keys(o).sort(), ["bankRoll", "caudalFollow", "spineYaw"]);
});
