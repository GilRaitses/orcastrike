"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

interface TerrainRgbFallbackProps {
  /** Geographic center for the initial playable patch. */
  lat: number;
  lng: number;
  /** World-space center, aligned with the selected game spawn. */
  worldX: number;
  worldZ: number;
}

interface TerrainPatch {
  geometry: THREE.PlaneGeometry;
  texture: THREE.Texture | null;
}

const ZOOM = 11;
const GRID = 64;

function tileFor(lat: number, lng: number): { x: number; y: number } {
  const n = 2 ** ZOOM;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function metresPerTile(lat: number): number {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** ZOOM;
}

/**
 * Startup terrain patch: decodes Terrarium RGB elevation to metres per vertex
 * and drapes an imagery tile over it. The existing 3D Tiles layer continues to
 * stream the full world over this immediately available local patch.
 */
export default function TerrainRgbFallback({ lat, lng, worldX, worldZ }: TerrainRgbFallbackProps): JSX.Element | null {
  const [patch, setPatch] = useState<TerrainPatch | null>(null);
  const tile = useMemo(() => tileFor(lat, lng), [lat, lng]);

  useEffect(() => {
    let cancelled = false;
    const elevationUrl = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tile.x}/${tile.y}.png`;
    const imageryUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${ZOOM}/${tile.y}/${tile.x}`;

    async function build(): Promise<void> {
      try {
        const image = new Image();
        image.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("terrain RGB unavailable")); image.src = elevationUrl; });
        const canvas = document.createElement("canvas");
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0);
        const rgb = context.getImageData(0, 0, image.width, image.height).data;
        const sizeM = metresPerTile(lat);
        const geometry = new THREE.PlaneGeometry(sizeM, sizeM, GRID - 1, GRID - 1);
        const positions = geometry.attributes.position as THREE.BufferAttribute;
        for (let row = 0; row < GRID; row += 1) {
          for (let col = 0; col < GRID; col += 1) {
            const px = Math.min(image.width - 1, Math.round((col / (GRID - 1)) * (image.width - 1)));
            const py = Math.min(image.height - 1, Math.round((row / (GRID - 1)) * (image.height - 1)));
            const source = (py * image.width + px) * 4;
            // Terrarium encoding: elevation = R*256 + G + B/256 - 32768 metres.
            const elevationM = rgb[source] * 256 + rgb[source + 1] + rgb[source + 2] / 256 - 32768;
            positions.setZ(row * GRID + col, elevationM);
          }
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
        const texture = await new THREE.TextureLoader().loadAsync(imageryUrl).catch(() => null);
        if (texture) { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 2; }
        if (cancelled) { geometry.dispose(); texture?.dispose(); return; }
        setPatch({ geometry, texture });
      } catch {
        // Existing flat seabed remains the graceful fallback if cross-origin tiles fail.
      }
    }
    void build();
    return () => { cancelled = true; };
  }, [lat, lng, tile.x, tile.y]);

  useEffect(() => () => { patch?.geometry.dispose(); patch?.texture?.dispose(); }, [patch]);
  if (!patch) return null;
  return <mesh geometry={patch.geometry} position={[worldX, 0.04, worldZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={1}>
    <meshStandardMaterial map={patch.texture} color={patch.texture ? "#ffffff" : "#185563"} roughness={0.9} metalness={0} />
  </mesh>;
}
