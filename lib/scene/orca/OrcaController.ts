// ORCA controller - assembles mesh + rig + material + eyes + mouth + motion +
// physics into one object with a single per-frame update, in the LOCKED
// composition order (OEYE-R section 3 / OPHYS-R section 4):
//   1. OG    -> body orientation + depth + fluke (authoritative, on the root).
//   2. OPHYS -> bounded spine/bank/caudal follow (bone-local, clamped).
//   3. OMOU  -> labeled foraging-cued jaw open (independent DOF).
//   4. OEYE  -> bounded damped gaze (eye meshes only, composed last).
//
// Compute discipline: one GPU-skinned mesh (skinning on the GPU), the WFX env
// shared for lighting (no separate orca light pass), CPU work is a dozen damped
// springs + interpolation per frame, and distance LOD drops the eye/mouth/physics
// detail so a far orca costs almost nothing.

import * as THREE from "three";
import { loadOrcaMesh, ORCA_MESH_URL } from "./loadOrcaMesh";
import { buildOrcaRig, DEFAULT_LIMITS, type OrcaRig } from "./rig/OrcaRig";
import { makeOrcaMaterial, type OrcaMaterialHandle } from "./materials/orcaMaterial";
import type { WfxEnvHandle } from "./materials/wfxEnv";
import { makeOrcaEyes, type OrcaEyesHandle } from "./eyes/orcaEyes";
import { makeOrcaMouth, type OrcaMouthHandle } from "./mouth/orcaMouth";
import { loadBiologging, driveOrca, type BiologgingTrack } from "./motion/biologging";
import {
  makeSecondaryDynamics,
  DEFAULT_CONFIG,
  type SecondaryDynamics,
} from "./physics/secondaryDynamics";

export interface OrcaControllerOptions {
  env: WfxEnvHandle;
  meshUrl?: string;
  /** Biologging manifest URL. Default the real SRKW driver. */
  motionUrl?: string;
  /** Seconds of track time per real second. Default 1. */
  timeScale?: number;
  /** worldUnitsPerMeter for depth->Y. Default 1 (sandbox metric). */
  worldUnitsPerMeter?: number;
  /** Extra multiplier on the depth descent for a watchable sandbox dive. */
  depthScale?: number;
  /** Live pose source (e.g. a player-piloted PilotTrack). When present, skips
   * loadBiologging(motionUrl) and drives from this track directly. Backward
   * compatible: omit this to keep the existing biologging-driven behavior. */
  track?: BiologgingTrack;
}

export interface OrcaCost {
  triangles: number;
  bones: number;
  drawCalls: number;
  springsPerFrame: number;
  lod: "near" | "mid" | "far";
}

export interface OrcaController {
  root: THREE.Group;
  rig: OrcaRig;
  track: BiologgingTrack;
  /** Advance one frame. */
  update(dt: number, elapsed: number, cameraWorldPos: THREE.Vector3 | null): void;
  setEnv(env: WfxEnvHandle): void;
  cost: OrcaCost;
  dispose(): void;
}

export const REAL_SRKW_MOTION_URL = "/orca/motion/orca_srkw_oo14_driver.json";
export const SIM_DEV_MOTION_URL = "/orca/motion/orca_dev_track.json";

export async function createOrcaController(opts: OrcaControllerOptions): Promise<OrcaController> {
  const meshUrl = opts.meshUrl ?? ORCA_MESH_URL;
  const motionUrl = opts.motionUrl ?? REAL_SRKW_MOTION_URL;
  const timeScale = opts.timeScale ?? 1;
  const wupm = opts.worldUnitsPerMeter ?? 1;
  const depthScale = opts.depthScale ?? 1;

  const [{ geometry, sourceMaterial }, track] = await Promise.all([
    loadOrcaMesh(meshUrl),
    opts.track ? Promise.resolve(opts.track) : loadBiologging(motionUrl),
  ]);

  const matHandle: OrcaMaterialHandle = makeOrcaMaterial({
    map: sourceMaterial.map,
    normalMap: sourceMaterial.normalMap,
    env: opts.env,
  });

  const rig = buildOrcaRig(geometry, matHandle.material, DEFAULT_LIMITS);

  const eyes: OrcaEyesHandle = makeOrcaEyes({ headBone: rig.bones.head, env: opts.env });
  const mouth: OrcaMouthHandle = makeOrcaMouth({
    headBone: rig.bones.head,
    jawBone: rig.bones.jaw,
  });

  const physics: SecondaryDynamics = makeSecondaryDynamics(
    { ...DEFAULT_CONFIG, nCaudal: rig.bones.caudal.length },
    {
      spineFlexMax: rig.limits.spineFlexMax,
      bankMax: rig.limits.bankMax,
      flukeJointMax: rig.limits.flukeJointMax,
      caudalLagMax: THREE.MathUtils.degToRad(15),
    },
  );

  const root = rig.root;

  // Triangle count for the cost report.
  let triangles = 0;
  const idx = geometry.getIndex();
  triangles = idx ? idx.count / 3 : (geometry.attributes.position as THREE.BufferAttribute).count / 3;

  const cost: OrcaCost = {
    triangles,
    bones: 4 + rig.bones.caudal.length + 2,
    drawCalls: 1 /*body*/ + 2 /*eyes share material -> still 2 meshes*/ + 4 /*mouth parts*/,
    springsPerFrame: 2 + rig.bones.caudal.length,
    lod: "near",
  };

  let prevYaw = track.sample(0).yaw;
  let foragingSmoothed = 0;
  const tmpWorld = new THREE.Vector3();

  function update(dt: number, elapsed: number, cameraWorldPos: THREE.Vector3 | null): void {
    const pose = track.sample(elapsed * timeScale);

    // LOD from camera distance to the orca root.
    root.getWorldPosition(tmpWorld);
    const dist = cameraWorldPos ? cameraWorldPos.distanceTo(tmpWorld) : 0;
    const lod: OrcaCost["lod"] = dist > 60 ? "far" : dist > 22 ? "mid" : "near";
    cost.lod = lod;

    // 1. OG authoritative pose (orientation + depth + fluke).
    driveOrca(rig, pose, wupm * depthScale);

    // 2. OPHYS bounded secondary motion, layered on the bones only.
    let yawRate = 0;
    if (dt > 1e-6) {
      let d = pose.yaw - prevYaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      yawRate = d / dt;
    }
    prevYaw = pose.yaw;
    if (lod !== "far") {
      const sec = physics.step(yawRate, pose.flukePhase, pose.flukeAmp, dt);
      rig.setSecondaryFlex(sec.spineYaw, sec.bankRoll);
      rig.setCaudalFollow(sec.caudalFollow);
    }

    // 3. OMOU labeled foraging-cued open. Context proxy: in a dive (depth > 5 m)
    // with effort read from the smoothed fluke amplitude. Modeled, not a feeding
    // claim (OMOU-R honesty lock).
    const inDive = pose.depthM > 5;
    foragingSmoothed += (pose.flukeAmp - foragingSmoothed) * Math.min(1, dt * 1.5);
    mouth.setForagingContext(inDive, foragingSmoothed);
    mouth.setVisible(lod !== "far");
    rig.setJaw(mouth.update(dt));

    // 4. OEYE gaze, composed last (eye meshes only).
    eyes.setGazeEnabled(lod === "near");
    eyes.update(dt, lod === "near" ? cameraWorldPos : null);
  }

  return {
    root,
    rig,
    track,
    update,
    setEnv(env) {
      matHandle.setEnv(env);
    },
    cost,
    dispose() {
      eyes.dispose();
      mouth.dispose();
      matHandle.dispose();
      rig.dispose();
    },
  };
}
