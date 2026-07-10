"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { makeSkyDome } from "@/lib/scene/decor";
import { fogColorForSky, skyColor } from "@/app/components/scene/realism/atmosphere";
import type { TilesRenderer } from "3d-tiles-renderer";
import { applyOrcaStrikeTerrainStyle } from "./orcaStrikeTerrainStyle";

const UNDERWATER_BG = new THREE.Color("#0a2838");
const UNDERWATER_FOG = new THREE.Color("#1e5a68");

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
  const underwaterFogRef = useRef(new THREE.Fog(UNDERWATER_FOG.clone(), 70, 480));
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
    skyHandle.object3D.visible = !belowSurface;

    if (belowSurface) {
      scene.background = UNDERWATER_BG;
      scene.fog = underwaterFogRef.current;
    } else {
      scene.background = skyColor(sunElevationDeg).clone();
      scene.fog = airFogRef.current;
    }
  });

  return null;
}
