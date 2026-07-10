import type { Boat } from "./BoatEntity";

export interface SinkVisualTransform {
  tiltRad: number;
  sinkY: number;
  particleBurst: boolean;
}

export const SINK_DURATION_SECONDS = 1.8;
export const MAX_SINK_TILT_RAD = Math.PI * 0.38;
export const MAX_SINK_DEPTH_Y = -2.4;
export const PARTICLE_BURST_PROGRESS = 0.2;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function advanceSink(
  boat: Boat,
  dtSeconds: number,
  durationSeconds = SINK_DURATION_SECONDS,
): Boat {
  if (boat.state === "floating") {
    return boat;
  }

  if (boat.state === "sunk") {
    return boat.sinkProgress === 1 ? boat : { ...boat, sinkProgress: 1 };
  }

  const safeDuration = Math.max(0.001, durationSeconds);
  const safeDt = Math.max(0, dtSeconds);
  const sinkProgress = clamp01(boat.sinkProgress + safeDt / safeDuration);

  return {
    ...boat,
    state: sinkProgress >= 1 ? "sunk" : "sinking",
    sinkProgress,
  };
}

export function sinkTransform(sinkProgress: number): SinkVisualTransform {
  const progress = clamp01(sinkProgress);
  const eased = progress * progress * (3 - 2 * progress);

  return {
    tiltRad: eased * MAX_SINK_TILT_RAD,
    sinkY: eased * MAX_SINK_DEPTH_Y,
    particleBurst: progress > 0 && progress <= PARTICLE_BURST_PROGRESS,
  };
}
