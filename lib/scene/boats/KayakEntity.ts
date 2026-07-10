// Non-combat "swim around it" prop (GTA-style civilian traffic), added
// alongside the locked HUNT-W2 Boat entity. Deliberately NOT a Boat variant:
// kayaks have no state machine, no collisionRadius, no sink animation, and
// are never passed to checkRamCollisions or buildRadarTargets. The route
// integration file (OrcaStrikeScene.tsx) is the only place that knows both
// Boat and Kayak exist.
export interface Kayak {
  id: string;
  /** World-space X/Z position. World Y stays fixed at sea level. */
  x: number;
  z: number;
  /** Heading in radians. Cosmetic only, kayaks do not move. */
  heading: number;
}
