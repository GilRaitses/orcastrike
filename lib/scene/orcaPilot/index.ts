// HUNT-W2 Agent A - orcaPilot module barrel. Player-input/pose/camera core
// for the orca-boat-hunt arcade feature. See WIRING.md for how a future
// integrator wires this into a route.

export { createOrcaPilotInputSampler } from "./input";
export type { OrcaPilotInput, OrcaPilotInputSampler } from "./input";
export { createMobilePilotInputSampler } from "./mobileInput";
export type { MobilePilotInputSampler, MobilePilotTouchState } from "./mobileInput";
export { createDeviceTiltSensor } from "./deviceTilt";
export type { DeviceTiltSensor, DeviceTiltReading } from "./deviceTilt";
export { isMobilePilotDevice } from "./isMobilePilot";
export { mergeOrcaPilotInputs, emptyOrcaPilotInput } from "./mergeInput";
export { createOrcaPilot } from "./deadReckoning";
export type { OrcaPilot, OrcaPilotOptions, GetSeabedClearanceM } from "./deadReckoning";
export { createPilotTrack } from "./PilotTrack";
export { createChaseCamera } from "./chaseCamera";
export type { ChaseCamera, ChaseCameraOptions } from "./chaseCamera";
