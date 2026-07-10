// STRIKE-W3d — blowhole charge, squirt cone hitbox vs kayaks (W1d).

import { aabbOverlap, type KayakHitbox, type Vec3 } from "./breach";

export const BLOWHOLE_CHARGE_PER_TAP = 0.22;
export const BLOWHOLE_CHARGE_DECAY_PER_S = 0.15;
export const BLOWHOLE_FIRE_THRESHOLD = 1.0;
export const BLOWHOLE_SQUIRT_DURATION_S = 0.45;
export const BLOWHOLE_CONE_HALF_ANGLE_RAD = (18 * Math.PI) / 180;
export const BLOWHOLE_CONE_RANGE_M = 12;
export const BLOWHOLE_AXIS_SEGMENT_TOLERANCE_M = 0.8;

export interface BlowholeSquirtOrigin {
  x: number;
  y: number;
  z: number;
  /** World yaw radians (orca heading). */
  headingRad: number;
}

export function tickBlowholeCharge(
  charge: number,
  blowholeTap: boolean,
  dt: number,
  inChargeMode: boolean,
): number {
  let next = charge;
  if (blowholeTap) {
    next = Math.min(1, next + BLOWHOLE_CHARGE_PER_TAP);
  }
  if (inChargeMode || next > 0) {
    next = Math.max(0, next - BLOWHOLE_CHARGE_DECAY_PER_S * dt);
  }
  return next;
}

export function canFireBlowhole(
  blowholeTap: boolean,
  charge: number,
  depthM: number,
  surfaceGateM: number,
): boolean {
  return blowholeTap && charge >= BLOWHOLE_FIRE_THRESHOLD && depthM <= surfaceGateM;
}

/** Rostrum-forward +30° pitch up from surface heading. */
export function computeSquirtAxis(headingRad: number): Vec3 {
  const pitchUp = (30 * Math.PI) / 180;
  const forwardX = Math.cos(headingRad);
  const forwardZ = -Math.sin(headingRad);
  return normalize({
    x: forwardX * Math.cos(pitchUp),
    y: Math.sin(pitchUp),
    z: forwardZ * Math.cos(pitchUp),
  });
}

export function computeSquirtOrigin(
  rootPos: Vec3,
  headingRad: number,
): BlowholeSquirtOrigin {
  const forwardX = Math.cos(headingRad);
  const forwardZ = -Math.sin(headingRad);
  return {
    x: rootPos.x + forwardX * 1.5,
    y: rootPos.y + 1.8,
    z: rootPos.z + forwardZ * 1.5,
    headingRad,
  };
}

export function checkSquirtConeHits(
  origin: BlowholeSquirtOrigin,
  kayaks: readonly KayakHitbox[],
): string[] {
  const axis = computeSquirtAxis(origin.headingRad);
  const hits: string[] = [];
  for (const kayak of kayaks) {
    const target: Vec3 = { x: kayak.x, y: 0.25, z: kayak.z };
    if (pointInSquirtCone({ x: origin.x, y: origin.y, z: origin.z }, axis, target)) {
      hits.push(kayak.id);
    }
  }
  return hits;
}

export function pointInSquirtCone(origin: Vec3, axis: Vec3, target: Vec3): boolean {
  const ox = target.x - origin.x;
  const oy = target.y - origin.y;
  const oz = target.z - origin.z;
  const dist = Math.hypot(ox, oy, oz);
  if (dist > BLOWHOLE_CONE_RANGE_M || dist < 1e-3) return false;

  const nx = ox / dist;
  const ny = oy / dist;
  const nz = oz / dist;
  const dot = nx * axis.x + ny * axis.y + nz * axis.z;
  const angle = Math.acos(clamp(dot, -1, 1));
  if (angle <= BLOWHOLE_CONE_HALF_ANGLE_RAD) return true;

  return distanceToAxisSegment(origin, axis, target, BLOWHOLE_CONE_RANGE_M) <= BLOWHOLE_AXIS_SEGMENT_TOLERANCE_M;
}

function distanceToAxisSegment(origin: Vec3, axis: Vec3, target: Vec3, range: number): number {
  const apx = target.x - origin.x;
  const apy = target.y - origin.y;
  const apz = target.z - origin.z;
  const t = clamp(apx * axis.x + apy * axis.y + apz * axis.z, 0, range);
  const cx = origin.x + axis.x * t;
  const cy = origin.y + axis.y * t;
  const cz = origin.z + axis.z * t;
  return Math.hypot(target.x - cx, target.y - cy, target.z - cz);
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-6) return { x: 0, y: 1, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Broad-phase AABB for squirt VFX placement. */
export function squirtAabbAtOrigin(origin: BlowholeSquirtOrigin): {
  center: Vec3;
  half: { x: number; y: number; z: number };
} {
  const axis = computeSquirtAxis(origin.headingRad);
  const center = {
    x: origin.x + axis.x * (BLOWHOLE_CONE_RANGE_M * 0.5),
    y: origin.y + axis.y * (BLOWHOLE_CONE_RANGE_M * 0.5),
    z: origin.z + axis.z * (BLOWHOLE_CONE_RANGE_M * 0.5),
  };
  const half = { x: 2, y: 3, z: 2 };
  return { center, half };
}

export function checkSquirtKayakAabb(
  origin: BlowholeSquirtOrigin,
  kayaks: readonly KayakHitbox[],
): string[] {
  const { center, half } = squirtAabbAtOrigin(origin);
  const hits: string[] = [];
  for (const kayak of kayaks) {
    const kCenter = { x: kayak.x, y: 0.25, z: kayak.z };
    if (aabbOverlap(center, half, kCenter, { x: 1, y: 0.6, z: 0.5 })) {
      if (!hits.includes(kayak.id)) hits.push(kayak.id);
    }
  }
  return hits;
}
