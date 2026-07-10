import type { Boat } from "./BoatEntity";

export function checkRamCollisions(
  orcaX: number,
  orcaZ: number,
  boats: readonly Boat[],
  extraRadius = 0,
): string[] {
  const hits: string[] = [];

  for (const boat of boats) {
    if (boat.state !== "floating") {
      continue;
    }

    const radius = boat.collisionRadius + extraRadius;
    const dx = boat.x - orcaX;
    const dz = boat.z - orcaZ;

    if (dx * dx + dz * dz <= radius * radius) {
      hits.push(boat.id);
    }
  }

  return hits;
}
