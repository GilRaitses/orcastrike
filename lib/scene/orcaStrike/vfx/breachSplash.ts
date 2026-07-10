// STRIKE-W2c — breach splash VFX stub. Pure spec factory; scene/r3f consumes props.

export type BreachSplashKind = "exit" | "entry";

export interface BreachSplashSpec {
  id: string;
  position: { x: number; y: number; z: number };
  kind: BreachSplashKind;
  /** 0–1 scaled from breach charge at trigger. */
  intensity: number;
  durationS: number;
  startTimeS: number;
  /** Suggested particle count for r3f instancing. */
  particleCount: number;
  /** Upward bias for exit splashes, downward damp for entry. */
  velocityBiasY: number;
}

export interface BreachSplashTriggerOpts {
  position: { x: number; y: number; z: number };
  kind: BreachSplashKind;
  intensity?: number;
  sceneElapsedS: number;
  id?: string;
}

let splashCounter = 0;

/**
 * Create a splash spec the scene can pass to a particle system in W3/W4.
 * No Three.js import by design.
 */
export function triggerBreachSplash(opts: BreachSplashTriggerOpts): BreachSplashSpec {
  const intensity = clamp01(opts.intensity ?? 0.7);
  const isExit = opts.kind === "exit";
  return {
    id: opts.id ?? `breach-splash-${++splashCounter}`,
    position: { ...opts.position },
    kind: opts.kind,
    intensity,
    durationS: isExit ? 0.55 + intensity * 0.35 : 0.75 + intensity * 0.45,
    startTimeS: opts.sceneElapsedS,
    particleCount: Math.round(24 + intensity * 48),
    velocityBiasY: isExit ? 4.5 + intensity * 3.5 : -1.5,
  };
}

/** Normalized splash strength 0–1 at scene time (pure). */
export function breachSplashStrengthAt(spec: BreachSplashSpec, sceneElapsedS: number): number {
  const age = sceneElapsedS - spec.startTimeS;
  if (age < 0 || age > spec.durationS) return 0;
  const t = age / spec.durationS;
  return spec.intensity * (1 - t) * (spec.kind === "exit" ? 1 : 0.85);
}

/** r3f-friendly prop bag derived from spec (optional convenience). */
export interface BreachSplashR3fProps {
  key: string;
  position: [number, number, number];
  visible: boolean;
  scale: number;
  opacity: number;
}

export function breachSplashToR3fProps(
  spec: BreachSplashSpec,
  sceneElapsedS: number,
): BreachSplashR3fProps {
  const strength = breachSplashStrengthAt(spec, sceneElapsedS);
  return {
    key: spec.id,
    position: [spec.position.x, spec.position.y, spec.position.z],
    visible: strength > 0.01,
    scale: 1 + spec.intensity * 2.5 * strength,
    opacity: strength,
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
