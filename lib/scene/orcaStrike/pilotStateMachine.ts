// STRIKE-W3a — 12-mode pilot FSM per STRIKE-W1b. Pure module; scene wires tick().

import {
  computeBreachLaunchImpulse,
  isBreachLaunchGuard,
  isBreachReentry,
  tickBreachCharge,
  tickBreachLand,
} from "./breach";
import { tickBlowholeCharge, canFireBlowhole } from "./blowhole";
import type {
  MotionOverrides,
  PilotFsmOutput,
  PilotFsmPoseSample,
  PilotFsmState,
  PilotMode,
  PilotTransitionEvent,
  RigBlendWeights,
  StrikeControls,
} from "./types";
import { STRIKE_MAX_DEPTH_M, STRIKE_MIN_DEPTH_M } from "./types";

export const DIVE_DEPTH_RATE_MPS = 2.5;
export const SURFACE_DEPTH_RATE_MPS = -2.5;
const IDLE_ENTER_S = 2.0;
const BREACH_LAND_DURATION_S = 0.6;
const BLOWHOLE_SQUIRT_DURATION_S = 0.45;
const BREACH_CHARGE_DECAY_IDLE_S = 0.4;
const BODY_ROLL_MAX_RAD = Math.PI / 2;
const BODY_ROLL_SLEW_RADPS = 3.5;
const W_DOUBLE_TAP_WINDOW_S = 0.28;
const GRAVITY_MPS2 = -9.8;
const BLOWHOLE_SURFACE_DEPTH_M = 1.0;

const MODE_RIG_BLEND: Record<PilotMode, RigBlendWeights> = {
  idle: { swim: 0.35, roll: 0, breach: 0, blowhole: 0 },
  swim: { swim: 1.0, roll: 0, breach: 0, blowhole: 0 },
  dive: { swim: 0.85, roll: 0, breach: 0, blowhole: 0 },
  surface: { swim: 0.85, roll: 0, breach: 0, blowhole: 0.15 },
  roll_left: { swim: 0.55, roll: 0.9, breach: 0, blowhole: 0 },
  roll_right: { swim: 0.55, roll: 0.9, breach: 0, blowhole: 0 },
  boost: { swim: 1.0, roll: 0, breach: 0, blowhole: 0 },
  breach_charge: { swim: 0.4, roll: 0, breach: 0.7, blowhole: 0 },
  breach_air: { swim: 0.2, roll: 0.5, breach: 1.0, blowhole: 0 },
  breach_land: { swim: 0.5, roll: 0, breach: 0.6, blowhole: 0 },
  blowhole_charge: { swim: 0.3, roll: 0, breach: 0, blowhole: 0.8 },
  blowhole_squirt: { swim: 0.2, roll: 0, breach: 0, blowhole: 1.0 },
};

export interface PilotFsmTickResult {
  output: PilotFsmOutput;
  state: PilotFsmState;
}

export function createInitialPilotFsmState(initialDepthM = 8): PilotFsmState {
  return {
    mode: "swim",
    modeTimeS: 0,
    idleTimerS: 0,
    breachCharge: 0,
    blowholeCharge: 0,
    airTimeS: 0,
    trickSlots: 0,
    lastWDownS: -Infinity,
    depthRateMps: 0,
    bodyRollTargetRad: 0,
    prevDepthM: initialDepthM,
    verticalVelocityMps: 0,
    breachChargeAtLaunch: 0,
    noBreachMashTimerS: 0,
    worldPosY: -initialDepthM,
  };
}

export function tickPilotFsm(
  dt: number,
  controls: StrikeControls,
  state: PilotFsmState,
  pose: PilotFsmPoseSample,
): PilotFsmTickResult {
  const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const events: PilotTransitionEvent[] = [];
  let next: PilotFsmState = { ...state, modeTimeS: state.modeTimeS + step };

  let ctrl = controls;
  if (ctrl.forward && step > 0) {
    const now = performanceNow();
    if (now - next.lastWDownS <= W_DOUBLE_TAP_WINDOW_S && !ctrl.boost) {
      ctrl = { ...ctrl, boost: true };
    }
    next.lastWDownS = now;
  }

  const depthM = clamp(pose.depthM, STRIKE_MIN_DEPTH_M, STRIKE_MAX_DEPTH_M);
  const depthRateFromPose = step > 1e-6 ? (depthM - next.prevDepthM) / step : 0;
  next.prevDepthM = depthM;

  const inBreachPhase =
    next.mode === "breach_charge" ||
    next.mode === "breach_air" ||
    next.mode === "breach_land";
  const inBlowholePhase =
    next.mode === "blowhole_charge" || next.mode === "blowhole_squirt";
  const phaseLocked =
    next.mode === "breach_air" ||
    next.mode === "breach_land" ||
    next.mode === "blowhole_squirt";

  if (!phaseLocked) {
    if (
      ctrl.forward ||
      ctrl.reverse ||
      ctrl.dive ||
      ctrl.surface ||
      ctrl.rollLeft ||
      ctrl.rollRight
    ) {
      next.idleTimerS = 0;
    } else {
      next.idleTimerS += step;
    }
  }

  if (next.mode === "breach_charge") {
    const chargeResult = tickBreachCharge(next.breachCharge, ctrl.breachMash, step);
    next.breachCharge = chargeResult.charge;
    next.noBreachMashTimerS = ctrl.breachMash
      ? 0
      : next.noBreachMashTimerS + step;
  } else if (!inBreachPhase && ctrl.breachMash && depthM >= 0.5) {
    next.breachCharge = Math.min(1, next.breachCharge + 0.12);
    next.noBreachMashTimerS = 0;
  } else if (!inBreachPhase && next.breachCharge > 0) {
    next.breachCharge = Math.max(0, next.breachCharge - 0.08 * step);
  }

  next.blowholeCharge = tickBlowholeCharge(
    next.blowholeCharge,
    ctrl.blowholeTap,
    step,
    next.mode === "blowhole_charge",
  );

  const hasThrust =
    ctrl.forward ||
    ctrl.reverse ||
    ctrl.dive ||
    ctrl.surface ||
    ctrl.rollLeft ||
    ctrl.rollRight;

  let targetMode = next.mode;

  if (next.mode === "breach_air" && isBreachReentry(depthM)) {
    targetMode = "breach_land";
    events.push({
      type: "breach_land",
      chargeAtLaunch: next.breachChargeAtLaunch,
      trickScored: next.trickSlots !== 0,
    });
  } else if (
    isBreachLaunchGuard({
      depthM,
      verticalVelocityMps: next.verticalVelocityMps,
      depthRateMps: depthRateFromPose,
      breachCharge: next.breachCharge,
      mode: next.mode,
    })
  ) {
    const impulse = computeBreachLaunchImpulse(next.breachCharge, pose.speedMps ?? 0);
    next.breachChargeAtLaunch = next.breachCharge;
    next.breachCharge = impulse.remainingCharge;
    next.verticalVelocityMps = impulse.verticalVelocityMps;
    next.trickSlots = 0;
    next.airTimeS = 0;
    targetMode = "breach_air";
    events.push({ type: "breach_launch", charge: next.breachChargeAtLaunch });
  } else if (next.mode === "breach_land" && next.modeTimeS >= BREACH_LAND_DURATION_S) {
    targetMode = hasThrust ? "swim" : "idle";
    const landResult = tickBreachLand(next.breachChargeAtLaunch, next.trickSlots !== 0);
    if (landResult.triggerReplay) {
      events.push({ type: "replay_trigger", reason: landResult.replayReason });
    }
  } else if (next.mode === "blowhole_squirt" && next.modeTimeS >= BLOWHOLE_SQUIRT_DURATION_S) {
    targetMode = hasThrust ? "swim" : "idle";
  } else if (
    canFireBlowhole(ctrl.blowholeTap, next.blowholeCharge, depthM, BLOWHOLE_SURFACE_DEPTH_M) &&
    !inBreachPhase
  ) {
    targetMode = "blowhole_squirt";
    next.blowholeCharge = 0;
    events.push({ type: "blowhole_squirt", charge: 1 });
  } else if (ctrl.breachMash && depthM >= 0.5 && !inBreachPhase && !inBlowholePhase) {
    targetMode = "breach_charge";
  } else if (
    next.mode === "breach_charge" &&
    !ctrl.breachMash &&
    next.breachCharge < 0.1 &&
    next.noBreachMashTimerS >= BREACH_CHARGE_DECAY_IDLE_S
  ) {
    targetMode = hasThrust ? "swim" : "idle";
  } else if (
    ctrl.rollLeft !== ctrl.rollRight &&
    !inBreachPhase &&
    !inBlowholePhase
  ) {
    targetMode = ctrl.rollLeft ? "roll_left" : "roll_right";
  } else if (
    (next.mode === "roll_left" || next.mode === "roll_right") &&
    !ctrl.rollLeft &&
    !ctrl.rollRight
  ) {
    targetMode = hasThrust ? "swim" : "idle";
  } else if (ctrl.dive && !inBreachPhase && !inBlowholePhase) {
    targetMode = "dive";
    next.depthRateMps = DIVE_DEPTH_RATE_MPS;
  } else if (ctrl.surface && !inBreachPhase && !inBlowholePhase) {
    targetMode = "surface";
    next.depthRateMps = SURFACE_DEPTH_RATE_MPS;
  } else if (
    (next.mode === "dive" || next.mode === "surface") &&
    !ctrl.dive &&
    !ctrl.surface
  ) {
    next.depthRateMps = 0;
    targetMode = hasThrust ? "swim" : "idle";
  } else if (ctrl.boost && ctrl.forward && !inBreachPhase && !inBlowholePhase) {
    targetMode = "boost";
  } else if (next.mode === "boost" && (!ctrl.boost || !ctrl.forward)) {
    targetMode = hasThrust ? "swim" : "idle";
  } else if (
    (next.mode === "swim" ||
      next.mode === "idle" ||
      next.mode === "dive" ||
      next.mode === "surface") &&
    !hasThrust &&
    next.idleTimerS >= IDLE_ENTER_S &&
    !inBreachPhase &&
    !inBlowholePhase
  ) {
    targetMode = "idle";
  } else if (next.mode === "idle" && hasThrust && !inBreachPhase && !inBlowholePhase) {
    if (ctrl.dive) targetMode = "dive";
    else if (ctrl.surface) targetMode = "surface";
    else if (ctrl.rollLeft !== ctrl.rollRight) {
      targetMode = ctrl.rollLeft ? "roll_left" : "roll_right";
    } else targetMode = "swim";
  } else if (
    (ctrl.forward || ctrl.reverse) &&
    !inBreachPhase &&
    !inBlowholePhase &&
    (next.mode === "swim" || next.mode === "idle")
  ) {
    targetMode = "swim";
  } else if (
    ctrl.blowholeTap &&
    !inBreachPhase &&
    next.blowholeCharge < 1 &&
    depthM <= BLOWHOLE_SURFACE_DEPTH_M
  ) {
    targetMode = "blowhole_charge";
  }

  if (targetMode !== next.mode) {
    next.mode = targetMode;
    next.modeTimeS = 0;
    if (targetMode === "breach_air") next.airTimeS = 0;
    if (targetMode === "breach_land") next.verticalVelocityMps = 0;
    if (targetMode === "dive") next.depthRateMps = DIVE_DEPTH_RATE_MPS;
    else if (targetMode === "surface") next.depthRateMps = SURFACE_DEPTH_RATE_MPS;
    else if (targetMode === "swim" || targetMode === "idle") next.depthRateMps = 0;
  }

  if (next.mode === "breach_air") {
    next.airTimeS += step;
    next.verticalVelocityMps += GRAVITY_MPS2 * step;
    next.worldPosY += next.verticalVelocityMps * step;
  } else if (next.mode !== "breach_land") {
    next.worldPosY = -depthM;
    if (next.mode !== "breach_charge") {
      next.verticalVelocityMps = depthRateFromPose;
    }
  }

  if (next.mode === "roll_left") {
    next.bodyRollTargetRad = moveToward(
      next.bodyRollTargetRad,
      -BODY_ROLL_MAX_RAD,
      BODY_ROLL_SLEW_RADPS * step,
    );
  } else if (next.mode === "roll_right") {
    next.bodyRollTargetRad = moveToward(
      next.bodyRollTargetRad,
      BODY_ROLL_MAX_RAD,
      BODY_ROLL_SLEW_RADPS * step,
    );
  } else {
    next.bodyRollTargetRad = moveToward(next.bodyRollTargetRad, 0, BODY_ROLL_SLEW_RADPS * step);
  }

  const rigBlend = { ...MODE_RIG_BLEND[next.mode] };
  const motionOverrides = computeMotionOverrides(
    next.mode,
    next.breachCharge,
    next.blowholeCharge,
  );

  const usePitchForDepth =
    next.mode !== "dive" &&
    next.mode !== "surface" &&
    !inBreachPhase &&
    next.mode !== "blowhole_squirt";

  const output: PilotFsmOutput = {
    mode: next.mode,
    modeTimeS: next.modeTimeS,
    breachCharge: next.breachCharge,
    blowholeCharge: next.blowholeCharge,
    airTimeS: next.airTimeS,
    trickSlots: next.trickSlots,
    depthRateMps: next.depthRateMps,
    bodyRollTargetRad: next.bodyRollTargetRad,
    verticalVelocityMps: next.verticalVelocityMps,
    breachChargeAtLaunch: next.breachChargeAtLaunch,
    rigBlend,
    motionOverrides,
    inBreachPhase:
      next.mode === "breach_charge" ||
      next.mode === "breach_air" ||
      next.mode === "breach_land",
    usePitchForDepth,
    transitionEvents: events,
  };

  return { output, state: next };
}

export function setPilotFsmTrickSlots(state: PilotFsmState, trickSlots: number): PilotFsmState {
  return { ...state, trickSlots };
}

export function pilotFsmToAdapterInput(
  output: PilotFsmOutput,
): import("./types").PilotFsmAdapterInput {
  return {
    mode: output.mode,
    inBreachPhase: output.inBreachPhase,
    usePitchForDepth: output.usePitchForDepth,
  };
}

/** Apply STRIKE rig overlays after `controller.update()` (W1c). */
export function applyStrikeRigLayers(
  rig: {
    setHeadOffset(yaw: number, pitch: number): void;
    setPectoral(left: number, right: number): void;
    setJaw(open: number): void;
    setSecondaryFlex?(spineYaw: number, bankRoll: number): void;
    setCaudalFollow?(offsets: readonly number[]): void;
  },
  fsm: PilotFsmOutput,
  sec: { spineYaw: number; bankRoll: number; caudalFollow: readonly number[] } | null,
): void {
  const { rigBlend, motionOverrides } = fsm;
  if (
    motionOverrides.headOffsetPitch != null ||
    motionOverrides.headOffsetYaw != null
  ) {
    rig.setHeadOffset(
      motionOverrides.headOffsetYaw ?? 0,
      motionOverrides.headOffsetPitch ?? 0,
    );
  }
  if (motionOverrides.pectoralL != null || motionOverrides.pectoralR != null) {
    rig.setPectoral(motionOverrides.pectoralL ?? 0, motionOverrides.pectoralR ?? 0);
  }
  if (fsm.mode.startsWith("blowhole")) {
    rig.setJaw(0);
  } else if (motionOverrides.jawOpen != null) {
    rig.setJaw(motionOverrides.jawOpen);
  }
  if (sec && rigBlend.swim >= 0.5 && rig.setSecondaryFlex && rig.setCaudalFollow) {
    if (fsm.mode !== "breach_air" && fsm.mode !== "blowhole_squirt") {
      rig.setSecondaryFlex(sec.spineYaw * rigBlend.swim, sec.bankRoll * rigBlend.swim);
      rig.setCaudalFollow(sec.caudalFollow);
    }
  }
}

function computeMotionOverrides(
  mode: PilotMode,
  breachCharge: number,
  blowholeCharge: number,
): MotionOverrides {
  const deg = (d: number) => (d * Math.PI) / 180;
  switch (mode) {
    case "dive":
      return {
        pitchOffsetRad: deg(-25),
        pectoralL: deg(15),
        pectoralR: deg(15),
        flukeAmpScale: 0.75,
        speedScale: 1,
      };
    case "surface":
      return {
        pitchOffsetRad: deg(15),
        headOffsetPitch: deg(3),
        pectoralL: deg(-8),
        pectoralR: deg(-8),
        flukeAmpScale: 0.75,
        speedScale: 1,
      };
    case "roll_left":
      return {
        rollOffsetRad: deg(-70),
        flukeAmpScale: 0.5,
        speedScale: 0.6,
      };
    case "roll_right":
      return {
        rollOffsetRad: deg(70),
        flukeAmpScale: 0.5,
        speedScale: 0.6,
      };
    case "boost":
      return { flukeAmpScale: 0.85, speedScale: 1 };
    case "idle":
      return { flukeAmpScale: 0.15, speedScale: 0.5 };
    case "breach_charge":
      return {
        pitchOffsetRad: deg(15),
        flukeAmpScale: Math.min(breachCharge, 0.8),
        speedScale: 0.3,
      };
    case "breach_air":
      return { flukeAmpScale: 0.3, speedScale: 0.4 };
    case "breach_land":
      return { pitchOffsetRad: 0, flukeAmpScale: 0.6, speedScale: 0.5 };
    case "blowhole_charge":
      return {
        headOffsetPitch: deg(blowholeCharge * 12),
        jawOpen: 0,
        speedScale: 0.2,
      };
    case "blowhole_squirt":
      return {
        headOffsetPitch: deg(18),
        jawOpen: 0,
        speedScale: 0,
      };
    default:
      return {};
  }
}

function performanceNow(): number {
  if (typeof performance !== "undefined") return performance.now() / 1000;
  return Date.now() / 1000;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
