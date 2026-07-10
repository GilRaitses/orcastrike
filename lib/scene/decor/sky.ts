// Scenic Decorator: a physical sky dome for the Salish Sea twin.
//
// Wraps the three.js core `Sky` addon (the Preetham analytic daylight model)
// shipped under `three/addons/objects/Sky.js`. That addon is part of the three
// distribution already vendored with `three`, the same import family as the
// `three/addons/libs/meshopt_decoder.module.js` the tiles hook uses, so it adds
// NO new npm dependency and respects the no-new-engine lock (B.1).
//
// The dome is one BackSide mesh, one draw call, no post-processing. It is driven
// from the existing realism `makeSun().direction` so the sky, the directional
// light, and the water glitter all agree on where the sun is. A flat-gradient
// fallback dome is provided behind an option for low-end devices.
//
// Honesty: the sky is an atmosphere effect, not a measured sky.
//
// Ownership: web/lib/scene/decor/ only. Reads `skyColor` / `fogColorForSky` from
// the realism public barrel. Does NOT edit realism/ internals and does NOT set
// scene.background itself; the phase-B integrator decides background ownership
// (see WIRING-decor.md). This module returns an Object3D the integrator mounts.

import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { fogColorForSky, skyColor } from "@/app/components/scene/realism";

export type SkyDomeMode = "preetham" | "gradient";

export interface SkyDomeOptions {
  /**
   * "preetham" (default) wraps the core three `Sky` addon. "gradient" builds a
   * cheap flat-gradient fallback dome for low-end devices, with no atmospheric
   * scattering math.
   */
  mode?: SkyDomeMode;
  /** Preetham turbidity (haze). Default 6, a mild marine haze. */
  turbidity?: number;
  /** Preetham Rayleigh scattering scale (blue sky strength). Default 2.5. */
  rayleigh?: number;
  /** Preetham Mie coefficient (sun-halo strength). Default 0.005. */
  mieCoefficient?: number;
  /** Preetham Mie directional g (forward scatter). Default 0.8. */
  mieDirectionalG?: number;
  /**
   * Uniform dome scale. The Sky shader forces fragments to the far plane, so the
   * scale only needs to enclose every camera position. Default 450000, matching
   * the canonical three example, which is well beyond the live far plane.
   */
  scale?: number;
  /**
   * Initial sun direction (unit vector toward the sun, SalishScene frame). If
   * omitted the dome starts with a high noon sun and the integrator calls
   * `setSun` from the rig's pinned sun.
   */
  sunDirection?: THREE.Vector3;
}

export interface SkyDomeHandle {
  /** The dome mesh to mount with `<primitive object={handle.object3D} />`. */
  object3D: THREE.Object3D;
  /**
   * Point the sky at a sun direction (unit vector toward the sun in the
   * SalishScene frame: +X east, +Y up, -Z north). Drives the Preetham
   * `sunPosition` uniform, or the fallback gradient colors.
   */
  setSun(direction: THREE.Vector3): void;
  /** Dispose the dome geometry and material. */
  dispose(): void;
}

const DEFAULTS = {
  mode: "preetham" as SkyDomeMode,
  turbidity: 6,
  rayleigh: 2.5,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  scale: 450000,
};

const RAD = 180 / Math.PI;

/** Solar elevation in degrees from a (toward-sun) unit direction's Y component. */
function elevationDegFromDir(direction: THREE.Vector3): number {
  const y = Math.max(-1, Math.min(1, direction.clone().normalize().y));
  return Math.asin(y) * RAD;
}

function makePreethamDome(opts: SkyDomeOptions): SkyDomeHandle {
  const sky = new Sky();
  sky.scale.setScalar(opts.scale ?? DEFAULTS.scale);
  sky.name = "decor-sky-preetham (atmosphere effect, not a measured sky)";
  sky.userData.atmosphereEffect = true;
  sky.userData.label = "atmosphere effect, not a measured sky";
  // The dome encloses the camera and is drawn at the far plane; never cull it.
  sky.frustumCulled = false;

  const u = sky.material.uniforms;
  u.turbidity.value = opts.turbidity ?? DEFAULTS.turbidity;
  u.rayleigh.value = opts.rayleigh ?? DEFAULTS.rayleigh;
  u.mieCoefficient.value = opts.mieCoefficient ?? DEFAULTS.mieCoefficient;
  u.mieDirectionalG.value = opts.mieDirectionalG ?? DEFAULTS.mieDirectionalG;

  const setSun = (direction: THREE.Vector3) => {
    (u.sunPosition.value as THREE.Vector3).copy(direction).normalize();
  };
  setSun(opts.sunDirection ?? new THREE.Vector3(0, 1, 0));

  return {
    object3D: sky,
    setSun,
    dispose() {
      sky.geometry.dispose();
      sky.material.dispose();
    },
  };
}

function makeGradientDome(opts: SkyDomeOptions): SkyDomeHandle {
  // A large inward-facing sphere with a vertical gradient between the sea-haze
  // horizon tint and the realism zenith sky color. No scattering, cheap.
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const uniforms: { [k: string]: THREE.IUniform } = {
    topColor: { value: new THREE.Color("#9fc4e0") },
    bottomColor: { value: new THREE.Color("#9fb8cc") },
    // Gradient exponent: how tightly the haze hugs the horizon.
    offset: { value: 0.0 },
    exponent: { value: 0.8 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float t = pow(clamp(h, 0.0, 1.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }`,
  });

  const dome = new THREE.Mesh(geometry, material);
  dome.scale.setScalar(opts.scale ?? DEFAULTS.scale);
  dome.name = "decor-sky-gradient (atmosphere effect, not a measured sky)";
  dome.userData.atmosphereEffect = true;
  dome.userData.label = "atmosphere effect, not a measured sky";
  dome.frustumCulled = false;

  const setSun = (direction: THREE.Vector3) => {
    const elev = elevationDegFromDir(direction);
    const sky = skyColor(elev);
    (uniforms.topColor.value as THREE.Color).copy(sky);
    (uniforms.bottomColor.value as THREE.Color).copy(fogColorForSky(sky));
  };
  setSun(opts.sunDirection ?? new THREE.Vector3(0, 1, 0));

  return {
    object3D: dome,
    setSun,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Build a sky dome driven by the realism sun. Mount the returned `object3D` once
 * and call `setSun(sun.direction)` whenever the sun moves (e.g. each frame from
 * the rig's pinned `SCENE_TIME` sun). The phase-B integrator should let this
 * dome own the background by passing `background: false` to `applyRealism`, so
 * the realism flat background and the dome do not fight (see WIRING-decor.md).
 */
export function makeSkyDome(opts: SkyDomeOptions = {}): SkyDomeHandle {
  const mode = opts.mode ?? DEFAULTS.mode;
  return mode === "gradient" ? makeGradientDome(opts) : makePreethamDome(opts);
}
