export const DEFAULT_TELEPORT_BEAT_DURATION_MS = 420;

export interface TeleportBeat {
  /** Start a teleport toward targetX/targetZ. Call once after target selection. */
  start(targetX: number, targetZ: number): void;
  /** Advance the beat by dt seconds. Call every frame while active. */
  update(dt: number): void;
  /** True while the warp flash visual should be showing. */
  isActive(): boolean;
  /** 0..1 progress through the beat. */
  progress(): number;
  /**
   * The world XZ the orca should occupy for this beat.
   *
   * This beat snaps immediately. Position is not interpolated. The returned XZ
   * is the target for the whole active beat, while flashIntensity supplies the
   * visual charge and fade. The later integrator writes this value onto the
   * actual orca controller.
   */
  currentXZ(): { x: number; z: number } | null;
  /** 0..1 visual flash intensity for a HUD overlay, sprite, or camera kick. */
  flashIntensity(): number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

export function createTeleportBeat(opts: { durationMs?: number } = {}): TeleportBeat {
  const durationMs = Math.max(1, opts.durationMs ?? DEFAULT_TELEPORT_BEAT_DURATION_MS);
  let elapsedMs = 0;
  let target: { x: number; z: number } | null = null;

  function currentProgress(): number {
    if (!target) return 1;
    return clamp01(elapsedMs / durationMs);
  }

  return {
    start(targetX: number, targetZ: number) {
      target = { x: targetX, z: targetZ };
      elapsedMs = 0;
    },
    update(dt: number) {
      if (!target) return;

      elapsedMs = Math.min(durationMs, elapsedMs + Math.max(0, dt) * 1000);
      if (elapsedMs >= durationMs) {
        target = null;
      }
    },
    isActive() {
      return target !== null;
    },
    progress() {
      return currentProgress();
    },
    currentXZ() {
      return target ? { ...target } : null;
    },
    flashIntensity() {
      if (!target) return 0;

      const p = currentProgress();
      if (p < 0.18) {
        return easeOutCubic(p / 0.18);
      }

      return 1 - easeOutCubic((p - 0.18) / 0.82);
    },
  };
}
