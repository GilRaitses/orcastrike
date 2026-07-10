// OM loader - fetch the optimized, meshopt-compressed orca glb and return a
// clean, centered geometry + its source PBR material. Framework-free (no react,
// no r3f) so it can be used by the sandbox or the later SalishScene integration.
//
// The mesh was authored by the OM-BUILD convert step to the twin frame:
//   +X forward (rostrum), +Y up (dorsal), fluke at -X, body length 7.0 m,
//   recentered on the bbox origin. See web/public/orca/LICENSE.md.
//
// ONE-LINE SWAP: change ORCA_MESH_URL to revert to the CC-BY 3.0 backup
// (`/orca/orca-poly-backup.glb`) without touching any other module.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/** Primary mesh: Trouvaille CC-BY 4.0. Swap to the backup here if O0 reverts. */
export const ORCA_MESH_URL = "/orca/orca.glb";
/** Retained CC-BY 3.0 Poly backup for a one-line hot-swap. */
export const ORCA_MESH_BACKUP_URL = "/orca/orca-poly-backup.glb";

export interface LoadedOrcaMesh {
  /** Centered, world-baked geometry (no skin attributes yet; the rig adds them). */
  geometry: THREE.BufferGeometry;
  /** The source PBR material (baseColor + normal). OMAT replaces/augments this. */
  sourceMaterial: THREE.MeshStandardMaterial;
  /** Axis-aligned bounds of the geometry, metres. */
  bbox: THREE.Box3;
}

let sharedLoader: GLTFLoader | null = null;
function orcaLoader(): GLTFLoader {
  if (!sharedLoader) {
    sharedLoader = new GLTFLoader();
    sharedLoader.setMeshoptDecoder(MeshoptDecoder);
  }
  return sharedLoader;
}

/**
 * Load and normalize the orca mesh. Bakes the source node transform into the
 * geometry so the returned geometry is already in the centered twin frame.
 */
export async function loadOrcaMesh(url: string = ORCA_MESH_URL): Promise<LoadedOrcaMesh> {
  const gltf = await orcaLoader().loadAsync(url);

  let src: THREE.Mesh | null = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
  });
  if (!src) throw new Error(`loadOrcaMesh: no mesh in ${url}`);
  const mesh = src as THREE.Mesh;

  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const srcMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
    | THREE.MeshStandardMaterial
    | undefined;
  const sourceMaterial =
    srcMat && (srcMat as THREE.MeshStandardMaterial).isMeshStandardMaterial
      ? (srcMat as THREE.MeshStandardMaterial)
      : new THREE.MeshStandardMaterial({ color: 0x888888 });

  return {
    geometry,
    sourceMaterial,
    bbox: geometry.boundingBox!.clone(),
  };
}
