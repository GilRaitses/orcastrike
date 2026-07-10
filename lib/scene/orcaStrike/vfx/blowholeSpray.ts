// STRIKE-W2c — blowhole spray VFX stub. Pure spec factory for W3d squirt cone.

export interface BlowholeSpraySpec {
  id: string;
  origin: { x: number; y: number; z: number };
  /** Unit direction of spray axis (rostrum forward + pitch up). */
  direction: { x: number; y: number; z: number };
  /** Full cone half-angle, radians (W1d: 18°). */
  halfAngleRad: number;
  /** Max range, metres (W1d: 12 m). */
  rangeM: number;
  durationS: number;
  startTimeS: number;
  intensity: number;
  particleCount: number;
}

export interface BlowholeSprayTriggerOpts {
  origin: { x: number; y: number; z: number };
  /** Orca heading, radians (same convention as deadReckoning). */
  headingRad: number;
  /** Head pitch above horizontal, radians. W1d default +30°. */
  pitchRad?: number;
  sceneElapsedS: number;
  intensity?: number;
  id?: string;
}

const DEFAULT_HALF_ANGLE_RAD = (18 * Math.PI) / 180;
const DEFAULT_RANGE_M = 12;
const DEFAULT_SQUIRT_DURATION_S = 0.45;
const DEFAULT_PITCH_RAD = (30 * Math.PI) / 180;

let sprayCounter = 0;

/**
 * Build a squirt cone spec from orca pose. Scene attaches particles/audio in W3.
 */
export function triggerBlowholeSpray(opts: BlowholeSprayTriggerOpts): BlowholeSpraySpec {
  const pitchRad = opts.pitchRad ?? DEFAULT_PITCH_RAD;
  const intensity = clamp01(opts.intensity ?? 1);
  const heading = opts.headingRad;

  const fx = Math.cos(heading);
  const fz = -Math.sin(heading);
  const dirX = fx * Math.cos(pitchRad);
  const dirY = Math.sin(pitchRad);
  const dirZ = fz * Math.cos(pitchRad);
  const len = Math.hypot(dirX, dirY, dirZ) || 1;

  return {
    id: opts.id ?? `blowhole-spray-${++sprayCounter}`,
    origin: { ...opts.origin },
    direction: { x: dirX / len, y: dirY / len, z: dirZ / len },
    halfAngleRad: DEFAULT_HALF_ANGLE_RAD,
    rangeM: DEFAULT_RANGE_M,
    durationS: DEFAULT_SQUIRT_DURATION_S,
    startTimeS: opts.sceneElapsedS,
    intensity,
    particleCount: Math.round(16 + intensity * 24),
  };
}

/** Spray strength 0–1 at scene time (pure). */
export function blowholeSprayStrengthAt(spec: BlowholeSpraySpec, sceneElapsedS: number): number {
  const age = sceneElapsedS - spec.startTimeS;
  if (age < 0 || age > spec.durationS) return 0;
  const t = age / spec.durationS;
  return spec.intensity * (1 - t * t);
}

export interface BlowholeSprayR3fProps {
  key: string;
  position: [number, number, number];
  rotation: [number, number, number];
  visible: boolean;
  opacity: number;
}

export function blowholeSprayToR3fProps(
  spec: BlowholeSpraySpec,
  sceneElapsedS: number,
): BlowholeSprayR3fProps {
  const strength = blowholeSprayStrengthAt(spec, sceneElapsedS);
  const yaw = Math.atan2(-spec.direction.z, spec.direction.x);
  const pitch = Math.asin(clamp(spec.direction.y, -1, 1));
  return {
    key: spec.id,
    position: [spec.origin.x, spec.origin.y, spec.origin.z],
    rotation: [pitch, yaw, 0],
    visible: strength > 0.01,
    opacity: strength,
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
