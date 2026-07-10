// Self-contained solar-position helper for the Salish Sea twin (~48.5 N, -123 W).
//
// No external dependency: this is a compact implementation of the NOAA solar
// position equations (Meeus, low-precision form). The charter forbids adding
// SunCalc or any new dependency, so the sun direction is computed here.
//
// Output is mapped into the SalishScene coordinate frame (see sceneIntent.ts /
// SalishScene.tsx): X = east(+)/west(-), Y = up, Z = south(+)/north(-).
// projectToScene() makes +X east and -Z north, so a compass azimuth A
// (0 deg = north, clockwise to east) maps to a horizontal direction of
//   ( sin A, 0, -cos A ).
// With solar elevation e, the unit vector pointing TOWARD the sun (the value
// you assign to directionalLight.position, normalized) is
//   ( cos e * sin A, sin e, -cos e * cos A ).

import * as THREE from "three";

export interface SunResult {
  /** Solar elevation above the horizon, degrees (negative below horizon). */
  elevationDeg: number;
  /** Solar azimuth, degrees clockwise from true north. */
  azimuthDeg: number;
  /**
   * Unit vector pointing from the scene toward the sun, in SalishScene frame.
   * Assign (scaled) to directionalLight.position. Clamped to stay slightly
   * above the horizon when the sun is down so the scene is never pitch black.
   */
  direction: THREE.Vector3;
  /** Warm-to-cool sun color by elevation (sunrise warm, noon white). */
  color: THREE.Color;
  /** Suggested directional-light intensity in [0, ~1.2] by elevation. */
  intensity: number;
  /** Suggested ambient-light intensity in [~0.12, ~0.6] by elevation. */
  ambientIntensity: number;
  /** True when the sun is below the horizon (night / civil twilight). */
  isNight: boolean;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Compute solar position and a render-ready directional-light spec for a given
 * instant and location. Pure (no scene mutation, no globals).
 *
 * @param date UTC instant (a JS Date; its UTC fields are used).
 * @param lat  latitude, degrees north (Salish Sea ~48.5).
 * @param lng  longitude, degrees east-positive (Salish Sea ~-123).
 */
export function makeSun(date: Date, lat = 48.5, lng = -123): SunResult {
  // Julian day from the Unix epoch.
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0; // Julian centuries since J2000.0

  // Geometric mean longitude and anomaly of the sun (degrees).
  const L0 = mod360(280.46646 + T * (36000.76983 + T * 0.0003032));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  // Sun's equation of center.
  const Mr = M * DEG;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;

  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG); // apparent longitude

  // Obliquity of the ecliptic with nutation correction.
  const eps0 =
    23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * DEG);

  // Solar declination.
  const declRad = Math.asin(Math.sin(eps * DEG) * Math.sin(lambda * DEG));
  const declDeg = declRad * RAD;

  // Equation of time (minutes).
  const yv = Math.tan((eps * DEG) / 2) ** 2;
  const L0r = L0 * DEG;
  const eotRad =
    yv * Math.sin(2 * L0r) -
    2 * e * Math.sin(Mr) +
    4 * e * yv * Math.sin(Mr) * Math.cos(2 * L0r) -
    0.5 * yv * yv * Math.sin(4 * L0r) -
    1.25 * e * e * Math.sin(2 * Mr);
  const eotMin = eotRad * RAD * 4;

  // True solar time (minutes), working in UTC so timezone offset is zero.
  const minutesUTC =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let trueSolarTime = (minutesUTC + eotMin + 4 * lng) % 1440;
  if (trueSolarTime < 0) trueSolarTime += 1440;

  // Hour angle, degrees.
  const ha = trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;

  // Solar zenith / elevation.
  const latR = lat * DEG;
  const haR = ha * DEG;
  const cosZenith = clamp(
    Math.sin(latR) * Math.sin(declRad) + Math.cos(latR) * Math.cos(declRad) * Math.cos(haR),
    -1,
    1,
  );
  const zenithDeg = Math.acos(cosZenith) * RAD;
  const elevationDeg = 90 - zenithDeg;

  // Solar azimuth, degrees clockwise from north.
  let azimuthDeg: number;
  const azDenom = Math.cos(latR) * Math.sin(zenithDeg * DEG);
  if (Math.abs(azDenom) > 1e-3) {
    const azArg = clamp(
      (Math.sin(latR) * Math.cos(zenithDeg * DEG) - Math.sin(declRad)) / azDenom,
      -1,
      1,
    );
    const az = Math.acos(azArg) * RAD;
    azimuthDeg = ha > 0 ? mod360(az + 180) : mod360(540 - az);
  } else {
    azimuthDeg = lat > 0 ? 180 : 0;
  }

  // Map (elevation, azimuth) into the SalishScene frame. Floor the elevation a
  // few degrees above the horizon so the directional light never points
  // straight along the ground (which would flatten shading at night).
  const eUse = Math.max(elevationDeg, 4) * DEG;
  const aR = azimuthDeg * DEG;
  const direction = new THREE.Vector3(
    Math.cos(eUse) * Math.sin(aR),
    Math.sin(eUse),
    -Math.cos(eUse) * Math.cos(aR),
  ).normalize();

  const isNight = elevationDeg <= 0;

  // Intensity ramps with elevation; small floor at twilight.
  const elev01 = clamp(elevationDeg / 60, 0, 1); // ~saturates by 60 deg
  const intensity = isNight ? 0.15 : 0.35 + 0.85 * elev01;
  const ambientIntensity = isNight ? 0.12 : 0.2 + 0.4 * elev01;

  // Color: warm near the horizon, neutral high in the sky.
  const warm = new THREE.Color("#ffb066");
  const day = new THREE.Color("#fff4e0");
  const color = warm.clone().lerp(day, clamp(elevationDeg / 25, 0, 1));

  return {
    elevationDeg,
    azimuthDeg,
    direction,
    color,
    intensity,
    ambientIntensity,
    isNight,
  };
}

function mod360(x: number): number {
  return ((x % 360) + 360) % 360;
}
