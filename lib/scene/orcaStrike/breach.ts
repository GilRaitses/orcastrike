// STRIKE-W3c — breach mash, launch impulse, air tricks, kayak overlap (W1d).

import type { PilotFsmState, PilotMode, StrikeControls, TrickSlotId } from "./types";

export const BREACH_CHARGE_PER_MASH = 0.12;
export const BREACH_CHARGE_DECAY_PER_S = 0.08;
export const BREACH_MIN_LAUNCH_CHARGE = 0.35;
export const BREACH_REENTRY_DEPTH_M = 0.05;
export const BREACH_MIN_CHARGE_DEPTH_M = 0.5;
export const BREACH_LAUNCH_VY_BASE = 4.5;
export const BREACH_LAUNCH_VY_CHARGE_SCALE = 3.5;
export const BREACH_CHARGE_CONSUME_FACTOR = 0.3;
export const BREACH_SURFACE_VELOCITY_MPS = 2.0;

export const ORCA_BREACH_AABB_HALF = { x: 4.0, y: 1.2, z: 2.0 };
export const KAYAK_AABB_HALF = { x: 1.0, y: 0.6, z: 0.5 };
export const KAYAK_AABB_CENTER_Y = 0.25;

export const TRICK_SLOT_POINTS: Record<TrickSlotId, number> = {
  t1: 100,
  t2: 100,
  t3: 150,
  t4: 200,
};

export const TRICK_SLOT_BITS: Record<TrickSlotId, number> = {
  t1: 1,
  t2: 2,
  t3: 4,
  t4: 8,
};

export interface KayakHitbox {
  id: string;
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BreachLaunchImpulse {
  verticalVelocityMps: number;
  horizontalSpeedScale: number;
  remainingCharge: number;
}

export interface BreachChargeTickResult {
  charge: number;
  noMashTimerS: number;
}

export interface BreachLandResult {
  triggerReplay: boolean;
  replayReason: string;
}

export function tickBreachCharge(
  charge: number,
  breachMash: boolean,
  dt: number,
): BreachChargeTickResult {
  let next = charge;
  let noMashTimerS = 0;
  if (breachMash) {
    next = Math.min(1, next + BREACH_CHARGE_PER_MASH);
    noMashTimerS = 0;
  } else {
    next = Math.max(0, next - BREACH_CHARGE_DECAY_PER_S * dt);
    noMashTimerS = dt;
  }
  return { charge: next, noMashTimerS };
}

export interface BreachLaunchGuardInput {
  depthM: number;
  verticalVelocityMps: number;
  depthRateMps: number;
  breachCharge: number;
  mode: PilotMode;
}

export function isBreachLaunchGuard(input: BreachLaunchGuardInput): boolean {
  if (
    input.mode === "breach_air" ||
    input.mode === "breach_land" ||
    input.mode === "blowhole_squirt"
  ) {
    return false;
  }
  if (input.breachCharge < BREACH_MIN_LAUNCH_CHARGE) return false;
  if (input.depthM > BREACH_REENTRY_DEPTH_M + 0.5) return false;

  const upwardDepthRate = -input.depthRateMps;
  const upwardVel = Math.max(input.verticalVelocityMps, upwardDepthRate);
  return upwardVel >= BREACH_SURFACE_VELOCITY_MPS;
}

export function computeBreachLaunchImpulse(
  breachCharge: number,
  horizontalSpeedMps: number,
): BreachLaunchImpulse {
  const vy = BREACH_LAUNCH_VY_BASE + breachCharge * BREACH_LAUNCH_VY_CHARGE_SCALE;
  return {
    verticalVelocityMps: vy,
    horizontalSpeedScale: 0.8,
    remainingCharge: breachCharge * BREACH_CHARGE_CONSUME_FACTOR,
  };
}

export function isBreachReentry(depthM: number): boolean {
  return depthM <= BREACH_REENTRY_DEPTH_M;
}

export function tickBreachLand(
  chargeAtLaunch: number,
  trickScored: boolean,
): BreachLandResult {
  if (chargeAtLaunch >= 0.5 || trickScored) {
    return { triggerReplay: true, replayReason: "breach_land_high_charge_or_trick" };
  }
  return { triggerReplay: false, replayReason: "skip_low_charge" };
}

/** Detect first valid trick input per air phase (W1c / W1d). */
export function detectBreachTrick(
  controls: StrikeControls,
  trickSlots: number,
): { slot: TrickSlotId; bit: number } | null {
  if ((trickSlots & TRICK_SLOT_BITS.t1) === 0 && controls.breachMash && controls.rollLeft) {
    return { slot: "t1", bit: TRICK_SLOT_BITS.t1 };
  }
  if ((trickSlots & TRICK_SLOT_BITS.t2) === 0 && controls.breachMash && controls.rollRight) {
    return { slot: "t2", bit: TRICK_SLOT_BITS.t2 };
  }
  if ((trickSlots & TRICK_SLOT_BITS.t3) === 0 && controls.breachMash && !controls.rollLeft && !controls.rollRight) {
    return { slot: "t3", bit: TRICK_SLOT_BITS.t3 };
  }
  if ((trickSlots & TRICK_SLOT_BITS.t4) === 0 && controls.forward) {
    return { slot: "t4", bit: TRICK_SLOT_BITS.t4 };
  }
  return null;
}

export function trickMotionOffsets(slot: TrickSlotId): { rollDeg: number; pitchDeg: number } {
  switch (slot) {
    case "t1":
      return { rollDeg: -45, pitchDeg: 0 };
    case "t2":
      return { rollDeg: 45, pitchDeg: 0 };
    case "t3":
      return { rollDeg: 0, pitchDeg: -30 };
    case "t4":
      return { rollDeg: 0, pitchDeg: 35 };
    default:
      return { rollDeg: 0, pitchDeg: 0 };
  }
}

/** AABB overlap in world metres (XZ + Y band). */
export function aabbOverlap(
  aCenter: Vec3,
  aHalf: { x: number; y: number; z: number },
  bCenter: Vec3,
  bHalf: { x: number; y: number; z: number },
): boolean {
  return (
    Math.abs(aCenter.x - bCenter.x) <= aHalf.x + bHalf.x &&
    Math.abs(aCenter.y - bCenter.y) <= aHalf.y + bHalf.y &&
    Math.abs(aCenter.z - bCenter.z) <= aHalf.z + bHalf.z
  );
}

/** Score hook: orca centroid vs kayak while in breach_air. */
export function checkBreachKayakOverlaps(
  orcaPos: Vec3,
  kayaks: readonly KayakHitbox[],
): string[] {
  const hits: string[] = [];
  for (const kayak of kayaks) {
    const kayakCenter = { x: kayak.x, y: KAYAK_AABB_CENTER_Y, z: kayak.z };
    if (aabbOverlap(orcaPos, ORCA_BREACH_AABB_HALF, kayakCenter, KAYAK_AABB_HALF)) {
      hits.push(kayak.id);
    }
  }
  return hits;
}

export interface DeckLandingInput {
  orcaPos: Vec3;
  orcaVy: number;
  depthM: number;
  boatX: number;
  boatZ: number;
  boatHeading: number;
}

const DECK_HALF_X = 1.4;
const DECK_HALF_Z = 0.5;
const DECK_Y_MIN = 0.2;
const DECK_Y_MAX = 1.4;

export function checkDeckLanding(input: DeckLandingInput): boolean {
  if (input.depthM > 0.3) return false;
  if (input.orcaVy > -0.5 && input.orcaVy < 0.5) {
    // allow gentle settle or breach_land entry
  } else if (input.orcaVy >= -0.5) {
    return false;
  }
  const dx = Math.abs(input.orcaPos.x - input.boatX);
  const dz = Math.abs(input.orcaPos.z - input.boatZ);
  if (dx > DECK_HALF_X || dz > DECK_HALF_Z) return false;
  const y = input.orcaPos.y;
  return y >= DECK_Y_MIN && y <= DECK_Y_MAX;
}

export interface BreachReplayHookInput {
  replayBufferSize: number;
  chargeAtLaunch: number;
  trickScored: boolean;
  sceneElapsedS: number;
}

/** W4 frame hook during breach_air: tricks + kayak overlap events. */
export interface BreachAirTickInput {
  controls: import("./types").StrikeControls;
  trickSlots: number;
  orcaPos: Vec3;
  kayaks: readonly KayakHitbox[];
}

export interface BreachAirTickResult {
  trickSlots: number;
  trickEvent: TrickSlotId | null;
  kayakHits: string[];
}

export function tickBreachAirFrame(input: BreachAirTickInput): BreachAirTickResult {
  let trickSlots = input.trickSlots;
  let trickEvent: TrickSlotId | null = null;
  const detected = detectBreachTrick(input.controls, trickSlots);
  if (detected) {
    trickSlots |= detected.bit;
    trickEvent = detected.slot;
  }
  const kayakHits =
    input.kayaks.length > 0 ? checkBreachKayakOverlaps(input.orcaPos, input.kayaks) : [];
  return { trickSlots, trickEvent, kayakHits };
}

/** Whether W4 should start replay camera after breach_land. */
export function shouldStartBreachReplay(input: BreachReplayHookInput): boolean {
  if (input.replayBufferSize < 2) return false;
  return input.chargeAtLaunch >= 0.5 || input.trickScored;
}
