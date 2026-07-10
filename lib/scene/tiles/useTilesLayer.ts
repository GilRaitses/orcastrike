// Reusable terrain+bathymetry tiles layer for the orcast Salish scene.
//
// This is the Wave 2 productionization of the Wave 1 sandbox hook
// `web/app/(sandbox)/tiles3d/useTilesRenderer.ts`. It keeps the same imperative
// `3d-tiles-renderer` lifecycle inside the react-three-fiber loop (construct on
// url -> register plugins -> per-frame setResolutionFromRenderer + update ->
// dispose) and adds the mount-transform and fit-to-frame behavior the
// integrator needs to drop a real-meters tileset into the synthetic
// SCENE_WIDTH frame without migrating the scene to metric coordinates.
//
// Ownership: web/lib/scene/tiles/ only. The integrator wires this into
// SalishScene.tsx; this file never imports or edits the convergence files.

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { TilesRenderer } from "3d-tiles-renderer";
import { GLTFExtensionsPlugin, ImplicitTilingPlugin } from "3d-tiles-renderer/plugins";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import * as THREE from "three";

export interface UseTilesLayerOptions {
  /** Tileset root URL (tileset.json). The integrator passes the orcast pilot/full URL. */
  url: string;
  /** Screen-space error target in pixels. Lower = more detail / more tiles. */
  errorTarget?: number;
  /** Cap LoD depth (Infinity = load to leaves as the error target demands). */
  maxDepth?: number;
  /** When false, the per-frame `update()` is skipped (tiles freeze and never stream). */
  enabled?: boolean;
  /** Flag loaded tile meshes as shadow casters/receivers so r3f shadows include them. */
  enableShadows?: boolean;
  /**
   * Rotation (radians) applied to `tiles.group.rotation.x` to map 3D-Tiles z-up
   * to three.js y-up. Default `-Math.PI / 2`. See WIRING-pilot.md.
   */
  groupRotationX?: number;
  /**
   * When a number, on first tileset load the group is uniformly scaled so the
   * runtime bounding-sphere DIAMETER equals this many scene units, then recentered
   * HORIZONTALLY so the sphere center's X/Z sit at the world origin. The VERTICAL
   * axis is NOT recentered to the sphere center (the elevation midpoint, about
   * +178 m NAVD88): the orcast tileset has no root transform and its glTF Y is
   * NAVD88 elevation in metres, so the local frame's vertical origin already IS
   * NAVD88 0 m. Leaving the vertical group position at 0 lands NAVD88 0 m at scene
   * Y 0, which is the sea-level reference the water plane and shoreline tint key
   * off (WIRING-host.md: "Root transform: none ... Y = NAVD88 elevation"). This
   * lets the caller fit a real-meters tileset into the synthetic frame
   * (SCENE_WIDTH = 120). When null, no scaling is applied. Default null.
   */
  fitScaleToWidth?: number | null;
  /**
   * Invoked once on first tileset load, after any fit scaling/recentering is
   * applied, with the resulting WORLD-space bounding sphere (so the caller can
   * frame the camera and set OrbitControls min/max distance).
   */
  onFit?: (sphere: THREE.Sphere) => void;
}

const DEFAULT_GROUP_ROTATION_X = -Math.PI / 2;

/**
 * Construct a `TilesRenderer`, sync it to the r3f camera/renderer every frame,
 * map it into the y-up scene, optionally fit it to a target width, and dispose
 * it on unmount. Returns the instance (or null until constructed); mount
 * `tiles.group` into the scene graph with `<primitive object={tiles.group} />`.
 */
export function useTilesLayer({
  url,
  errorTarget = 12,
  maxDepth = Infinity,
  enabled = true,
  enableShadows = true,
  groupRotationX = DEFAULT_GROUP_ROTATION_X,
  fitScaleToWidth = null,
  onFit,
}: UseTilesLayerOptions): TilesRenderer | null {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [tiles, setTiles] = useState<TilesRenderer | null>(null);

  // Live refs so the per-frame fit closure reads current option values without
  // tearing down and rebuilding the renderer when only the fit knobs change.
  const groupRotationXRef = useRef(groupRotationX);
  const fitScaleToWidthRef = useRef(fitScaleToWidth);
  const onFitRef = useRef(onFit);
  const fittedRef = useRef(false);
  groupRotationXRef.current = groupRotationX;
  fitScaleToWidthRef.current = fitScaleToWidth;
  onFitRef.current = onFit;

  // Lifecycle: construct on url change, dispose on unmount/change. Plugins are
  // registered here because some plugin properties are construction-time only.
  useEffect(() => {
    const instance = new TilesRenderer(url);

    // Implicit tiling: required for tilesets with subtree files; harmless for
    // explicit tilesets like the orcast pilot.
    instance.registerPlugin(new ImplicitTilingPlugin());
    // glTF/glb loader with the meshopt decoder wired so the orcast pilot
    // (EXT_meshopt_compression + KHR_mesh_quantization) loads with no further
    // changes. DRACO/KTX2 loaders can be added the same way (see WIRING).
    instance.registerPlugin(
      new GLTFExtensionsPlugin({ meshoptDecoder: MeshoptDecoder }),
    );

    // Keep r3f's frameloop awake while tiles stream in. With frameloop="always"
    // this is a no-op safety net; with frameloop="demand" it is what settles LoD.
    const needsUpdate = () => invalidate();
    instance.addEventListener("needs-update", needsUpdate);

    fittedRef.current = false;
    setTiles(instance);

    return () => {
      instance.removeEventListener("needs-update", needsUpdate);
      instance.dispose();
      setTiles(null);
    };
  }, [url, invalidate]);

  // Shadows: tile meshes are added to tiles.group at runtime (after JSX renders)
  // so r3f never configures them as casters/receivers. Set the flags on the
  // load-model event. Registered separately so toggling shadows does not rebuild
  // the renderer.
  useEffect(() => {
    if (!tiles || !enableShadows) return;
    const onLoadModel = (e: { scene: THREE.Object3D }) => {
      e.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      invalidate();
    };
    tiles.addEventListener("load-model", onLoadModel);
    return () => {
      tiles.removeEventListener("load-model", onLoadModel);
    };
  }, [tiles, enableShadows, invalidate]);

  // LoD knobs applied without rebuilding the tileset.
  useEffect(() => {
    if (!tiles) return;
    tiles.errorTarget = errorTarget;
    tiles.maxDepth = maxDepth;
    invalidate();
  }, [tiles, errorTarget, maxDepth, invalidate]);

  // z-up -> y-up mount rotation, applied without rebuilding the tileset. Changing
  // the rotation re-arms the fit so the recenter math stays consistent.
  useEffect(() => {
    if (!tiles) return;
    tiles.group.rotation.x = groupRotationX;
    fittedRef.current = false;
    invalidate();
  }, [tiles, groupRotationX, invalidate]);

  // Re-arm the fit when the target width changes so the group rescales.
  useEffect(() => {
    fittedRef.current = false;
  }, [fitScaleToWidth]);

  // Register the active camera; the renderer culls/prioritizes against it.
  useEffect(() => {
    if (!tiles) return;
    tiles.setCamera(camera);
    return () => {
      tiles.deleteCamera(camera);
    };
  }, [tiles, camera]);

  // Per-frame: push the live camera world matrix + viewport resolution into the
  // renderer, advance one LoD/stream step, then attempt the one-time fit once the
  // root tileset (and therefore its bounding volume) is available.
  useFrame(() => {
    if (!tiles || !enabled) return;
    camera.updateMatrixWorld();
    tiles.setResolutionFromRenderer(camera, gl);
    tiles.update();

    if (fittedRef.current) return;

    const sphere = new THREE.Sphere();
    if (!tiles.getBoundingSphere(sphere)) return; // root not loaded yet

    const group = tiles.group;
    group.rotation.x = groupRotationXRef.current;

    const target = fitScaleToWidthRef.current;
    if (typeof target === "number" && sphere.radius > 0) {
      // Scale so the bounding-sphere DIAMETER equals the target width.
      const scale = target / (sphere.radius * 2);
      group.scale.setScalar(scale);

      // Recenter: the matrix is composed as T * R * S, so a local point p lands
      // at position + R * (scale * p). Recenter HORIZONTALLY so the sphere center
      // lands on the world Y axis (X = Z = 0), but leave the VERTICAL position at
      // 0 rather than subtracting the sphere center's elevation. The tileset has
      // no root transform and its glTF Y is NAVD88 metres, so the local frame's
      // vertical origin is already NAVD88 0 m; with the group's -90deg X rotation
      // a local point's world Y is scale * (local elevation), so leaving position.y
      // at 0 maps NAVD88 0 m to scene Y 0 (the sea-level datum the water plane and
      // shoreline tint depend on). Subtracting rotated.y instead would drag the
      // elevation midpoint (~+178 m) to Y 0, sinking NAVD88 0 m below it (W2.6).
      const rotated = sphere.center
        .clone()
        .applyEuler(new THREE.Euler(group.rotation.x, group.rotation.y, group.rotation.z))
        .multiplyScalar(scale);
      group.position.set(-rotated.x, 0, -rotated.z);
    }

    group.updateMatrixWorld(true);
    fittedRef.current = true;

    // Report the resulting WORLD-space sphere so the caller frames the camera.
    const worldSphere = sphere.clone().applyMatrix4(group.matrixWorld);
    onFitRef.current?.(worldSphere);
    invalidate();
  });

  return tiles;
}
