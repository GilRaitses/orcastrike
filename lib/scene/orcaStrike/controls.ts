// STRIKE-W2e — StrikeControls sampler. STRIKE-specific keys (Q/E/B/O/Space/F)
// plus W/S/A/D roll/thrust remapped from the HUNT OrcaPilotInput sampler.
// Does NOT edit orcaPilot/input.ts.

import type { OrcaPilotInput } from "../orcaPilot/input";
import type { StrikeControls } from "./types";

export interface StrikeControlsSampler {
  /** Advance one frame from merged raw pilot input; returns StrikeControls. */
  tick(raw: OrcaPilotInput): StrikeControls;
  dispose(): void;
}

const DIVE_CODES = new Set(["KeyQ"]);
const SURFACE_CODES = new Set(["KeyE"]);
const ROLL_LEFT_CODES = new Set(["KeyA", "ArrowLeft"]);
const ROLL_RIGHT_CODES = new Set(["KeyD", "ArrowRight"]);
const BREACH_CODES = new Set(["Space"]);
const BLOWHOLE_CODES = new Set(["KeyB"]);
const SONAR_CODES = new Set(["KeyO"]);
const RADAR_CODES = new Set(["KeyF"]);

/**
 * Construct a browser-bound StrikeControls sampler. Registers window key
 * listeners for STRIKE-only bindings; W/S/boost/mouse come from the existing
 * OrcaPilotInput sampler passed into `tick()`.
 *
 * CLIENT-ONLY: construct inside a useEffect in a "use client" component.
 */
export function createStrikeControlsSampler(): StrikeControlsSampler {
  let dive = false;
  let surface = false;
  let rollLeft = false;
  let rollRight = false;
  let breachHeld = false;
  let blowholeEdge = false;
  let sonarEdge = false;
  let radarEdge = false;

  function onKeyDown(e: KeyboardEvent): void {
    if (DIVE_CODES.has(e.code)) dive = true;
    else if (SURFACE_CODES.has(e.code)) surface = true;
    else if (ROLL_LEFT_CODES.has(e.code)) {
      rollLeft = true;
      rollRight = false;
    } else if (ROLL_RIGHT_CODES.has(e.code)) {
      rollRight = true;
      rollLeft = false;
    } else if (BREACH_CODES.has(e.code)) breachHeld = true;
    else if (BLOWHOLE_CODES.has(e.code)) blowholeEdge = true;
    else if (SONAR_CODES.has(e.code)) sonarEdge = true;
    else if (RADAR_CODES.has(e.code)) radarEdge = true;
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (DIVE_CODES.has(e.code)) dive = false;
    else if (SURFACE_CODES.has(e.code)) surface = false;
    else if (ROLL_LEFT_CODES.has(e.code)) rollLeft = false;
    else if (ROLL_RIGHT_CODES.has(e.code)) rollRight = false;
    else if (BREACH_CODES.has(e.code)) breachHeld = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    tick(raw: OrcaPilotInput): StrikeControls {
      const controls: StrikeControls = {
        forward: raw.forward,
        reverse: raw.back,
        dive,
        surface,
        rollLeft,
        rollRight,
        breachMash: breachHeld,
        blowholeTap: blowholeEdge,
        sonarEmit: sonarEdge,
        radarPing: radarEdge,
        yawDelta: raw.yawDelta,
        pitchDelta: raw.pitchDelta,
        boost: raw.boost,
      };
      blowholeEdge = false;
      sonarEdge = false;
      radarEdge = false;
      return controls;
    },
    dispose(): void {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}

/** Zeroed controls for countdown / replay phases (W3). */
export function emptyStrikeControls(): StrikeControls {
  return {
    forward: false,
    reverse: false,
    dive: false,
    surface: false,
    rollLeft: false,
    rollRight: false,
    breachMash: false,
    blowholeTap: false,
    sonarEmit: false,
    radarPing: false,
    yawDelta: 0,
    pitchDelta: 0,
    boost: false,
  };
}
