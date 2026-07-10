// Atmosphere TRANSITIONS for the Console Journey (W1 Agent D).
//
// These are pure tween factories that drive a transition WITH the existing
// realism rig in `web/app/components/scene/realism/atmosphere.ts`, without
// owning or mutating any realism/ file. They operate ONLY over the THREE
// objects you pass in (a scene fog, a light), matching the realism rig's
// parameter names and units so the tween targets the same objects it manages:
//
//   - realism `makeFog()` returns a `THREE.Fog` with `color` / `near` / `far`
//     (linear distance fog, scene units). `rollInFog` eases that fog thicker
//     (pulls `far`, and optionally `near`, inward) so it reads as a soft mask
//     over the camera cut. A `THREE.FogExp2` (`density`) target is also
//     supported for callers that swap fog modes.
//   - realism `skyColor()` / `fogColorForSky()` give the sea-haze tint used at
//     low sun. `descentLighting` eases a light toward that descent look as the
//     camera drops to the water.
//
// Everything here is frame-driven: call `update(dtMs)` from the r3f render loop.
// No React state, no timers, no reaching into realism/ internals.

import * as THREE from "three";
import {
  type FogOptions,
  fogColorForSky,
  skyColor,
} from "@/app/components/scene/realism/atmosphere";

/** Easing function over normalized time t in [0, 1] returning eased [0, 1]. */
export type EasingFn = (t: number) => number;

/** Default easing: smooth ease-in-out so the mask has no hard edges. */
export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Handle returned by every transition. The caller advances the tween from its
 * render loop with `update(dtMs)`; it returns `true` while the tween is still
 * running and `false` once it has settled. `cancel()` stops it early. `done`
 * resolves when the tween completes naturally OR is cancelled, so awaiting it
 * never dangles.
 */
export interface TweenHandle {
  /** Advance by `dtMs` milliseconds. Returns true while active, false when settled. */
  update(dtMs: number): boolean;
  /** Stop the tween early and settle `done`. Leaves targets at their current values. */
  cancel(): void;
  /** True once the tween has completed or been cancelled. */
  readonly settled: boolean;
  /** Resolves when the tween completes or is cancelled. */
  readonly done: Promise<void>;
}

/** A fog object the realism rig may put on `scene.fog`. */
export type FogTarget = THREE.Fog | THREE.FogExp2;

function isLinearFog(fog: FogTarget): fog is THREE.Fog {
  return (fog as THREE.Fog).isFog === true;
}

/**
 * Core frame-driven tween. Captures its start state lazily on the first
 * `update` so the transition reads the live target value at the moment it
 * actually begins (e.g. after a camera cut), then interpolates eased progress
 * to `onTick(t)`. Pure with respect to realism/: it only calls the `onTick`
 * the factory supplied, which writes to the caller-owned target.
 */
function makeTween(
  durationMs: number,
  easing: EasingFn,
  onStart: () => void,
  onTick: (easedT: number) => void,
): TweenHandle {
  const duration = Math.max(0, durationMs);
  let elapsed = 0;
  let started = false;
  let settled = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const finish = () => {
    if (settled) return;
    settled = true;
    resolveDone();
  };

  return {
    update(dtMs: number): boolean {
      if (settled) return false;
      if (!started) {
        started = true;
        onStart();
      }
      elapsed += Math.max(0, dtMs);
      const raw = duration === 0 ? 1 : Math.min(1, elapsed / duration);
      onTick(easing(raw));
      if (raw >= 1) {
        finish();
        return false;
      }
      return true;
    },
    cancel(): void {
      finish();
    },
    get settled(): boolean {
      return settled;
    },
    done,
  };
}

function asColor(c: THREE.Color | string): THREE.Color {
  return c instanceof THREE.Color ? c.clone() : new THREE.Color(c);
}

/** Options for {@link rollInFog}. Units match realism `FogOptions`. */
export interface RollInFogOptions {
  /** Easing curve. Default {@link easeInOutCubic}. */
  easing?: EasingFn;
  /**
   * Target `far` for a linear {@link THREE.Fog} (smaller = thicker fog). Same
   * units as realism `FogOptions.far`. If omitted, eases to 40% of the fog's
   * current `far` so the cut is masked then can clear back afterward.
   */
  far?: number;
  /** Target `near` for a linear {@link THREE.Fog}. Same units as `FogOptions.near`. */
  near?: number;
  /** Target `density` for a {@link THREE.FogExp2}. If omitted, eases to 3x current. */
  density?: number;
  /** Optional fog color to cross-fade toward (e.g. sea haze). */
  color?: THREE.Color | string;
  /** Per-frame hook with eased progress in [0, 1]. */
  onUpdate?: (easedT: number) => void;
}

// Type-only acknowledgement that our near/far semantics match the realism rig.
type _FogUnitsMatchRealism = Pick<FogOptions, "near" | "far" | "color">;

/**
 * Ease fog density IN over `durationMs`, acting as a soft transition mask over a
 * camera cut. Operates on the fog object you pass (typically `scene.fog` built
 * by realism `makeFog()`), never on realism/ internals.
 *
 * For a linear `THREE.Fog` this pulls `far` (and optionally `near`) inward; for
 * a `THREE.FogExp2` it raises `density`. Optionally cross-fades the fog color.
 *
 * @example
 *   const tween = rollInFog(900, scene.fog as THREE.Fog, { far: 180 });
 *   // in the render loop: tween.update(delta * 1000);
 *   await tween.done;
 */
export function rollInFog(
  durationMs: number,
  target: FogTarget,
  opts: RollInFogOptions = {},
): TweenHandle {
  const easing = opts.easing ?? easeInOutCubic;
  const colorTo = opts.color !== undefined ? asColor(opts.color) : null;

  // Captured on first frame so we read live values after any preceding cut.
  let nearFrom = 0;
  let nearTo = 0;
  let farFrom = 0;
  let farTo = 0;
  let densityFrom = 0;
  let densityTo = 0;
  let colorFrom: THREE.Color | null = null;

  const onStart = () => {
    if (isLinearFog(target)) {
      nearFrom = target.near;
      farFrom = target.far;
      nearTo = opts.near ?? target.near;
      farTo = opts.far ?? target.far * 0.4;
    } else {
      densityFrom = target.density;
      densityTo = opts.density ?? target.density * 3;
    }
    if (colorTo) colorFrom = target.color.clone();
  };

  const onTick = (t: number) => {
    if (isLinearFog(target)) {
      target.near = nearFrom + (nearTo - nearFrom) * t;
      target.far = farFrom + (farTo - farFrom) * t;
    } else {
      target.density = densityFrom + (densityTo - densityFrom) * t;
    }
    if (colorFrom && colorTo) target.color.copy(colorFrom).lerp(colorTo, t);
    opts.onUpdate?.(t);
  };

  return makeTween(durationMs, easing, onStart, onTick);
}

/** A light (or lights) the descent tween drives. */
export type LightTarget = THREE.Light | readonly THREE.Light[];

/** Options for {@link descentLighting}. */
export interface DescentLightingOptions {
  /** Easing curve. Default {@link easeInOutCubic}. */
  easing?: EasingFn;
  /** Target light intensity. If omitted, eases to 70% of current (dimmer near water). */
  intensity?: number;
  /**
   * Target light color. If omitted, eases toward the realism sea-haze tint
   * `fogColorForSky(skyColor(elevationDeg))` so lighting matches the descent
   * atmosphere. See {@link DescentLightingOptions.elevationDeg}.
   */
  color?: THREE.Color | string;
  /**
   * Solar elevation (deg) used to derive the default descent color from the
   * realism rig. Default 4 (low sun over the water). Ignored if `color` is set.
   */
  elevationDeg?: number;
  /** Per-frame hook with eased progress in [0, 1]. */
  onUpdate?: (easedT: number) => void;
}

/**
 * Ease lighting toward the descent-to-water look over `durationMs`. Dims the
 * light(s) and tints them toward the realism sea-haze color, matching the fog
 * roll-in. Operates only on the light refs you pass.
 *
 * @example
 *   const tween = descentLighting(1200, [sunLight, ambient], { elevationDeg: 3 });
 *   // in the render loop: tween.update(delta * 1000);
 */
export function descentLighting(
  durationMs: number,
  target: LightTarget,
  opts: DescentLightingOptions = {},
): TweenHandle {
  const easing = opts.easing ?? easeInOutCubic;
  const lights: readonly THREE.Light[] = Array.isArray(target)
    ? (target as readonly THREE.Light[])
    : [target as THREE.Light];

  const colorTo =
    opts.color !== undefined
      ? asColor(opts.color)
      : fogColorForSky(skyColor(opts.elevationDeg ?? 4));

  const intensityFrom: number[] = [];
  const intensityTo: number[] = [];
  const colorFrom: THREE.Color[] = [];

  const onStart = () => {
    lights.forEach((light, i) => {
      intensityFrom[i] = light.intensity;
      intensityTo[i] = opts.intensity ?? light.intensity * 0.7;
      colorFrom[i] = light.color.clone();
    });
  };

  const onTick = (t: number) => {
    lights.forEach((light, i) => {
      light.intensity = intensityFrom[i] + (intensityTo[i] - intensityFrom[i]) * t;
      light.color.copy(colorFrom[i]).lerp(colorTo, t);
    });
    opts.onUpdate?.(t);
  };

  return makeTween(durationMs, easing, onStart, onTick);
}
