// HUNT-W2 Agent A - third-person chase camera for the player-piloted orca.
//
// Style-matched to web/lib/scene/camera/director.ts (pure three.js, no React
// state, no dependency on OrbitControls, advanced by a per-frame `update(dt)`
// inside the host scene's `useFrame`), but deliberately much simpler: a
// per-frame third-person follow of a world position + heading, with no eased
// tweens and no lat/lng geo mapping. This module does NOT import
// `web/lib/scene/camera/director.ts` and has no knowledge of it.
//
// Integration note (not implemented here, route-level wiring): while this
// chase camera drives the camera, the host scene must disable/detach any
// `OrbitControls` (`makeDefault` or otherwise) so the two do not fight over
// the camera transform each frame, per HUNT-INPUT.md's coexistence note.

import * as THREE from "three";

export interface ChaseCameraOptions {
  /** Horizontal standoff behind the target, world units. */
  distance?: number;
  /** Vertical offset above the target, world units. */
  height?: number;
  /** Exponential-smoothing rate (1/s) for camera POSITION toward the desired
   * eye point. Higher = snappier translation. */
  positionSmoothing?: number;
  /** Exponential-smoothing rate (1/s) for the orbital heading the camera
   * sits behind. Lower than positionSmoothing so a hard turn first shows the
   * orca in side profile while the camera swings to the new aft POV. */
  headingSmoothing?: number;
}

export interface ChaseCamera {
  /**
   * Advance one frame: ease the camera's orbital heading toward the orca's
   * live heading, place the eye behind the eased heading, ease position, then
   * look slightly ahead along the orca's ACTUAL heading so steering reads
   * clearly in frame.
   */
  update(camera: THREE.Camera, targetPosition: THREE.Vector3, targetHeading: number, dt: number): void;
}

const DEFAULT_DISTANCE = 10;
const DEFAULT_HEIGHT = 4;
const DEFAULT_POSITION_SMOOTHING = 7;
/** Deliberately slower than position so turns expose the flank first. */
const DEFAULT_HEADING_SMOOTHING = 2.4;
const LOOK_AT_HEIGHT_FRACTION = 0.4;
/** Nose-look lead in world units so the frame anticipates where the orca points. */
const LOOK_AHEAD_DISTANCE = 2.5;

const TWO_PI = Math.PI * 2;

function lerpAngle(current: number, target: number, t: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= TWO_PI;
  while (delta < -Math.PI) delta += TWO_PI;
  return current + delta * t;
}

export function createChaseCamera(opts: ChaseCameraOptions = {}): ChaseCamera {
  const distance = opts.distance ?? DEFAULT_DISTANCE;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const positionSmoothing = opts.positionSmoothing ?? DEFAULT_POSITION_SMOOTHING;
  const headingSmoothing = opts.headingSmoothing ?? DEFAULT_HEADING_SMOOTHING;

  const desiredEye = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let smoothedHeading = 0;
  let initialized = false;

  return {
    update(camera, targetPosition, targetHeading, dtRaw) {
      const dt = Number.isFinite(dtRaw) && dtRaw > 0 ? dtRaw : 0;

      if (!initialized) {
        smoothedHeading = targetHeading;
        initialized = true;
      }

      const tHeading = 1 - Math.exp(-headingSmoothing * dt);
      smoothedHeading = lerpAngle(smoothedHeading, targetHeading, tHeading);

      const orbitFx = Math.cos(smoothedHeading);
      const orbitFz = -Math.sin(smoothedHeading);
      desiredEye.set(
        targetPosition.x - orbitFx * distance,
        targetPosition.y + height,
        targetPosition.z - orbitFz * distance,
      );

      const tPos = 1 - Math.exp(-positionSmoothing * dt);
      camera.position.lerp(desiredEye, tPos);

      const lookFx = Math.cos(targetHeading);
      const lookFz = -Math.sin(targetHeading);
      lookTarget.set(
        targetPosition.x + lookFx * LOOK_AHEAD_DISTANCE,
        targetPosition.y + height * LOOK_AT_HEIGHT_FRACTION,
        targetPosition.z + lookFz * LOOK_AHEAD_DISTANCE,
      );
      camera.lookAt(lookTarget);
    },
  };
}
