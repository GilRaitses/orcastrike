// Orca-strike terrain tint: green/tan LAND above sea level, teal→navy SEABED below.
// Fork of web/lib/scene/terrain/terrainStylist.ts scoped to this route only.
// worldUnitsPerMeter = 1 (metric tileset fit).

import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer";
import { LAND_HIGH, LAND_LOW, WATER_DEEP, WATER_SHALLOW } from "@/app/components/scene/realism/palette";

export interface OrcaStrikeTerrainStyleHandle {
  dispose(): void;
}

const ORIGINAL_MATERIAL_KEY = "__orcaStrikeTerrainOriginal";

interface Uniforms {
  uLandLow: { value: THREE.Color };
  uLandHigh: { value: THREE.Color };
  uShore: { value: THREE.Color };
  uWaterShallow: { value: THREE.Color };
  uWaterDeep: { value: THREE.Color };
  uRock: { value: THREE.Color };
  uMaxSubDepthY: { value: number };
  uShoreBandY: { value: number };
  uSlopeThreshold: { value: number };
  uSlopeSoftness: { value: number };
  uTintStrength: { value: number };
}

export function applyOrcaStrikeTerrainStyle(tiles: TilesRenderer): OrcaStrikeTerrainStyleHandle {
  const uniforms: Uniforms = {
    uLandLow: { value: LAND_LOW.clone() },
    uLandHigh: { value: LAND_HIGH.clone() },
    uShore: { value: new THREE.Color("#c4b08a") },
    uWaterShallow: { value: WATER_SHALLOW.clone() },
    uWaterDeep: { value: WATER_DEEP.clone() },
    uRock: { value: new THREE.Color("#5a5650") },
    uMaxSubDepthY: { value: 140 },
    uShoreBandY: { value: 18 },
    uSlopeThreshold: { value: 0.55 },
    uSlopeSoftness: { value: 0.18 },
    uTintStrength: { value: 0.96 },
  };

  const createdMaterials = new Set<THREE.Material>();
  const styledMeshes = new Set<THREE.Mesh>();

  function patchMaterial(source: THREE.Material): THREE.Material {
    const clone = source.clone();
    clone.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = injectVertex(shader.vertexShader);
      shader.fragmentShader = injectFragment(shader.fragmentShader);
    };
    clone.customProgramCacheKey = () => "orca-strike-terrain";
    if ("roughness" in clone) {
      (clone as THREE.MeshStandardMaterial).roughness = 0.92;
    }
    clone.needsUpdate = true;
    createdMaterials.add(clone);
    return clone;
  }

  function styleMesh(mesh: THREE.Mesh): void {
    if (mesh.userData[ORIGINAL_MATERIAL_KEY] !== undefined) return;
    const original = mesh.material;
    if (Array.isArray(original)) {
      mesh.userData[ORIGINAL_MATERIAL_KEY] = original;
      mesh.material = original.map((m) => patchMaterial(m));
    } else {
      mesh.userData[ORIGINAL_MATERIAL_KEY] = original;
      mesh.material = patchMaterial(original);
    }
    styledMeshes.add(mesh);
  }

  function restoreMesh(mesh: THREE.Mesh): void {
    const original = mesh.userData[ORIGINAL_MATERIAL_KEY] as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (original === undefined) return;
    const current = mesh.material;
    if (Array.isArray(current)) {
      current.forEach((m) => {
        if (createdMaterials.has(m)) {
          m.dispose();
          createdMaterials.delete(m);
        }
      });
    } else if (createdMaterials.has(current)) {
      current.dispose();
      createdMaterials.delete(current);
    }
    mesh.material = original;
    delete mesh.userData[ORIGINAL_MATERIAL_KEY];
    styledMeshes.delete(mesh);
  }

  function styleScene(root: THREE.Object3D): void {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) styleMesh(o);
    });
  }

  const onLoadModel = (e: { scene: THREE.Object3D }) => styleScene(e.scene);
  const onDisposeModel = (e: { scene: THREE.Object3D }) => {
    e.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) restoreMesh(o);
    });
  };

  tiles.addEventListener("load-model", onLoadModel);
  tiles.addEventListener("dispose-model", onDisposeModel);
  tiles.forEachLoadedModel((scene) => styleScene(scene));

  return {
    dispose() {
      tiles.removeEventListener("load-model", onLoadModel);
      tiles.removeEventListener("dispose-model", onDisposeModel);
      for (const mesh of Array.from(styledMeshes)) restoreMesh(mesh);
      for (const m of Array.from(createdMaterials)) {
        m.dispose();
        createdMaterials.delete(m);
      }
    },
  };
}

function injectVertex(src: string): string {
  let out = src;
  out = out.replace(
    "#include <common>",
    "#include <common>\nvarying vec3 vTerrainWorldPos;\nvarying vec3 vTerrainWorldNormal;",
  );
  out = out.replace(
    "#include <beginnormal_vertex>",
    "#include <beginnormal_vertex>\nvTerrainWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );",
  );
  out = out.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\nvTerrainWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;",
  );
  return out;
}

function injectFragment(src: string): string {
  const header = `#include <common>
uniform vec3 uLandLow;
uniform vec3 uLandHigh;
uniform vec3 uShore;
uniform vec3 uWaterShallow;
uniform vec3 uWaterDeep;
uniform vec3 uRock;
uniform float uMaxSubDepthY;
uniform float uShoreBandY;
uniform float uSlopeThreshold;
uniform float uSlopeSoftness;
uniform float uTintStrength;
varying vec3 vTerrainWorldPos;
varying vec3 vTerrainWorldNormal;`;

  const tint = `#include <color_fragment>
{
  float terrainY = vTerrainWorldPos.y;
  vec3 terrainN = normalize( vTerrainWorldNormal );
  float upDot = clamp( dot( terrainN, vec3( 0.0, 1.0, 0.0 ) ), 0.0, 1.0 );
  vec3 biome;

  if ( terrainY < 0.0 ) {
    float depthM = -terrainY;
    float subT = smoothstep( 0.0, uMaxSubDepthY, depthM );
    biome = mix( uWaterShallow, uWaterDeep, subT );
    float rockMask = 1.0 - smoothstep(
      uSlopeThreshold - uSlopeSoftness,
      uSlopeThreshold + uSlopeSoftness,
      upDot
    );
    biome = mix( biome, uRock * 0.85, rockMask * 0.65 );
  } else {
    float elevT = smoothstep( 0.0, 280.0, terrainY );
    biome = mix( uLandLow, uLandHigh, elevT );
    float shoreMask = ( 1.0 - smoothstep( 0.0, uShoreBandY, terrainY ) ) * upDot;
    biome = mix( biome, uShore, shoreMask * 0.85 );
    float rockMask = 1.0 - smoothstep(
      uSlopeThreshold - uSlopeSoftness,
      uSlopeThreshold + uSlopeSoftness,
      upDot
    );
    biome = mix( biome, uRock, rockMask * 0.7 );
  }

  diffuseColor.rgb = mix( diffuseColor.rgb, biome, uTintStrength );
}`;

  let out = src;
  out = out.replace("#include <common>", header);
  out = out.replace("#include <color_fragment>", tint);
  return out;
}
