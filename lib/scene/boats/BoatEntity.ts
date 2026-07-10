export type BoatState = "floating" | "sinking" | "sunk";

export interface Boat {
  id: string;
  /** World-space X/Z position. World Y stays fixed at sea level. */
  x: number;
  z: number;
  /** Heading in radians. Cosmetic only. Boats are arcade props and do not track traffic. */
  heading: number;
  state: BoatState;
  /** 0 at the ramming hit, 1 when fully sunk. Meaningful once state is not floating. */
  sinkProgress: number;
  /** Collision radius in world units for the ram test. */
  collisionRadius: number;
}

export const SEA_LEVEL_Y = 0;
