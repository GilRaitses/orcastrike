// ORCA module barrel. Sandbox-only until O0 gates the SalishScene mount.
export { loadOrcaMesh, ORCA_MESH_URL, ORCA_MESH_BACKUP_URL } from "./loadOrcaMesh";
export type { LoadedOrcaMesh } from "./loadOrcaMesh";
export { buildOrcaRig, DEFAULT_LIMITS } from "./rig/OrcaRig";
export type { OrcaRig, OrcaRigLimits } from "./rig/OrcaRig";
export { makeOrcaMaterial } from "./materials/orcaMaterial";
export type { OrcaMaterialHandle, OrcaMaterialOptions } from "./materials/orcaMaterial";
export { makeSandboxWfxEnv } from "./materials/wfxEnv";
export type { WfxEnvHandle } from "./materials/wfxEnv";
// ENV-handle-consolidation: ORCA-owned live-handle registry. OrcaRig publishes its
// single live WfxEnvHandle here; the homepage slice borrows it (via
// useSyncExternalStore over subscribe + snapshot) instead of baking a duplicate
// PMREM. OrcaRig stays the sole owner/disposer and sole scene.environment writer.
export {
  setLiveWfxEnv,
  getLiveWfxEnv,
  clearLiveWfxEnv,
  subscribeLiveWfxEnv,
} from "./materials/wfxEnv";
export { makeOrcaEyes } from "./eyes/orcaEyes";
export { makeOrcaMouth } from "./mouth/orcaMouth";
export { loadBiologging, driveOrca } from "./motion/biologging";
export type { BiologgingTrack, OrcaPose, BiologgingManifest } from "./motion/biologging";
export { makeSecondaryDynamics, DEFAULT_CONFIG } from "./physics/secondaryDynamics";
export type { SecondaryDynamics, SecondaryConfig } from "./physics/secondaryDynamics";
export {
  createOrcaController,
  REAL_SRKW_MOTION_URL,
  SIM_DEV_MOTION_URL,
} from "./OrcaController";
export type { OrcaController, OrcaCost } from "./OrcaController";
