"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { makeSkyDome } from "@/lib/scene/decor";
import { fogColorForSky, skyColor } from "@/app/components/scene/realism/atmosphere";
import type { TilesRenderer } from "3d-tiles-renderer";
import { applyOrcaStrikeTerrainStyle } from "./orcaStrikeTerrainStyle";

const UNDERWATER_FOG = new THREE.Color("#0c5264");

interface SceneAtmosphereProps {
  sunDirection: THREE.Vector3;
  sunElevationDeg: number;
  tiles: TilesRenderer | null;
  bathyFailed: boolean;
}

/** Sky dome above the surface, dark-green underwater volume below, terrain tint. */
export function SceneAtmosphere({
  sunDirection,
  sunElevationDeg,
  tiles,
  bathyFailed,
}: SceneAtmosphereProps): null {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const skyHandle = useMemo(
    () => makeSkyDome({ sunDirection, mode: "gradient" }),
    [sunDirection],
  );

  const skyRef = useRef(skyHandle.object3D);
  // Distance fog is deliberately long: shorelines need to remain readable from
  // a submerged chase camera, while the water surface/colour provides the depth cue.
  const underwaterFogRef = useRef(new THREE.Fog(UNDERWATER_FOG.clone(), 95, 720));
  const airFogRef = useRef(
    new THREE.Fog(
      fogColorForSky(skyColor(sunElevationDeg)),
      140,
      520,
    ),
  );

  useEffect(() => {
    skyRef.current = skyHandle.object3D;
    scene.add(skyHandle.object3D);
    skyHandle.setSun(sunDirection);
    return () => {
      scene.remove(skyHandle.object3D);
      skyHandle.dispose();
    };
  }, [scene, skyHandle, sunDirection]);

  useEffect(() => {
    if (!tiles || bathyFailed) return undefined;
    const handle = applyOrcaStrikeTerrainStyle(tiles);
    return () => handle.dispose();
  }, [tiles, bathyFailed]);

  useFrame(() => {
    const belowSurface = camera.position.y < 0.35;
    // Make the waterline readable from below: a bright gradient band at y=0
    // is handled by SeaSurface while this blue haze establishes the volume.
    // Keep the sunny sky dome present underwater too: the surface film tints it,
    // but the player can still orient toward daylight rather than a black ceiling.
    skyHandle.object3D.visible = true;

    if (belowSurface) {
      scene.background = skyColor(sunElevationDeg).clone();
      scene.fog = underwaterFogRef.current;
    } else {
      scene.background = skyColor(sunElevationDeg).clone();
      scene.fog = airFogRef.current;
    }
  });

  return null;
}
