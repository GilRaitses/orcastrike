import type { Boat } from "./BoatEntity";

export interface SpawnBoatsOptions {
  count?: number;
  centerX?: number;
  centerZ?: number;
  minRadius?: number;
  maxRadius?: number;
  collisionRadius?: number;
  seed?: number;
}

// Defaults keep toy boats inside the 120-unit scene width while leaving room
// around the spawn origin for the orca to accelerate into reachable targets.
export const DEFAULT_BOAT_COUNT = 8;
export const DEFAULT_MIN_RADIUS = 14;
export const DEFAULT_MAX_RADIUS = 54;
export const DEFAULT_BOAT_COLLISION_RADIUS = 2.2;

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

export function spawnBoats(options: SpawnBoatsOptions = {}): Boat[] {
  const {
    count = DEFAULT_BOAT_COUNT,
    centerX = 0,
    centerZ = 0,
    minRadius = DEFAULT_MIN_RADIUS,
    maxRadius = DEFAULT_MAX_RADIUS,
    collisionRadius = DEFAULT_BOAT_COLLISION_RADIUS,
    seed,
  } = options;
  const random = randomForSeed(seed);
  const safeCount = Math.max(0, Math.floor(count));
  const lowerRadius = Math.max(0, Math.min(minRadius, maxRadius));
  const upperRadius = Math.max(0, Math.max(minRadius, maxRadius));

  const boats: Boat[] = [];

  for (let index = 0; index < safeCount; index += 1) {
    const angle = random() * TAU;
    const radiusMix = random();
    const radius = Math.sqrt(
      lowerRadius * lowerRadius +
        radiusMix * (upperRadius * upperRadius - lowerRadius * lowerRadius),
    );

    boats.push({
      id: `boat-${index + 1}`,
      x: centerX + Math.cos(angle) * radius,
      z: centerZ + Math.sin(angle) * radius,
      heading: random() * TAU,
      state: "floating",
      sinkProgress: 0,
      collisionRadius,
    });
  }

  return boats;
}
