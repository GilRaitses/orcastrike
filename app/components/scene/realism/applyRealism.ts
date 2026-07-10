// applyRealism: the single imperative entry point the Wave 2 integrator calls.
//
// Given a THREE.Scene (the r3f scene root) it installs:
//   - sun + ambient + hemisphere lighting from makeSun() for the given date,
//   - distance fog and a sky/background color from the atmosphere helpers,
//   - the animated ocean water surface from makeWater().
//
// It returns a handle to drive the animation each frame, retarget the sun by
// date, and dispose everything on unmount. This is the one function that
// mutates the scene; the underlying makeWater/makeSun/makeFog stay pure.
//
// Built only on `three`. No new dependency.

import * as THREE from "three";
import { makeSun, type SunResult } from "./sun";
import { makeWater, type WaterHandle, type WaterOptions } from "./water";
import { makeFog, skyColor, fogColorForSky } from "./atmosphere";

export interface RealismOptions {
  /** Instant used for the sun position. Default: now. */
  date?: Date;
  /** Latitude, degrees north. Default 48.5 (Salish Sea). */
  lat?: number;
  /** Longitude, degrees east-positive. Default -123. */
  lng?: number;
  /** Distance from origin to place the directional light. Default 140. */
  sunDistance?: number;
  /** Add fog to the scene. Default true. */
  fog?: boolean;
  /** Set scene.background from the sky color. Default true. */
  background?: boolean;
  /** Add the animated water surface. Default true. */
  water?: boolean;
  /** Options forwarded to makeWater(). */
  waterOptions?: WaterOptions;
}

export interface RealismHandle {
  /** The created directional (sun) light. */
  sunLight: THREE.DirectionalLight;
  /** The created ambient light. */
  ambientLight: THREE.AmbientLight;
  /** The created hemisphere light. */
  hemisphereLight: THREE.HemisphereLight;
  /** The water surface handle (null if water disabled). */
  water: WaterHandle | null;
  /** The current solar solution. */
  sun: SunResult;
  /** Advance animation each frame; pass elapsed seconds. */
  update(elapsedSeconds: number): void;
  /** Recompute the sun for a new instant and restyle lights/sky/fog. */
  setDate(date: Date): void;
  /** Remove everything added to the scene and free GPU resources. */
  dispose(): void;
}

/**
 * Install realism (lighting, atmosphere, water) onto an existing scene.
 *
 * @param scene the THREE.Scene to augment (r3f: useThree().scene)
 * @param opts  see RealismOptions
 */
export function applyRealism(scene: THREE.Scene, opts: RealismOptions = {}): RealismHandle {
  const lat = opts.lat ?? 48.5;
  const lng = opts.lng ?? -123;
  const sunDistance = opts.sunDistance ?? 140;
  const useFog = opts.fog ?? true;
  const useBackground = opts.background ?? true;
  const useWater = opts.water ?? true;

  let sun = makeSun(opts.date ?? new Date(), lat, lng);

  const sunLight = new THREE.DirectionalLight(sun.color.getHex(), sun.intensity);
  sunLight.position.copy(sun.direction).multiplyScalar(sunDistance);
  sunLight.castShadow = true;
  sunLight.name = "realism-sun";

  const ambientLight = new THREE.AmbientLight(0xffffff, sun.ambientIntensity);
  ambientLight.name = "realism-ambient";

  // Sky-tinted hemisphere fill, echoing the live scene's hemisphereLight.
  const hemisphereLight = new THREE.HemisphereLight(0x8fc7ff, 0x0a2540, 0.4);
  hemisphereLight.name = "realism-hemisphere";

  scene.add(sunLight, ambientLight, hemisphereLight);

  let water: WaterHandle | null = null;
  if (useWater) {
    water = makeWater({ ...opts.waterOptions, sunDirection: sun.direction });
    scene.add(water.mesh);
  }

  const prevFog = scene.fog;
  const prevBackground = scene.background;

  function styleAtmosphere(s: SunResult) {
    const sky = skyColor(s.elevationDeg);
    if (useBackground) scene.background = sky;
    if (useFog) scene.fog = makeFog({ color: fogColorForSky(sky) });
  }
  styleAtmosphere(sun);

  return {
    sunLight,
    ambientLight,
    hemisphereLight,
    water,
    get sun() {
      return sun;
    },
    update(elapsedSeconds: number) {
      water?.update(elapsedSeconds);
    },
    setDate(date: Date) {
      sun = makeSun(date, lat, lng);
      sunLight.color.set(sun.color.getHex());
      sunLight.intensity = sun.intensity;
      sunLight.position.copy(sun.direction).multiplyScalar(sunDistance);
      ambientLight.intensity = sun.ambientIntensity;
      water?.setSunDirection(sun.direction);
      styleAtmosphere(sun);
    },
    dispose() {
      scene.remove(sunLight, ambientLight, hemisphereLight);
      sunLight.dispose();
      if (water) {
        scene.remove(water.mesh);
        water.dispose();
      }
      scene.fog = prevFog;
      scene.background = prevBackground;
    },
  };
}
