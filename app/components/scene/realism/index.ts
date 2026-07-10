// Public API for the Salish Sea scene-realism module (Wave 1, agent A).
//
// Wave 2 integrator: import from "@/app/components/scene/realism".
// See WIRING-realism.md in this directory for the exact mount steps.

export {
  applyRealism,
  type RealismOptions,
  type RealismHandle,
} from "./applyRealism";

export { makeWater, type WaterOptions, type WaterHandle } from "./water";
export { makeSun, type SunResult } from "./sun";
export { makeFog, skyColor, fogColorForSky, type FogOptions } from "./atmosphere";
export {
  depthColor,
  oceanDepthColor,
  landElevationColor,
  WATER_SHALLOW,
  WATER_DEEP,
  LAND_LOW,
  LAND_HIGH,
  WATER_SURFACE_TINT,
} from "./palette";
