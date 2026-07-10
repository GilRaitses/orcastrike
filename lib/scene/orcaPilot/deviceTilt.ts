// Low-level tilt sensor for mobile piloting. Racing-game pattern: hold the
// phone like a wheel, tilt left/right to steer, tilt forward/back for
// dive/climb. Calibrates a neutral pose on the first reading after the
// session starts so the player does not need a perfect starting angle.

export interface DeviceTiltReading {
  /** Left/right steering axis, degrees. Negative = tilt left. */
  steerDeg: number;
  /** Forward/back pitch axis, degrees. Negative = tilt toward player (climb). */
  pitchDeg: number;
}

export interface DeviceTiltSensor {
  /** Latest calibrated reading, or null before the first event. */
  read(): DeviceTiltReading | null;
  /** Capture the current raw pose as neutral (call right after permission). */
  calibrate(): void;
  /** iOS 13+ requires a user-gesture permission prompt for orientation. */
  requestPermission(): Promise<boolean>;
  dispose(): void;
}

type OrientationPermissionCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

function readOrientation(e: DeviceOrientationEvent): DeviceTiltReading {
  // gamma: left/right roll when the phone is held upright in portrait.
  // beta: front/back tilt. Values are in degrees per the DeviceOrientation spec.
  return {
    steerDeg: e.gamma ?? 0,
    pitchDeg: e.beta ?? 0,
  };
}

export function createDeviceTiltSensor(): DeviceTiltSensor {
  let latest: DeviceTiltReading | null = null;
  let neutralSteer = 0;
  let neutralPitch = 0;
  let calibrated = false;

  function onOrientation(e: DeviceOrientationEvent): void {
    latest = readOrientation(e);
    if (!calibrated && latest) {
      neutralSteer = latest.steerDeg;
      neutralPitch = latest.pitchDeg;
      calibrated = true;
    }
  }

  window.addEventListener("deviceorientation", onOrientation);

  return {
    read(): DeviceTiltReading | null {
      if (!latest) return null;
      return {
        steerDeg: latest.steerDeg - neutralSteer,
        pitchDeg: latest.pitchDeg - neutralPitch,
      };
    },
    calibrate(): void {
      if (latest) {
        neutralSteer = latest.steerDeg;
        neutralPitch = latest.pitchDeg;
      }
      calibrated = true;
    },
    async requestPermission(): Promise<boolean> {
      const ctor = DeviceOrientationEvent as OrientationPermissionCtor;
      if (typeof ctor.requestPermission === "function") {
        const state = await ctor.requestPermission();
        return state === "granted";
      }
      return true;
    },
    dispose(): void {
      window.removeEventListener("deviceorientation", onOrientation);
    },
  };
}
