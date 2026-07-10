// STRIKE-W2e — maps StrikeControls + OrcaPilotInput + FSM hints into the locked
// HUNT OrcaPilotInput shape for deadReckoning. A/D never become turn-assist.

import type { OrcaPilotInput } from "../orcaPilot/input";
import type { PilotFsmAdapterInput, PilotFsmOutput, StrikeControls } from "./types";
import { pilotFsmToAdapterInput } from "./pilotStateMachine";

export interface AdaptedPilotInput {
  /** Input struct for `createOrcaPilot().update()`. */
  pilotInput: OrcaPilotInput;
  /** Q/E commanded depth rate, m/s (+ dive, − surface). Applied by scene/FSM. */
  depthRateMps: number;
  /** A/D body roll intent for rig overlay (W3). */
  bodyRollIntent: -1 | 0 | 1;
}

const DIVE_DEPTH_RATE_MPS = 2.5;
const SURFACE_DEPTH_RATE_MPS = -2.5;

function breachPhaseModes(mode: PilotFsmAdapterInput["mode"]): boolean {
  return (
    mode === "breach_air" ||
    mode === "breach_land" ||
    mode === "breach_charge"
  );
}

/**
 * Convert STRIKE controls into HUNT pilot input. Always zeros `left`/`right`
 * so A/D roll never engages deadReckoning turn-assist.
 */
export function toOrcaPilotInput(
  raw: OrcaPilotInput,
  ctrl: StrikeControls,
  fsm: PilotFsmAdapterInput,
): AdaptedPilotInput {
  const inBreach = fsm.inBreachPhase || breachPhaseModes(fsm.mode);
  const inBlowholeSquirt = fsm.mode === "blowhole_squirt";
  const inRoll = fsm.mode === "roll_left" || fsm.mode === "roll_right";

  let depthRateMps = 0;
  if (!inBreach && !inBlowholeSquirt) {
    if (ctrl.dive) depthRateMps = DIVE_DEPTH_RATE_MPS;
    else if (ctrl.surface) depthRateMps = SURFACE_DEPTH_RATE_MPS;
  }

  let bodyRollIntent: -1 | 0 | 1 = 0;
  if (ctrl.rollLeft && !ctrl.rollRight) bodyRollIntent = -1;
  else if (ctrl.rollRight && !ctrl.rollLeft) bodyRollIntent = 1;

  const pilotInput: OrcaPilotInput = {
    forward: ctrl.forward && !inBlowholeSquirt,
    back: ctrl.reverse && !inBreach,
    left: false,
    right: false,
    boost: ctrl.boost || fsm.mode === "boost",
    yawDelta: inRoll ? 0 : raw.yawDelta,
    pitchDelta: fsm.usePitchForDepth ? raw.pitchDelta : 0,
    pointerLocked: raw.pointerLocked,
  };

  return { pilotInput, depthRateMps, bodyRollIntent };
}

/** Default FSM adapter input (swim baseline). */
export function defaultPilotFsmAdapterInput(): PilotFsmAdapterInput {
  return {
    mode: "swim",
    inBreachPhase: false,
    usePitchForDepth: true,
  };
}

/** Convenience: adapt from full W3a FSM output. */
export function toOrcaPilotInputFromFsm(
  raw: OrcaPilotInput,
  ctrl: StrikeControls,
  fsm: PilotFsmOutput,
): AdaptedPilotInput {
  return toOrcaPilotInput(raw, ctrl, pilotFsmToAdapterInput(fsm));
}
