// OMAT - wet-skin countershading material for the orca, lit by the WFX env.
//
// A MeshPhysicalMaterial (clearcoat = the wet water film) that reuses the source
// glb's painted countershading baseColor + tangent-space normal map, augmented by
// an onBeforeCompile patch that (a) makes the black dorsal read glossier than the
// pale ventral via a per-region roughness derived from albedo luminance, and (b)
// applies the SAME underwater Beer-Lambert tint + in-scatter the water uses, from
// the WfxEnvHandle, so the orca dims and tints with depth instead of staying a
// studio-lit cutout. No emissive, no cartoon rim light (charter lock).
//
// Above water the IBL comes from `scene.environment` / `envMap` = the WFX PMREM
// (set by the caller). Underwater the tint is layered on the lit color. The wet
// dielectric (IOR ~1.33-1.4) keeps its sheen via the default specular + a thin
// clearcoat; the black stays a very dark blue-grey (never crushed pure black).

import * as THREE from "three";
import type { WfxEnvHandle } from "./wfxEnv";

export interface OrcaMaterialOptions {
  /** Source painted baseColor (sRGB). Trouvaille has real countershading here. */
  map?: THREE.Texture | null;
  /** Source tangent-space normal map. */
  normalMap?: THREE.Texture | null;
  /** WFX environment for IBL + underwater tint. */
  env: WfxEnvHandle;
  /** Fallback base color when there is no painted map (the backup mesh). */
  fallbackColor?: THREE.ColorRepresentation;
}

export interface OrcaMaterialHandle {
  material: THREE.MeshPhysicalMaterial;
  /** Update the underwater uniforms each frame (or when the env retunes). */
  setEnv(env: WfxEnvHandle): void;
  dispose(): void;
}

export function makeOrcaMaterial(opts: OrcaMaterialOptions): OrcaMaterialHandle {
  const { env } = opts;

  const material = new THREE.MeshPhysicalMaterial({
    map: opts.map ?? null,
    normalMap: opts.normalMap ?? null,
    color: opts.map ? 0xffffff : (opts.fallbackColor ?? 0x0b0d10),
    metalness: 0.0,
    roughness: 0.18,
    // Wet water film: a thin, tight, smooth clearcoat lobe over the skin so the
    // black reads as a glossy near-specular dielectric, not matte rubber.
    clearcoat: 0.55,
    clearcoatRoughness: 0.06,
    // Cheap subsurface softness on the pale belly (charter-approved approximation).
    sheen: 0.3,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color("#dfe7ea"),
    // Slightly below unity so the bright sky PMREM doesn't wash the dark dorsal
    // up into flat grey; the gloss comes from a tight specular lobe, not a broad
    // diffuse env wash.
    envMapIntensity: 0.9,
  });
  material.name = "orca_wet_skin";

  if (env.pmremEnvironment) material.envMap = env.pmremEnvironment;

  // Underwater uniforms shared into the patched shader.
  const uAbsorption = { value: env.underwater.absorption.clone() };
  const uInScatter = { value: env.underwater.inScatterColor.clone() };
  const uWaterLevelY = { value: env.underwater.waterLevelY };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAbsorption = uAbsorption;
    shader.uniforms.uInScatter = uInScatter;
    shader.uniforms.uWaterLevelY = uWaterLevelY;

    // --- vertex: expose skinned world position ---
    shader.vertexShader = "varying vec3 vOrcaWorldPos;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n  vOrcaWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
    );

    // --- fragment: declarations ---
    shader.fragmentShader =
      "varying vec3 vOrcaWorldPos;\n" +
      "uniform vec3 uAbsorption;\n" +
      "uniform vec3 uInScatter;\n" +
      "uniform float uWaterLevelY;\n" +
      shader.fragmentShader;

    // (a0) countershading contrast remap. The source albedo can read as a washed
    // mid-grey under sRGB->linear; SRKW pigment is a very dark blue-grey dorsal
    // (#0b0d10, NOT crushed pure black) against crisp whites. Remap toward those
    // pigment anchors by luminance so the wet black reads regardless of how pale
    // the painted map is. Runs right after the base map is sampled (linear space).
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      {
        // linear-space pigment anchors (sRGB #0b0d10 / #e8ebec)
        const vec3 BLACK_PIG = vec3(0.0033, 0.0043, 0.0056);
        const vec3 WHITE_PIG = vec3(0.806, 0.843, 0.851);
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        // dorsal: pull dark regions hard toward the dark blue-grey pigment
        float dorsal = 1.0 - smoothstep(0.04, 0.30, lum);
        diffuseColor.rgb = mix(diffuseColor.rgb, BLACK_PIG, dorsal * 0.88);
        // ventral / eyepatch: crisp the brights without blowing them out
        float white = smoothstep(0.45, 0.78, lum);
        diffuseColor.rgb = mix(diffuseColor.rgb, WHITE_PIG, white * 0.5);
      }`,
    );

    // (a) per-region wet roughness from albedo luminance: glossy near-black
    // dorsal (tight specular lobe), slightly softer pale ventral. Runs after
    // diffuseColor is resolved (post-remap).
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      {
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        roughnessFactor = mix(0.09, 0.30, smoothstep(0.03, 0.55, lum));
      }`,
    );

    // (b) underwater Beer-Lambert tint + in-scatter on the final lit color,
    // identical optical model to the water (depthWater.ts), applied just before
    // the output color-space conversion so it tints the lit result.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <colorspace_fragment>",
      `{
        float depthBelow = max(0.0, uWaterLevelY - vOrcaWorldPos.y);
        float underwater = step(vOrcaWorldPos.y, uWaterLevelY);
        vec3 trans = exp(-uAbsorption * depthBelow);
        gl_FragColor.rgb = gl_FragColor.rgb * mix(vec3(1.0), trans, underwater)
                         + uInScatter * (1.0 - trans) * underwater;
      }
      #include <colorspace_fragment>`,
    );
  };

  return {
    material,
    setEnv(next) {
      uAbsorption.value.copy(next.underwater.absorption);
      uInScatter.value.copy(next.underwater.inScatterColor);
      uWaterLevelY.value = next.underwater.waterLevelY;
      if (next.pmremEnvironment) material.envMap = next.pmremEnvironment;
      material.needsUpdate = false; // uniforms only; no recompile needed
    },
    dispose() {
      material.dispose();
    },
  };
}
