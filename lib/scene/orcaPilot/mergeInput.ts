import type { OrcaPilotInput } from "./input";

const EMPTY: OrcaPilotInput = {
  forward: false,
  back: false,
  left: false,
  right: false,
  boost: false,
  yawDelta: 0,
  pitchDelta: 0,
  pointerLocked: false,
};

/** OR-combine held buttons; sum look deltas. Desktop + mobile can both be
 * active when a tablet has a keyboard attached. */
export function mergeOrcaPilotInputs(
  primary: OrcaPilotInput,
  secondary: OrcaPilotInput | null | undefined,
): OrcaPilotInput {
  if (!secondary) return primary;
  return {
    forward: primary.forward || secondary.forward,
    back: primary.back || secondary.back,
    left: primary.left || secondary.left,
    right: primary.right || secondary.right,
    boost: primary.boost || secondary.boost,
    yawDelta: primary.yawDelta + secondary.yawDelta,
    pitchDelta: primary.pitchDelta + secondary.pitchDelta,
    pointerLocked: primary.pointerLocked || secondary.pointerLocked,
  };
}

export function emptyOrcaPilotInput(): OrcaPilotInput {
  return { ...EMPTY };
}
