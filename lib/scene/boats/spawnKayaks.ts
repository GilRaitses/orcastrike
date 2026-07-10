import type { Kayak } from "./KayakEntity";

export interface SpawnKayaksOptions {
  count?: number;
  centerX?: number;
  centerZ?: number;
  minRadius?: number;
  maxRadius?: number;
  seed?: number;
}

// Closer in than the boats' 14-54 spawn band, so a player cruising out from
// spawn passes kayaks first, boats further out.
export const DEFAULT_KAYAK_COUNT = 4;
export const DEFAULT_KAYAK_MIN_RADIUS = 6;
export const DEFAULT_KAYAK_MAX_RADIUS = 26;

const TAU = Math.PI * 2;

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function randomForSeed(seed: number | undefined): () => number {
  return seed === undefined ? Math.random : mulberry32(seed);
}

export function spawnKayaks(options: SpawnKayaksOptions = {}): Kayak[] {
  const {
    count = DEFAULT_KAYAK_COUNT,
    centerX = 0,
    centerZ = 0,
    minRadius = DEFAULT_KAYAK_MIN_RADIUS,
    maxRadius = DEFAULT_KAYAK_MAX_RADIUS,
    seed,
  } = options;
  const random = randomForSeed(seed);
  const safeCount = Math.max(0, Math.floor(count));
  const lowerRadius = Math.max(0, Math.min(minRadius, maxRadius));
  const upperRadius = Math.max(0, Math.max(minRadius, maxRadius));

  const kayaks: Kayak[] = [];

  for (let index = 0; index < safeCount; index += 1) {
    const angle = random() * TAU;
    const radiusMix = random();
    const radius = Math.sqrt(
      lowerRadius * lowerRadius +
        radiusMix * (upperRadius * upperRadius - lowerRadius * lowerRadius),
    );

    kayaks.push({
      id: `kayak-${index + 1}`,
      x: centerX + Math.cos(angle) * radius,
      z: centerZ + Math.sin(angle) * radius,
      heading: random() * TAU,
    });
  }

  return kayaks;
}
