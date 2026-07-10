// OPHYS - bounded secondary dynamics layered on the OG telemetry pose.
//
// HARD LINE (charter + OPHYS-R section 2): position, depth, heading, pitch, roll,
// and the fluke-beat RATE are OG's and are written on the OUTER root by driveOrca.
// OPHYS NEVER touches the root transform and NEVER changes the fluke rate. It
// only produces BONE-LOCAL secondary motion, clamped to the rig limits:
//   - spine-follow bend (the body arcs into its heading instead of pivoting),
//   - banking lean derived from the OG yaw rate (consistent with roll),
//   - an under-damped caudal follow-through (phase lag, the lively whip).
//
// Because the root telemetry transform is untouched, the OG-authoritative axes
// have EXACTLY zero deviation by construction; the only secondary motion is the
// clamped bone flex below. Stability: second-order critically/under-damped
// springs integrated with a FIXED 120 Hz accumulator and a capped dt, so the
// behavior is identical across display rates and a stall injects no impulse.

export interface SpringCoeffs {
  /** Natural frequency, rad/s. */
  omega: number;
  /** Damping ratio (1 = critical, <1 = overshoot). */
  zeta: number;
}

export interface SecondaryLimits {
  spineFlexMax: number;
  bankMax: number;
  flukeJointMax: number;
  /** Max caudal follow-through phase lag, radians (OPHYS-R: <= 15 deg). */
  caudalLagMax: number;
}

export interface SecondaryConfig {
  nCaudal: number;
  spine: SpringCoeffs;
  bank: SpringCoeffs;
  caudal: SpringCoeffs;
  /** Gain mapping yaw rate (rad/s) -> spine-follow target (rad). */
  spineGain: number;
  /** Gain mapping yaw rate (rad/s) -> banking lean target (rad). */
  bankGain: number;
  /** Gain mapping caudal beat velocity -> trailing lag (s). */
  caudalLagGain: number;
}

export const DEFAULT_CONFIG: SecondaryConfig = {
  nCaudal: 5,
  spine: { omega: 4.0, zeta: 1.0 }, // critically damped (clean follow)
  bank: { omega: 4.0, zeta: 1.0 },
  caudal: { omega: 9.0, zeta: 0.7 }, // under-damped (whip)
  spineGain: 0.9,
  bankGain: 1.4,
  caudalLagGain: 0.08,
};

export interface SecondaryOutput {
  spineYaw: number;
  bankRoll: number;
  caudalFollow: number[];
}

interface Spring1D {
  x: number;
  v: number;
}

export interface SecondaryDynamics {
  /** Step with the OG yaw rate (rad/s) + the current fluke phase + amplitude. */
  step(yawRate: number, flukePhase: number, flukeAmp: number, dt: number): SecondaryOutput;
  /** Reset spring state (NaN guard / re-seed after a stall). */
  reset(): void;
  out: SecondaryOutput;
}

const FIXED_DT = 1 / 120;
const MAX_DT = 1 / 30;

function stepSpring1D(s: Spring1D, target: number, c: SpringCoeffs, dt: number): void {
  // Semi-implicit (symplectic) Euler: stable for these omega/zeta at <= 1/120 s.
  const a = c.omega * c.omega * (target - s.x) - 2 * c.zeta * c.omega * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

export function makeSecondaryDynamics(
  cfg: SecondaryConfig,
  limits: SecondaryLimits,
): SecondaryDynamics {
  const spine: Spring1D = { x: 0, v: 0 };
  const bank: Spring1D = { x: 0, v: 0 };
  const caudal: Spring1D[] = Array.from({ length: cfg.nCaudal }, () => ({ x: 0, v: 0 }));

  const out: SecondaryOutput = {
    spineYaw: 0,
    bankRoll: 0,
    caudalFollow: new Array(cfg.nCaudal).fill(0),
  };

  let accumulator = 0;
  let prevPhase = 0;
  let havePrev = false;

  function clamp(x: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, x));
  }
  function finite(x: number): boolean {
    return Number.isFinite(x);
  }

  return {
    out,
    reset() {
      spine.x = spine.v = 0;
      bank.x = bank.v = 0;
      for (const s of caudal) {
        s.x = 0;
        s.v = 0;
      }
      accumulator = 0;
      havePrev = false;
    },
    step(yawRate, flukePhase, flukeAmp, dt) {
      // NaN / huge-dt guard (e.g. after tab suspend).
      if (!finite(yawRate) || !finite(dt)) {
        this.reset();
        return out;
      }
      dt = Math.min(Math.max(dt, 0), MAX_DT);

      // Beat angular velocity for the caudal trailing lag (phase RATE, not changed).
      let phaseVel = 0;
      if (havePrev && dt > 1e-6) {
        let dPhase = flukePhase - prevPhase;
        while (dPhase > Math.PI) dPhase -= 2 * Math.PI;
        while (dPhase < -Math.PI) dPhase += 2 * Math.PI;
        phaseVel = dPhase / dt;
      }
      prevPhase = flukePhase;
      havePrev = true;

      const spineTarget = clamp(cfg.spineGain * yawRate, -limits.spineFlexMax, limits.spineFlexMax);
      const bankTarget = clamp(cfg.bankGain * yawRate, -limits.bankMax, limits.bankMax);
      // Trailing lag target per caudal joint: opposes the beat velocity, scaled by
      // amplitude and a tailward weight, clamped to the lag bound (<= 15 deg).
      const lagBase = clamp(
        -cfg.caudalLagGain * phaseVel * flukeAmp * limits.flukeJointMax,
        -limits.caudalLagMax,
        limits.caudalLagMax,
      );

      accumulator += dt;
      while (accumulator >= FIXED_DT) {
        stepSpring1D(spine, spineTarget, cfg.spine, FIXED_DT);
        stepSpring1D(bank, bankTarget, cfg.bank, FIXED_DT);
        for (let i = 0; i < cfg.nCaudal; i++) {
          const w = (i + 1) / cfg.nCaudal; // more lag toward the fluke tip
          stepSpring1D(caudal[i], lagBase * w, cfg.caudal, FIXED_DT);
        }
        accumulator -= FIXED_DT;
      }

      out.spineYaw = clamp(spine.x, -limits.spineFlexMax, limits.spineFlexMax);
      out.bankRoll = clamp(bank.x, -limits.bankMax, limits.bankMax);
      for (let i = 0; i < cfg.nCaudal; i++) {
        out.caudalFollow[i] = clamp(caudal[i].x, -limits.caudalLagMax, limits.caudalLagMax);
        if (!finite(out.caudalFollow[i])) out.caudalFollow[i] = 0;
      }
      if (!finite(out.spineYaw)) out.spineYaw = 0;
      if (!finite(out.bankRoll)) out.bankRoll = 0;
      return out;
    },
  };
}
