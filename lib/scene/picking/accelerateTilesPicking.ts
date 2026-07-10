// Wave 2 picking-perf (terrain+bathymetry coastal twin charter): BVH-accelerated
// raycasting for the streamed 3D tiles. The NASA-AMMOS `3d-tiles-renderer`
// delivers a fresh `THREE.Mesh` per tile on each `load-model` event; brute-force
// `Mesh.raycast` over every triangle of a multi-tile terrain surface is the cost
// the picking path cannot afford at interactive rates. `three-mesh-bvh` builds a
// bounds tree per geometry and swaps in an accelerated raycast so a click resolves
// against a logarithmic traversal instead of a linear triangle scan.
//
// This module installs the prototype patches once, computes a bounds tree for
// every tile mesh as it streams in, and returns a cleanup function that detaches
// the listener, disposes the trees that were built, and restores the original
// `THREE.Mesh.prototype.raycast`.

import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import type { TilesRenderer } from "3d-tiles-renderer";

// The original mesh raycast, captured the first time `accelerateTilesPicking`
// installs the accelerated one so cleanup can restore the unpatched behaviour.
let originalMeshRaycast: typeof THREE.Mesh.prototype.raycast | null = null;

function installPrototypePatches(): void {
  // `three-mesh-bvh`'s `acceleratedRaycast` falls back to the stock behaviour for
  // any geometry without a `boundsTree`, so installing it globally is safe even
  // for non-tile meshes in the scene.
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  if (originalMeshRaycast === null) {
    originalMeshRaycast = THREE.Mesh.prototype.raycast;
  }
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

function buildBoundsTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry && !mesh.geometry.boundsTree) {
      mesh.geometry.computeBoundsTree();
    }
  });
}

function disposeBoundsTreeIn(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry && mesh.geometry.boundsTree) {
      mesh.geometry.disposeBoundsTree();
    }
  });
}

/**
 * Install BVH-accelerated picking on a `TilesRenderer`. On every `load-model`
 * the new tile's mesh geometries get a bounds tree, and `THREE.Mesh.prototype`
 * is patched to use the accelerated raycast. Mount the renderer's `tiles.group`
 * as usual and raycast it; hits resolve through the BVH.
 *
 * Returns a cleanup function: call it on unmount to remove the listener, dispose
 * the bounds trees that were built for currently loaded models, and restore the
 * original `THREE.Mesh.prototype.raycast`.
 */
export function accelerateTilesPicking(tiles: TilesRenderer): () => void {
  installPrototypePatches();

  // A tile may already be loaded when picking is wired (e.g. the root tile from a
  // synchronous tileset), so build trees for what is present, then keep up with
  // each subsequent `load-model`.
  tiles.forEachLoadedModel((scene) => buildBoundsTree(scene));

  const onLoadModel = (event: { scene: THREE.Object3D }) => {
    buildBoundsTree(event.scene);
  };
  tiles.addEventListener("load-model", onLoadModel);

  return () => {
    tiles.removeEventListener("load-model", onLoadModel);
    tiles.forEachLoadedModel((scene) => disposeBoundsTreeIn(scene));
    if (originalMeshRaycast !== null) {
      THREE.Mesh.prototype.raycast = originalMeshRaycast;
    }
  };
}
