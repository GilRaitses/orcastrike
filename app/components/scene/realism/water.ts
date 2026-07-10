// Animated ocean water surface for the Salish Sea twin.
//
// Replaces the flat translucent WaterPlane in SalishScene.tsx with a shaded,
// gently moving surface. The geometry is a horizontal plane sitting at sea
// level (scene Y = 0, the 0 m NAVD88 contour after the Wave 2 tiles land).
// A small sum-of-Gerstner-waves displaces the surface and produces analytic
// normals, so the water reads as ocean rather than a mirror, while staying
// cheap (no render targets, no reflections).
//
// Built only on `three` (already in web/package.json). No new dependency.

import * as THREE from "three";
import { WATER_SHALLOW, WATER_DEEP, WATER_SURFACE_TINT } from "./palette";

export interface WaterOptions {
  /** Plane width in scene units (east-west). Default mirrors SalishScene. */
  width?: number;
  /** Plane depth in scene units (north-south). */
  depth?: number;
  /** Subdivisions per axis; higher = smoother waves, more verts. Default 160. */
  segments?: number;
  /** Sea-level Y in scene units. Default 0. */
  level?: number;
  /** Shallow water tint. Default palette WATER_SHALLOW. */
  colorShallow?: THREE.Color;
  /** Deep water tint. Default palette WATER_DEEP. */
  colorDeep?: THREE.Color;
  /** Surface base opacity in [0,1]. Default 0.72. */
  opacity?: number;
  /** Peak wave amplitude in scene units. Default 0.35. */
  amplitude?: number;
  /** Wave animation speed multiplier. Default 1. */
  speed?: number;
  /** Unit vector pointing toward the sun (from makeSun().direction). */
  sunDirection?: THREE.Vector3;
}

export interface WaterHandle {
  /** The renderable mesh; add it to your scene / r3f tree. */
  mesh: THREE.Mesh;
  /** The shader material (exposed for advanced tweaks). */
  material: THREE.ShaderMaterial;
  /** Advance the animation. Pass elapsed seconds (e.g. r3f clock time). */
  update(elapsedSeconds: number): void;
  /** Update the sun direction used for specular highlights. */
  setSunDirection(dir: THREE.Vector3): void;
  /** Free GPU resources. Call on unmount. */
  dispose(): void;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uSpeed;

  varying vec3 vWorldNormal;
  varying float vHeight;
  varying vec3 vViewPosition;

  // Four Gerstner waves: vec4(dirX, dirZ, wavelength, steepness).
  const vec4 W0 = vec4( 1.0,  0.35, 18.0, 0.42);
  const vec4 W1 = vec4(-0.6,  1.0,  11.0, 0.34);
  const vec4 W2 = vec4( 0.8, -0.7,  6.5,  0.28);
  const vec4 W3 = vec4(-0.2, -1.0,  3.3,  0.20);

  vec3 gerstner(vec4 w, vec2 pos, float amp, inout vec3 normal) {
    vec2 dir = normalize(w.xy);
    float wavelength = w.z;
    float steep = w.w;
    float k = 6.2831853 / wavelength;          // wave number
    float c = sqrt(9.8 / k);                    // phase speed
    float a = amp / k;                          // per-wave amplitude
    float f = k * (dot(dir, pos) - c * uTime * uSpeed);
    float cosf = cos(f);
    float sinf = sin(f);

    // Tangent-space derivatives feed the normal accumulation.
    normal.x -= dir.x * (steep * a * k) * cosf;
    normal.z -= dir.y * (steep * a * k) * cosf;
    normal.y -= steep * (a * k) * sinf;

    return vec3(
      dir.x * (a * cosf) * steep,
      a * sinf,
      dir.y * (a * cosf) * steep
    );
  }

  void main() {
    vec3 pos = position;
    // Plane is authored in XY then rotated to XZ by the mesh; sample in plane space.
    vec2 p = position.xy;

    vec3 normal = vec3(0.0, 1.0, 0.0);
    vec3 disp = vec3(0.0);
    disp += gerstner(W0, p, uAmplitude, normal);
    disp += gerstner(W1, p, uAmplitude * 0.8, normal);
    disp += gerstner(W2, p, uAmplitude * 0.6, normal);
    disp += gerstner(W3, p, uAmplitude * 0.4, normal);

    pos.x += disp.x;
    pos.y += disp.y;
    pos.z += disp.z;

    vHeight = disp.y;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normalize(normal));

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uColorShallow;
  uniform vec3 uColorDeep;
  uniform vec3 uSurfaceTint;
  uniform vec3 uSunDirection;
  uniform float uOpacity;
  uniform float uAmplitude;

  varying vec3 vWorldNormal;
  varying float vHeight;
  varying vec3 vViewPosition;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Wave-height drives a shallow<->deep tint, then bias toward the live tint.
    float hNorm = clamp(0.5 + vHeight / max(uAmplitude * 2.0, 0.001), 0.0, 1.0);
    vec3 base = mix(uColorDeep, uColorShallow, hNorm);
    base = mix(base, uSurfaceTint, 0.35);

    // Fresnel: grazing angles brighten toward the sky.
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);

    // Sun specular (Blinn-Phong) using the provided sun direction.
    vec3 sun = normalize(uSunDirection);
    vec3 halfVec = normalize(sun + viewDir);
    float spec = pow(max(dot(n, halfVec), 0.0), 80.0);
    float diff = clamp(dot(n, sun), 0.0, 1.0);

    vec3 color = base * (0.55 + 0.45 * diff);
    color += vec3(1.0, 0.97, 0.9) * spec * 0.9;
    color = mix(color, vec3(0.62, 0.78, 0.92), fres * 0.5);

    float alpha = clamp(uOpacity + fres * 0.25, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Build an animated ocean water surface. Pure factory: it allocates Three.js
 * objects but does not mutate any scene. The caller adds `handle.mesh` and
 * drives `handle.update(t)` each frame.
 */
export function makeWater(opts: WaterOptions = {}): WaterHandle {
  const width = opts.width ?? 192; // SCENE_WIDTH(120) * 1.6
  const depth = opts.depth ?? 144;
  const segments = opts.segments ?? 160;
  const level = opts.level ?? 0;

  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uAmplitude: { value: opts.amplitude ?? 0.35 },
      uSpeed: { value: opts.speed ?? 1 },
      uColorShallow: { value: (opts.colorShallow ?? WATER_SHALLOW).clone() },
      uColorDeep: { value: (opts.colorDeep ?? WATER_DEEP).clone() },
      uSurfaceTint: { value: WATER_SURFACE_TINT.clone() },
      uSunDirection: { value: (opts.sunDirection ?? new THREE.Vector3(0.4, 0.8, 0.4)).clone().normalize() },
      uOpacity: { value: opts.opacity ?? 0.72 },
    },
  });

  const mesh = new THREE.Mesh(geometry, material);
  // Author plane in XY, rotate to XZ horizontal (same orientation as the live
  // WaterPlane: rotation [-PI/2, 0, 0]).
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = level;
  mesh.renderOrder = 1;
  mesh.name = "realism-water";

  return {
    mesh,
    material,
    update(elapsedSeconds: number) {
      material.uniforms.uTime.value = elapsedSeconds;
    },
    setSunDirection(dir: THREE.Vector3) {
      material.uniforms.uSunDirection.value.copy(dir).normalize();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
