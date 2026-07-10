// STRIKE-W2d — low-angle breach camera (W1d). Style-matched to chaseCamera.ts.

import * as THREE from "three";

export interface BreachCameraOptions {
  /** Horizontal standoff, world units. */
  distance?: number;
  /** Vertical offset above splash point. */
  height?: number;
  /** Widened FOV during breach_air, degrees. */
  breachFovDeg?: number;
  /** Default FOV when exiting breach cam. */
  defaultFovDeg?: number;
  positionSmoothing?: number;
}

export interface BreachCamera {
  /** Enter breach cam anchored at launch/splash world position. */
  activate(anchor: THREE.Vector3, targetHeading: number): void;
  deactivate(): void;
  isActive(): boolean;
  update(
    camera: THREE.PerspectiveCamera,
    targetPosition: THREE.Vector3,
    targetHeading: number,
    dt: number,
  ): void;
}

const DEFAULT_DISTANCE = 14;
const DEFAULT_HEIGHT = 2.5;
const DEFAULT_BREACH_FOV = 68;
const DEFAULT_BASE_FOV = 55;
const DEFAULT_POSITION_SMOOTHING = 9;

export function createBreachCamera(opts: BreachCameraOptions = {}): BreachCamera {
  const distance = opts.distance ?? DEFAULT_DISTANCE;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const breachFovDeg = opts.breachFovDeg ?? DEFAULT_BREACH_FOV;
  const defaultFovDeg = opts.defaultFovDeg ?? DEFAULT_BASE_FOV;
  const positionSmoothing = opts.positionSmoothing ?? DEFAULT_POSITION_SMOOTHING;

  const desiredEye = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let active = false;
  let anchorHeading = 0;

  return {
    activate(anchor, targetHeading) {
      active = true;
      anchorHeading = targetHeading;
      desiredEye.set(anchor.x, anchor.y + height, anchor.z);
    },
    deactivate() {
      active = false;
    },
    isActive() {
      return active;
    },
    update(camera, targetPosition, targetHeading, dtRaw) {
      const dt = Number.isFinite(dtRaw) && dtRaw > 0 ? dtRaw : 0;
      if (!active) return;

      const heading = targetHeading;
      const fx = Math.cos(heading);
      const fz = -Math.sin(heading);
      desiredEye.set(
        targetPosition.x - fx * distance * 0.6,
        targetPosition.y + height,
        targetPosition.z - fz * distance * 0.6,
      );

      const tPos = 1 - Math.exp(-positionSmoothing * dt);
      camera.position.lerp(desiredEye, tPos);

      lookTarget.set(
        targetPosition.x + fx * 3,
        targetPosition.y + height * 0.3,
        targetPosition.z + fz * 3,
      );
      camera.lookAt(lookTarget);

      if (camera instanceof THREE.PerspectiveCamera) {
        const targetFov = breachFovDeg;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, tPos);
        camera.updateProjectionMatrix();
      }

      anchorHeading = heading;
    },
  };
}

/** Restore FOV toward default when leaving breach cam (call from scene). */
export function restoreBreachCameraFov(
  camera: THREE.PerspectiveCamera,
  defaultFovDeg: number,
  dt: number,
): void {
  const t = 1 - Math.exp(-6 * dt);
  camera.fov = THREE.MathUtils.lerp(camera.fov, defaultFovDeg, t);
  camera.updateProjectionMatrix();
}

export const BREACH_CAMERA_DEFAULT_FOV_DEG = DEFAULT_BASE_FOV;
