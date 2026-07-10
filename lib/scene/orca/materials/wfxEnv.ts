// OMAT <-> WFX environment seam.
//
// The orca MUST be lit by the same environment as the water or it reads pasted
// in (OMAT-R section 3). WFX owns that environment; its research docs / PMREM
// publication do not exist yet, so this file defines the PROPOSED handoff
// interface (`WfxEnvHandle`, names per OMAT-R) plus a self-contained STAND-IN
// (`makeSandboxWfxEnv`) used by the /orca sandbox until WFX publishes the real
// handle. At integrate time O0 swaps the stand-in for the real WFX handle; no
// orca module changes, only the producer of this object.
//
// >>> FLAG FOR O0 / WFX COORDINATION (build-time reconciliation) <<<
//   1. WFX must publish a PMREM environment texture from its procedural sky.
//      Today only a flat scene.background color exists (applyRealism.ts). The
//      stand-in below PMREMs a procedural sky+sun gradient as a placeholder.
//   2. WFX must publish the underwater absorption vector + in-scatter color as
//      SHARED uniforms (the same numbers depthWater.ts / WATER2_TUNING_REQUEST
//      use), not a private copy, or the orca and water diverge as WFX tunes.
//   3. The WfxEnvHandle shape here is a PROPOSAL for O0 to reconcile with WFX.

import * as THREE from "three";

/** Produced by WFX, consumed by OMAT (skin) and OEYE (catch-light). */
export interface WfxEnvHandle {
  /** PMREM of the WFX procedural sky for the orca's PBR IBL (above water). */
  pmremEnvironment: THREE.Texture;
  /** Unit vector toward the sun (from realism/sun.ts makeSun().direction). */
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  /** Underwater volumetric model so the orca dims/tints to match the water. */
  underwater: {
    /** Per-channel extinction, inverse scene units (Beer-Lambert). */
    absorption: THREE.Vector3;
    /** Turbid-green Salish in-scatter color. */
    inScatterColor: THREE.Color;
    /** Scene Y of the water surface (depthWater.ts uses 0). */
    waterLevelY: number;
    /** Useful sight distance in scene units (in-scatter saturation). */
    visibility: number;
  };
  /** Free any GPU resources the stand-in allocated. No-op for a real WFX handle. */
  dispose?: () => void;
}

export interface SandboxWfxEnvOptions {
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  /** Sky color (atmosphere.skyColor(elevation)). Horizon tint. */
  skyColor: THREE.Color;
  /** PMREM generator from the live renderer. */
  pmrem: THREE.PMREMGenerator;
}

/**
 * Stand-in WFX environment for the sandbox: PMREMs a procedural sky gradient +
 * sun disc so the orca's IBL specular/diffuse comes from a sky that matches the
 * water's sky color, and supplies the underwater Beer-Lambert numbers that
 * mirror depthWater.ts / the WATER2 tuning request. Replace with the real WFX
 * handle at integrate time.
 */
export function makeSandboxWfxEnv(opts: SandboxWfxEnvOptions): WfxEnvHandle {
  // --- procedural sky scene -> PMREM ---
  const skyScene = new THREE.Scene();

  const zenith = opts.skyColor.clone().multiplyScalar(0.85);
  const horizon = opts.skyColor.clone().lerp(new THREE.Color("#dfeef5"), 0.55);

  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: zenith },
      uHorizon: { value: horizon },
      uSunDir: { value: opts.sunDirection.clone().normalize() },
      uSunColor: { value: opts.sunColor.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uZenith; uniform vec3 uHorizon;
      uniform vec3 uSunDir; uniform vec3 uSunColor;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 sky = mix(uHorizon, uZenith, smoothstep(0.45, 1.0, h));
        float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        vec3 sun = uSunColor * (pow(s, 220.0) * 6.0 + pow(s, 12.0) * 0.35);
        gl_FragColor = vec4(sky + sun, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  skyScene.add(sky);

  const target = opts.pmrem.fromScene(skyScene, 0, 0.1, 100);
  skyGeo.dispose();
  skyMat.dispose();

  return {
    pmremEnvironment: target.texture,
    sunDirection: opts.sunDirection.clone().normalize(),
    sunColor: opts.sunColor.clone(),
    sunIntensity: opts.sunIntensity,
    underwater: {
      // Per-SCENE-UNIT Beer-Lambert extinction. The WATER2_TUNING_REQUEST number
      // vec3(3.0,1.6,0.9) is per-unit in the TWIN where ~0.0024 units == 1 m, so
      // 155 m == ~0.37 units and exp(-3*0.37) tints sensibly. THIS sandbox runs
      // METRIC (1 unit == 1 m), so the same vector would extinguish the animal to
      // black; these are the equivalent per-metre values (ratio preserved: red
      // fastest, blue-green slowest). >>> FLAG O0: at integrate the REAL WFX
      // absorption applies in the twin's unit scale, NOT these sandbox numbers.
      absorption: new THREE.Vector3(0.12, 0.06, 0.035),
      inScatterColor: new THREE.Color("#15565a"),
      waterLevelY: 0,
      visibility: 18,
    },
    dispose() {
      target.dispose();
    },
  };
}

// ============================================================================
// Live WfxEnvHandle registry (ENV-handle-consolidation, BSWR-ENV).
//
// The live twin builds exactly one real WfxEnvHandle (the OrcaRig component, via
// makeRealWfxEnv in web/lib/scene/wfx/realWfxEnv.ts). OrcaRig is also the sole
// scene.environment writer. Before this registry the homepage slice baked a
// SECOND PMREM only to light its reenactment pool, because ORCA published no way
// to read the existing handle. This registry is that publication channel: OrcaRig
// pushes its live handle here after build and clears it on dispose, and the slice
// borrows it for the pool instead of baking a duplicate.
//
// Ownership and lifetime (LOCKED, ENV-Q decisions 3 + 4):
//   - OrcaRig is the SOLE owner and SOLE disposer of the handle. The registry only
//     holds a borrowed reference. It NEVER disposes, and it NEVER touches
//     scene.environment, so the single-writer invariant is preserved.
//   - Valid after build, cleared on dispose. getLiveWfxEnv returns the handle only
//     between OrcaRig's set and clear.
//   - clearLiveWfxEnv is identity-guarded: it only nulls the holder when the
//     current value is the exact handle passed, so a recompute or out-of-order
//     teardown cannot wipe a newer handle.
//   - Borrowers must NEVER call dispose on a handle read from here, and must re-key
//     (rebuild) on handle-identity change rather than mutate in place.
//
// Reactivity: getLiveWfxEnv is the snapshot and subscribeLiveWfxEnv is the
// subscribe, the pair a React consumer reads through
// useSyncExternalStore(subscribeLiveWfxEnv, getLiveWfxEnv, getLiveWfxEnv). The
// snapshot is reference-stable between notifications (it returns the module
// holder, which only changes on set/clear), so it satisfies the store contract.
// This module stays React-free; the hook call lives in the consumer.

let liveWfxEnv: WfxEnvHandle | null = null;
const liveWfxEnvListeners = new Set<() => void>();

function emitLiveWfxEnv(): void {
  for (const listener of liveWfxEnvListeners) listener();
}

/**
 * Publish the live WfxEnvHandle. Called by the owner (OrcaRig) after it builds the
 * handle. Stores a borrowed reference and notifies subscribers. Does nothing if the
 * same handle is published again. The owner remains responsible for disposal.
 */
export function setLiveWfxEnv(handle: WfxEnvHandle): void {
  if (liveWfxEnv === handle) return;
  liveWfxEnv = handle;
  emitLiveWfxEnv();
}

/**
 * Read the current live WfxEnvHandle, or null before the owner has published one
 * (or after it cleared on dispose). This is the useSyncExternalStore snapshot; it
 * is reference-stable between notifications. Borrowers must NOT dispose the handle
 * and must re-key on identity change.
 */
export function getLiveWfxEnv(): WfxEnvHandle | null {
  return liveWfxEnv;
}

/**
 * Clear the published handle on owner dispose. Identity-guarded: only nulls the
 * holder when the current value is exactly `handle`, so a stale clear cannot wipe a
 * newer handle published by a rebuild. The owner calls this BEFORE handle.dispose().
 */
export function clearLiveWfxEnv(handle: WfxEnvHandle): void {
  if (liveWfxEnv !== handle) return;
  liveWfxEnv = null;
  emitLiveWfxEnv();
}

/**
 * Subscribe to live-handle changes. Returns an unsubscribe. Paired with
 * getLiveWfxEnv for useSyncExternalStore so a React consumer re-renders when the
 * owner publishes or clears the handle.
 */
export function subscribeLiveWfxEnv(listener: () => void): () => void {
  liveWfxEnvListeners.add(listener);
  return () => {
    liveWfxEnvListeners.delete(listener);
  };
}
