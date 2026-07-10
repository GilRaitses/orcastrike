// HUNT-W2 Agent A - dead-reckoning position/pose integrator for the
// player-piloted orca (locked decision 5, wavves/lanes/20260709_orca-boat-hunt
// /waveset.md:125-132). Player input drives heading + speed -> dx/dz per
// frame, written directly onto `controllerRoot.position.x/z`; a `PilotTrack`
// (see PilotTrack.ts) reports the live computed pose (yaw/pitch/roll/depthM/
// flukePhase/flukeAmp) so `OrcaController.update()` -> `driveOrca` keeps
// authoritative ownership of orientation, depth, and fluke animation exactly
// as it does for a baked biologging track. This module never calls
// `rig.setOrientation`/`setDepthPose`/`setFluke` directly and never touches
// `controllerRoot.position.y` (depth stays owned by `driveOrca`, fed by
// `pose.depthM` from `sample()`).

import type * as THREE from "three";
import type { BiologgingTrack, OrcaPose } from "../orca/motion/biologging";
import { createPilotTrack } from "./PilotTrack";
import type { OrcaPilotInput } from "./input";

// --- tunable constants (documented; the WIRING note restates these) -------

/** Sustained cruise speed, m/s. Order of magnitude of an orca's normal swim
 * speed (a few m/s), not a measured value. */
const CRUISE_SPEED_MPS = 2.2;
/** Boosted top speed (Shift held), m/s. A fast burst, still bounded to a
 * plausible sprint order of magnitude. */
const BOOST_SPEED_MPS = 5.5;
/** Max reverse speed, m/s. Slower than cruise, arcade-reasonable. */
const REVERSE_SPEED_MPS = 1.2;
/** Forward/back acceleration toward the desired speed, m/s^2. */
const ACCEL_MPS2 = 3.0;
/** Deceleration toward the desired speed when braking/coasting, m/s^2.
 * Higher than ACCEL so releasing the throttle feels responsive. */
const DAMPING_MPS2 = 4.5;

/** Additive yaw rate from the left/right keys, on top of mouse yaw, rad/s.
 * Chosen semantics: left/right are a turn-rate ASSIST, not a strafe, so the
 * orca always moves along its own heading (no lateral slide). */
const EXTRA_TURN_RATE_RADPS = 1.4;

/** Bounded cosmetic dive/climb pitch from mouse pitchDelta, radians. */
const MAX_PITCH_RAD = (20 * Math.PI) / 180;
/** Bounded cosmetic bank roll proportional to turn rate, radians. */
const MAX_ROLL_RAD = (15 * Math.PI) / 180;
/** Per-second spring-back rate that relaxes pitch toward level when the
 * player stops looking up/down (exponential decay constant, 1/s). Lower =
 * dive/climb attitude holds longer after a key press. */
const PITCH_RETURN_RATE = 0.6;
/** Bank roll gain: radians of roll per (rad/s) of total turn rate, clamped to
 * MAX_ROLL_RAD. */
const BANK_GAIN = 0.35;

/** Dive/climb rate at max pitch angle, m/s. Depth changes proportionally to
 * how far the pitch is pushed from level. */
const DIVE_CLIMB_RATE_MPS = 3.0;
/** Fallback safe depth band (metres below the surface) used when no seabed
 * probe is supplied, or the probe returns null (e.g. tiles not streamed at
 * this XZ yet). Keeps the module usable standalone in a flat-plane fallback
 * scene with no bathymetry wired in. */
const DEFAULT_SPAWN_DEPTH_M = 8;
const DEFAULT_MIN_DEPTH_M = 0;
const DEFAULT_MAX_DEPTH_M = 25;

/** Fluke beat rate range, Hz, interpolated by speed fraction. Kept in the
 * same order of magnitude as the real SRKW driver's corrected fluke band
 * (~0.2-0.35 Hz; see web/lib/scene/orca/motion/biologging.ts header) so the
 * player-piloted gait reads consistently with the biologging-driven orca. */
const FLUKE_HZ_AT_IDLE = 0.15;
const FLUKE_HZ_AT_BOOST = 0.6;

/** Optional seabed clearance probe. Given a world XZ position, returns the
 * maximum safe `depthM` (metres below the surface) at that location, i.e. the
 * seabed floor minus a safety margin, so `depthM` is clamped to stay above
 * the seabed there. Returns null when no data is available at that point
 * (e.g. bathymetry tiles not streamed in yet), in which case this module
 * falls back to `DEFAULT_MAX_DEPTH_M`. A future integrator supplies this by
 * wrapping the tiles probe's `getSurfaceY(worldX, worldZ)` (see
 * web/lib/scene/camera/director.ts's `CameraDirectorHandle.getSurfaceY` for
 * the probe shape it reuses) and converting the probed elevation to metres.
 * This module has NO import from `web/lib/scene/tiles/` or `bathymetry` code;
 * that conversion is entirely the integrator's responsibility, keeping
 * `orcaPilot/` disjoint from the tiles directory per the lane charter. */
export type GetSeabedClearanceM = (worldX: number, worldZ: number) => number | null;

export interface OrcaPilotOptions {
  /** World units per metre, for converting m/s speeds and m depth into scene
   * units. Defaults to 1 so the module degrades gracefully in a flat-plane
   * fallback scene with no explicit metric scale. */
  worldUnitsPerMeter?: number;
  /** Optional seabed clearance probe, see `GetSeabedClearanceM`. */
  getSeabedClearanceM?: GetSeabedClearanceM;
  /** Initial heading, radians. Defaults to 0. */
  initialHeading?: number;
  /** Starting depth below the surface in metres. Default 8 (submerged spawn). */
  initialDepthM?: number;
}

export interface OrcaPilot {
  /** `BiologgingTrack`-shaped live pose source. Pass as `track` to
   * `createOrcaController({ track: pilot.track, ... })`. */
  track: BiologgingTrack;
  /**
   * Advance one frame: integrate heading/speed/pitch/roll/depth/fluke from
   * `input`, then write the resulting XZ directly onto
   * `controllerRoot.position`. Call once per frame, BEFORE
   * `controller.update(dt, elapsed, cameraWorldPos)` so the pose driven this
   * frame is the one `driveOrca` consumes. Never writes `.y`.
   */
  update(input: OrcaPilotInput, dt: number, controllerRoot: THREE.Group): void;
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Create a stateful player-piloted dead-reckoning integrator. The returned
 * `track` starts at the pose the integrator initializes with (heading 0 or
 * `opts.initialHeading`, speed 0, depth `DEFAULT_MIN_DEPTH_M`) until the
 * first `update()` call.
 */
export function createOrcaPilot(opts: OrcaPilotOptions = {}): OrcaPilot {
  const wupmDefault = opts.worldUnitsPerMeter ?? 1;
  const getSeabedClearanceM = opts.getSeabedClearanceM;

  let heading = opts.initialHeading ?? 0;
  let speedMps = 0;
  let pitch = 0;
  let roll = 0;
  let depthM = opts.initialDepthM ?? DEFAULT_SPAWN_DEPTH_M;
  let flukePhase = 0;
  let flukeAmp = 0;

  const pose: OrcaPose = { yaw: heading, pitch, roll, depthM, flukePhase, flukeAmp };

  const track = createPilotTrack(() => pose);

  function update(input: OrcaPilotInput, dtRaw: number, controllerRoot: THREE.Group): void {
    const dt = Number.isFinite(dtRaw) && dtRaw > 0 ? dtRaw : 0;
    const wupm = wupmDefault > 0 ? wupmDefault : 1;

    // --- heading: mouse yaw delta (already "since last frame") plus an
    // additive turn-rate assist from the left/right keys. ---
    const turnInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const extraTurnRate = turnInput * EXTRA_TURN_RATE_RADPS;
    heading += input.yawDelta + extraTurnRate * dt;

    // --- speed: accelerate/brake toward the desired speed for the held keys. ---
    let desiredSpeed = 0;
    if (input.forward) desiredSpeed = input.boost ? BOOST_SPEED_MPS : CRUISE_SPEED_MPS;
    else if (input.back) desiredSpeed = -REVERSE_SPEED_MPS;
    const rate = Math.abs(desiredSpeed) > Math.abs(speedMps) ? ACCEL_MPS2 : DAMPING_MPS2;
    speedMps = moveToward(speedMps, desiredSpeed, rate * dt);

    // --- position: forward vector matches the rig's own yaw convention
    // (OrcaRig.setOrientation -> outer.rotateY(yaw) applied to local +X), so
    // world forward at yaw=heading is (cos(heading), 0, -sin(heading)). ---
    const speedWorldPerSec = speedMps * wupm;
    const fx = Math.cos(heading);
    const fz = -Math.sin(heading);
    controllerRoot.position.x += fx * speedWorldPerSec * dt;
    controllerRoot.position.z += fz * speedWorldPerSec * dt;

    // --- pitch: mouse pitchDelta accumulates a bounded dive/climb angle that
    // springs back toward level when the player stops looking up/down. ---
    pitch = clamp(pitch + input.pitchDelta, -MAX_PITCH_RAD, MAX_PITCH_RAD);
    pitch -= pitch * Math.min(1, PITCH_RETURN_RATE * dt);

    // --- roll: bounded bank lean proportional to the CURRENT total turn
    // rate (mouse yaw rate + the extra turn-key rate), not integrated. ---
    const totalTurnRate = (dt > 1e-6 ? input.yawDelta / dt : 0) + extraTurnRate;
    roll = clamp(-totalTurnRate * BANK_GAIN, -MAX_ROLL_RAD, MAX_ROLL_RAD);

    // --- depth: pitch drives a dive/climb rate; clamped to the seabed
    // clearance probe when supplied, else the fixed default safe band. ---
    const diveRate = -(pitch / MAX_PITCH_RAD) * DIVE_CLIMB_RATE_MPS;
    depthM += diveRate * dt;
    let maxDepthM = DEFAULT_MAX_DEPTH_M;
    if (getSeabedClearanceM) {
      const clearance = getSeabedClearanceM(controllerRoot.position.x, controllerRoot.position.z);
      if (typeof clearance === "number" && Number.isFinite(clearance)) maxDepthM = clearance;
    }
    depthM = clamp(depthM, DEFAULT_MIN_DEPTH_M, Math.max(DEFAULT_MIN_DEPTH_M, maxDepthM));

    // --- fluke: beat rate scales with speed fraction of top boosted speed;
    // amplitude tracks throttle intensity (idle -> 0, full boost -> 1). ---
    const speedFraction = clamp(Math.abs(speedMps) / BOOST_SPEED_MPS, 0, 1);
    const flukeHz = FLUKE_HZ_AT_IDLE + (FLUKE_HZ_AT_BOOST - FLUKE_HZ_AT_IDLE) * speedFraction;
    flukePhase = (flukePhase + flukeHz * 2 * Math.PI * dt) % (2 * Math.PI);
    flukeAmp = speedFraction;

    pose.yaw = heading;
    pose.pitch = pitch;
    pose.roll = roll;
    pose.depthM = depthM;
    pose.flukePhase = flukePhase;
    pose.flukeAmp = flukeAmp;
  }

  return { track, update };
}
