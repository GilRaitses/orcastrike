// OEYE - orca eye meshes, cornea catch-light, and a bounded damped gaze.
//
// Two small dark eye spheres with a clear-coat cornea, parented to the OR head
// bone so they follow head pose. The catch-light is PHYSICAL: the clear-coat
// cornea reflects the same WFX PMREM env the skin uses (OEYE-R option A), so the
// highlight tracks the real key light and dims/tints underwater with the body.
//
// The eye is a distinct small feature placed BELOW and slightly forward of the
// white eyepatch (the eyepatch is OMAT skin pigment, not the eye). Gaze is a
// bounded, critically-damped look-at that rotates ONLY the eye meshes in
// head-local space; it never writes body orientation and composes strictly after
// OG/OR/OPHYS (the honesty lock in OEYE-R section 3).

import * as THREE from "three";
import type { WfxEnvHandle } from "../materials/wfxEnv";

export interface OrcaEyesOptions {
  /** The OR head bone to parent the eyes to. */
  headBone: THREE.Object3D;
  /** WFX env for the physical catch-light (cornea reflects this). */
  env: WfxEnvHandle;
  /** Eye radius, metres. Default 0.06 (small + dark, anti-uncanny). */
  radius?: number;
  /**
   * Eye anchor in HEAD-BONE local space, metres. Default places the eye low and
   * leading on a 7 m body whose head bone sits near x=2.1. z is mirrored L/R.
   */
  anchor?: { x: number; y: number; z: number };
}

export interface OrcaEyesHandle {
  group: THREE.Group;
  /** Enable/disable + clamp the gaze (LOD far -> disable). */
  setGazeEnabled(on: boolean): void;
  /**
   * Advance the damped gaze toward a WORLD-space target (e.g. the camera).
   * Pure cosmetic overlay; clamps to a believable cone, slews, never snaps.
   */
  update(dt: number, targetWorld: THREE.Vector3 | null): void;
  dispose(): void;
}

const YAW_CLAMP = THREE.MathUtils.degToRad(25);
const PITCH_CLAMP = THREE.MathUtils.degToRad(15);
const MAX_SLEW = THREE.MathUtils.degToRad(80); // rad/s

export function makeOrcaEyes(opts: OrcaEyesOptions): OrcaEyesHandle {
  const radius = opts.radius ?? 0.06;
  const anchor = opts.anchor ?? { x: 0.32, y: -0.02, z: 0.52 };

  const eyeGeo = new THREE.SphereGeometry(radius, 16, 12);

  // Cornea/sclera shell: very dark, clear-coat wet cap (catch-light lives here).
  const corneaMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#0c0e10"),
    roughness: 0.1,
    metalness: 0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.2,
  });
  if (opts.env.pmremEnvironment) corneaMat.envMap = opts.env.pmremEnvironment;

  const group = new THREE.Group();
  group.name = "orca_eyes";

  const eyes: THREE.Group[] = [];
  for (const side of [+1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(anchor.x, anchor.y, anchor.z * side);
    const ball = new THREE.Mesh(eyeGeo, corneaMat);
    eye.add(ball);
    eye.userData.side = side;
    eye.userData.rest = eye.position.clone();
    group.add(eye);
    eyes.push(eye);
  }

  // Parent to the head bone so the eyes follow head pose (OEYE-R section 1).
  opts.headBone.add(group);

  let gazeEnabled = true;
  const curYaw: number[] = [0, 0];
  const curPitch: number[] = [0, 0];

  const tmpLocal = new THREE.Vector3();
  const inv = new THREE.Matrix4();

  return {
    group,
    setGazeEnabled(on) {
      gazeEnabled = on;
      if (!on) {
        for (let i = 0; i < eyes.length; i++) {
          curYaw[i] = 0;
          curPitch[i] = 0;
          eyes[i].rotation.set(0, 0, 0);
        }
      }
    },
    update(dt, targetWorld) {
      if (!gazeEnabled || !targetWorld) return;
      for (let i = 0; i < eyes.length; i++) {
        const eye = eyes[i];
        eye.updateWorldMatrix(true, false);
        // Target in eye-local space (eye forward is +X, matching the body).
        inv.copy(eye.matrixWorld).invert();
        tmpLocal.copy(targetWorld).applyMatrix4(inv).normalize();
        // Desired yaw (about Y) and pitch (about Z) to face +X toward target.
        let desiredYaw = Math.atan2(tmpLocal.z, tmpLocal.x);
        let desiredPitch = Math.atan2(tmpLocal.y, Math.hypot(tmpLocal.x, tmpLocal.z));
        desiredYaw = THREE.MathUtils.clamp(desiredYaw, -YAW_CLAMP, YAW_CLAMP);
        desiredPitch = THREE.MathUtils.clamp(desiredPitch, -PITCH_CLAMP, PITCH_CLAMP);

        const maxStep = MAX_SLEW * dt;
        curYaw[i] += THREE.MathUtils.clamp(desiredYaw - curYaw[i], -maxStep, maxStep);
        curPitch[i] += THREE.MathUtils.clamp(desiredPitch - curPitch[i], -maxStep, maxStep);
        eye.rotation.set(0, curYaw[i], curPitch[i], "XYZ");
      }
    },
    dispose() {
      eyeGeo.dispose();
      corneaMat.dispose();
      opts.headBone.remove(group);
    },
  };
}
