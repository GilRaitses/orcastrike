// Mobile pilot input: accelerometer tilt steering (racing-game style) plus
// touch-held boost/brake. Produces the same OrcaPilotInput snapshots as the
// desktop WASD sampler so deadReckoning.ts needs no fork.

import type { OrcaPilotInput, OrcaPilotInputSampler } from "./input";
import { createDeviceTiltSensor, type DeviceTiltSensor } from "./deviceTilt";

/** Touch-held buttons the React overlay drives each frame. */
export interface MobilePilotTouchState {
  boost: boolean;
  back: boolean;
}

export interface MobilePilotInputSampler extends OrcaPilotInputSampler {
  /** Enable tilt + auto-cruise after the player taps Start (and iOS grants). */
  setSessionActive(active: boolean): void;
  /** Merge partial touch button state from the overlay. */
  setTouchState(state: Partial<MobilePilotTouchState>): void;
  /** User-gesture permission for DeviceOrientation (iOS). Returns false on deny. */
  requestOrientationPermission(): Promise<boolean>;
  /** Re-zero tilt neutral while piloting (e.g. recenter button). */
  recalibrateTilt(): void;
}

// Racing-style tuning: full tilt at ~22° steer / ~18° pitch maps to the same
// per-frame turn/pitch rates a desktop player gets from a fast mouse flick.
const STEER_DEADZONE_DEG = 4;
const STEER_FULL_TILT_DEG = 22;
const MAX_YAW_DELTA_PER_FRAME = 0.045;

const PITCH_DEADZONE_DEG = 5;
const PITCH_FULL_TILT_DEG = 18;
const MAX_PITCH_DELTA_PER_FRAME = 0.035;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function axisDelta(deg: number, deadzone: number, fullScale: number, maxDelta: number): number {
  const abs = Math.abs(deg);
  if (abs <= deadzone) return 0;
  const sign = deg < 0 ? -1 : 1;
  const t = clamp((abs - deadzone) / (fullScale - deadzone), 0, 1);
  return sign * t * maxDelta;
}

const EMPTY_TOUCH: MobilePilotTouchState = { boost: false, back: false };

export function createMobilePilotInputSampler(): MobilePilotInputSampler {
  const tilt = createDeviceTiltSensor();
  let sessionActive = false;
  let touch: MobilePilotTouchState = { ...EMPTY_TOUCH };

  return {
    getInput(): OrcaPilotInput {
      if (!sessionActive) {
        return {
          forward: false,
          back: false,
          left: false,
          right: false,
          boost: false,
          yawDelta: 0,
          pitchDelta: 0,
          pointerLocked: false,
        };
      }

      let yawDelta = 0;
      let pitchDelta = 0;
      const reading = tilt.read();
      if (reading) {
        yawDelta = axisDelta(
          reading.steerDeg,
          STEER_DEADZONE_DEG,
          STEER_FULL_TILT_DEG,
          MAX_YAW_DELTA_PER_FRAME,
        );
        // Tilt toward the horizon = dive (+pitchDelta in deadReckoning convention).
        pitchDelta = axisDelta(
          reading.pitchDeg,
          PITCH_DEADZONE_DEG,
          PITCH_FULL_TILT_DEG,
          MAX_PITCH_DELTA_PER_FRAME,
        );
      }

      return {
        // Auto-cruise like holding the gas pedal in a mobile racer; brake
        // touch overrides to reverse.
        forward: !touch.back,
        back: touch.back,
        left: false,
        right: false,
        boost: touch.boost,
        yawDelta,
        pitchDelta,
        pointerLocked: false,
      };
    },
    setSessionActive(active: boolean): void {
      sessionActive = active;
      if (active) tilt.calibrate();
    },
    setTouchState(state: Partial<MobilePilotTouchState>): void {
      touch = { ...touch, ...state };
    },
    async requestOrientationPermission(): Promise<boolean> {
      const ok = await tilt.requestPermission();
      if (ok) tilt.calibrate();
      return ok;
    },
    recalibrateTilt(): void {
      tilt.calibrate();
    },
    dispose(): void {
      tilt.dispose();
      touch = { ...EMPTY_TOUCH };
      sessionActive = false;
    },
  };
}
