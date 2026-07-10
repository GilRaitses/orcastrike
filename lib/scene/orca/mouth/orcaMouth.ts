// OMOU - orca mouth interior (teeth, tongue, cavity) + jaw articulation cue.
//
// A separate interior sub-mesh, hidden when the jaw is closed and revealed as the
// OR `jaw` DOF opens. The upper tooth row + gum is rigid on the head/rostrum; the
// lower tooth row + tongue ride the OR mandible (jaw) bone so they swing with the
// jaw. Teeth are conical and interlocking, ~12 per quadrant (~48 total), built as
// ONE merged geometry per row to keep draw calls at two (OMOU-R perf note). Not a
// shark grin.
//
// The open is driven by a LABELED foraging cue from OG behavior context: while a
// loaded stream is in a dive with elevated foraging intensity, the PROBABILITY of
// an occasional subtle open (8-15 deg) is raised, gated by a re-trigger interval
// and a smoothing envelope. HONESTY (hard lock, OMOU-R section 3): this is modeled
// behavior cued by biologging context, explicitly NOT "the whale is eating."

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface OrcaMouthOptions {
  /** OR head bone (upper row + cavity parent). */
  headBone: THREE.Object3D;
  /** OR jaw bone (lower row + tongue parent; swings with the jaw DOF). */
  jawBone: THREE.Object3D;
  /** Forward extent of the tooth rows in head-local X, metres. */
  rowFrontX?: number;
  rowBackX?: number;
}

export interface OrcaMouthHandle {
  group: THREE.Group;
  /**
   * OG behavior context for the open cue. `inDive` and a normalized
   * `foragingIntensity` (0..1, relative to the deployment's own distribution).
   */
  setForagingContext(inDive: boolean, foragingIntensity: number): void;
  /**
   * Advance the cue envelope and return the jaw open angle (radians) to feed
   * rig.setJaw(). Default relaxed/closed; subtle, occasional, never a snap.
   */
  update(dt: number): number;
  /** LOD far: hide interior + lock closed. */
  setVisible(on: boolean): void;
  dispose(): void;
}

const OPEN_MIN = THREE.MathUtils.degToRad(8);
const OPEN_MAX = THREE.MathUtils.degToRad(15);
const RETRIGGER_S = 6.0;

function coneRow(
  frontX: number,
  backX: number,
  y: number,
  zHalf: number,
  count: number,
  toothLen: number,
  toothR: number,
  pointDown: boolean,
): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (let side of [+1, -1]) {
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const x = THREE.MathUtils.lerp(backX, frontX, t);
      // teeth follow the rostrum taper: lateral spread narrows toward the snout.
      const z = side * zHalf * (1 - 0.45 * t);
      const c = new THREE.ConeGeometry(toothR, toothLen, 6);
      // cone points +Y by default; orient down for the upper row, up for lower.
      c.rotateX(pointDown ? Math.PI : 0);
      // slight inward curve (interlocking, not tip-to-tip).
      c.rotateZ(side * THREE.MathUtils.degToRad(8));
      c.translate(x, y + (pointDown ? -toothLen / 2 : toothLen / 2), z);
      geos.push(c);
    }
  }
  return mergeGeometries(geos, false);
}

export function makeOrcaMouth(opts: OrcaMouthOptions): OrcaMouthHandle {
  const frontX = opts.rowFrontX ?? 0.95; // head-local X near the snout tip
  const backX = opts.rowBackX ?? 0.2;
  const zHalf = 0.18;

  const toothMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#eae6dc"),
    roughness: 0.45,
    metalness: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
  });
  const gumMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#7a3b40"), roughness: 0.8 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#8a4750"), roughness: 0.7 });
  const cavityMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#160c0e"),
    roughness: 1.0,
    side: THREE.BackSide,
  });

  const group = new THREE.Group();
  group.name = "orca_mouth";

  // Upper row + gum (rigid on the head/rostrum).
  const upperRow = new THREE.Mesh(coneRow(frontX, backX, -0.04, zHalf, 12, 0.07, 0.018, true), toothMat);
  const upperGum = new THREE.Mesh(
    new THREE.BoxGeometry(frontX - backX, 0.04, zHalf * 2 + 0.04),
    gumMat,
  );
  upperGum.position.set((frontX + backX) / 2, 0.0, 0);
  const upper = new THREE.Group();
  upper.add(upperRow, upperGum);
  opts.headBone.add(upper);

  // Dark oral cavity shell so the open mouth never shows body backfaces.
  const cavity = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
    cavityMat,
  );
  cavity.position.set((frontX + backX) / 2 + 0.05, -0.12, 0);
  cavity.scale.set(1.3, 0.7, 1.0);
  opts.headBone.add(cavity);

  // Lower row + tongue (ride the mandible / jaw bone).
  const lowerRow = new THREE.Mesh(coneRow(frontX, backX, -0.06, zHalf, 12, 0.07, 0.018, false), toothMat);
  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    tongueMat,
  );
  tongue.scale.set(1.7, 0.35, 0.9);
  tongue.position.set((frontX + backX) / 2 - 0.05, -0.05, 0);
  const lower = new THREE.Group();
  lower.add(lowerRow, tongue);
  opts.jawBone.add(lower);

  group.add(upper, lower, cavity);

  let inDive = false;
  let foraging = 0;
  let openTarget = 0;
  let openCurrent = 0;
  let sinceTrigger = RETRIGGER_S;
  let holdLeft = 0;
  let visible = true;

  return {
    group,
    setForagingContext(d, intensity) {
      inDive = d;
      foraging = THREE.MathUtils.clamp(intensity, 0, 1);
    },
    update(dt) {
      sinceTrigger += dt;
      // Decide whether to begin a subtle open: elevated foraging in a dive raises
      // probability; an idle rare open otherwise. Gated by the re-trigger window.
      if (holdLeft <= 0 && openTarget === 0 && sinceTrigger >= RETRIGGER_S) {
        const pPerSec = inDive ? 0.04 + 0.5 * foraging : 0.01;
        if (Math.random() < pPerSec * dt) {
          openTarget = THREE.MathUtils.lerp(OPEN_MIN, OPEN_MAX, inDive ? foraging : 0.2);
          holdLeft = 0.6 + Math.random() * 0.8;
          sinceTrigger = 0;
        }
      }
      if (openTarget > 0) {
        holdLeft -= dt;
        if (holdLeft <= 0) openTarget = 0; // begin closing
      }
      // Smooth ease toward the target (never a snap).
      openCurrent += (openTarget - openCurrent) * Math.min(1, dt * 5);
      if (openCurrent < 1e-4 && openTarget === 0) openCurrent = 0;
      return visible ? openCurrent : 0;
    },
    setVisible(on) {
      visible = on;
      group.visible = on;
      upper.visible = on;
      lower.visible = on;
      cavity.visible = on;
    },
    dispose() {
      upperRow.geometry.dispose();
      lowerRow.geometry.dispose();
      (upperGum.geometry as THREE.BufferGeometry).dispose();
      tongue.geometry.dispose();
      cavity.geometry.dispose();
      toothMat.dispose();
      gumMat.dispose();
      tongueMat.dispose();
      cavityMat.dispose();
      opts.headBone.remove(upper);
      opts.headBone.remove(cavity);
      opts.jawBone.remove(lower);
    },
  };
}
