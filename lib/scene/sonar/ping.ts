import type { SonarTarget } from "./radarTargets";

export const DEFAULT_SONAR_PING_VISIBLE_SECONDS = 7;

export interface SonarPing {
  /** Open the HUD with a snapshot of the latest ping results. */
  ping(targets: SonarTarget[]): void;
  /** Advance the ping countdown by dt seconds. */
  update(dt: number): void;
  /** Returns null when no ping is active or the snapshot has expired. */
  getVisibleTargets(): SonarTarget[] | null;
  /** Close the current ping, for example after selecting a target. */
  clear(): void;
  /** Seconds remaining before the current ping expires. */
  timeRemaining(): number;
}

export function createSonarPing(opts: { visibleSeconds?: number } = {}): SonarPing {
  const visibleSeconds = Math.max(0.1, opts.visibleSeconds ?? DEFAULT_SONAR_PING_VISIBLE_SECONDS);
  let targets: SonarTarget[] | null = null;
  let remainingSeconds = 0;

  return {
    ping(nextTargets: SonarTarget[]) {
      targets = [...nextTargets];
      remainingSeconds = visibleSeconds;
    },
    update(dt: number) {
      if (!targets) return;

      remainingSeconds = Math.max(0, remainingSeconds - Math.max(0, dt));
      if (remainingSeconds === 0) {
        targets = null;
      }
    },
    getVisibleTargets() {
      if (!targets || remainingSeconds <= 0) return null;
      return targets;
    },
    clear() {
      targets = null;
      remainingSeconds = 0;
    },
    timeRemaining() {
      return targets ? remainingSeconds : 0;
    },
  };
}
