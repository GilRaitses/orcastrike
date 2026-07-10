// OR - the orca armature, skinning, and the named-DOF OrcaRig API.
//
// The source mesh ships as a single static shell (no skeleton). This module
// builds an anatomical odontocete armature on it and binds it as a GPU-skinned
// SkinnedMesh, so the deformation costs one extra vertex skinning pass on the
// GPU and nothing on the CPU per frame.
//
// Frame (twin convention, see web/public/orca/LICENSE.md and SKELETON.md):
//   +X forward (rostrum), +Y up (dorsal), +Z port (lateral). Fluke at -X.
//
// Anatomy honored: a body-centered root; a forward spine -> head -> jaw chain;
// a tailward caudal[0..4] chain that drives the fibrous fluke DORSO-VENTRALLY
// (rotation about the lateral Z axis); two pectoral flippers; no hind limbs.
// Swimming is up/down fluke oscillation, not lateral (cetacean, not fish).
//
// DOF authority (locked composition order, see OEYE-R / OPHYS-R):
//   1. OG  -> setOrientation + setDepthPose on the OUTER root (authoritative).
//   2. OR  -> head bone offset (bounded).
//   3. OPHYS -> setSpineFlex / bank / caudal follow-through (bounded, layered).
//   4. OG  -> setFluke (caudal beat phase + amplitude).
//   5. OEYE gaze (eye meshes only, composed last; not here).
//
// Body orientation and depth live on the OUTER root Object3D, NOT on bones, so
// the whole animal turns and dives as a rigid unit driven by telemetry; bones
// only deform (fluke beat, spine flex, jaw, flippers, head). This keeps the
// telemetry pose exact and the secondary motion strictly bounded.

import * as THREE from "three";

/** Per-DOF clamp limits (radians) the driver + physics layer read. */
export interface OrcaRigLimits {
  /** Jaw hinge open angle, radians. 0 = closed; cap < ~25 deg (OMOU-R). */
  jawMax: number;
  /** Bounded head-bone yaw/pitch offset for gaze assist (OEYE-R, <= 5 deg). */
  headOffsetMax: number;
  /** Pectoral flipper pitch range. */
  pectoralMax: number;
  /** Per-caudal-joint max fluke deflection (radians) at full amplitude. */
  flukeJointMax: number;
  /** Max spine-follow bend per joint (OPHYS spine IK). */
  spineFlexMax: number;
  /** Max banking lean distributed across the spine (OPHYS). */
  bankMax: number;
}

export const DEFAULT_LIMITS: OrcaRigLimits = {
  jawMax: THREE.MathUtils.degToRad(22),
  headOffsetMax: THREE.MathUtils.degToRad(5),
  pectoralMax: THREE.MathUtils.degToRad(35),
  flukeJointMax: THREE.MathUtils.degToRad(11),
  spineFlexMax: THREE.MathUtils.degToRad(8),
  bankMax: THREE.MathUtils.degToRad(10),
};

/** Bone X positions (metres) along the 7 m body, nose (+X) to fluke (-X). */
const BONE_LAYOUT = {
  head: 2.1,
  spine: 0.8,
  root: 0.0,
  caudal: [-0.7, -1.4, -2.1, -2.8, -3.45] as const,
  jaw: { x: 2.5, y: -0.25 },
  pec: { x: 0.7, y: -0.25, z: 0.85 },
};

const N_CAUDAL = BONE_LAYOUT.caudal.length;

/** Tailward amplitude profile for the fluke beat (root joint barely moves; the
 * fluke tip moves most), giving a traveling dorso-ventral wave. */
const CAUDAL_AMP_PROFILE = [0.25, 0.5, 0.78, 1.0, 1.0];
/** Per-joint phase delay (radians) so the wave propagates tailward. */
const CAUDAL_PHASE_DELAY = 0.55;

export interface OrcaRig {
  /** Outer group: add to scene. OG writes orientation + depth onto THIS. */
  root: THREE.Group;
  /** The GPU-skinned mesh (its material is swapped by OMAT). */
  skinnedMesh: THREE.SkinnedMesh;
  /** Named bones for cross-lane parenting (OEYE eye on head, OMOU on jaw). */
  bones: {
    root: THREE.Bone;
    spine: THREE.Bone;
    head: THREE.Bone;
    jaw: THREE.Bone;
    caudal: THREE.Bone[];
    pectoralL: THREE.Bone;
    pectoralR: THREE.Bone;
  };
  limits: OrcaRigLimits;

  /** OG: authoritative body orientation (radians) on the outer root. */
  setOrientation(pitch: number, roll: number, yaw: number): void;
  /** OG: vertical world placement from depth. Y = -depth_m * worldUnitsPerMeter. */
  setDepthPose(depthM: number, worldUnitsPerMeter: number): void;
  /** OG: fluke beat. phase in radians, amplitude normalized 0..1. */
  setFluke(phase: number, amplitude: number): void;
  /** OMOU: jaw open (radians, clamped to jawMax). */
  setJaw(openRad: number): void;
  /** OEYE assist: bounded head offset (radians, clamped to headOffsetMax). */
  setHeadOffset(yaw: number, pitch: number): void;
  /** Steering: pectoral flipper pitch (radians, clamped). */
  setPectoral(leftRad: number, rightRad: number): void;
  /** OPHYS: bounded spine-follow bend (yaw) + banking lean (roll), radians. */
  setSecondaryFlex(spineYaw: number, bankRoll: number): void;
  /** OPHYS: per-caudal-joint follow-through offset (radians), tailward array. */
  setCaudalFollow(offsets: number[]): void;

  dispose(): void;
}

/**
 * Build the armature on a centered orca geometry and return the rig.
 * The geometry must be in the centered twin frame (see loadOrcaMesh).
 */
export function buildOrcaRig(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  limits: OrcaRigLimits = DEFAULT_LIMITS,
): OrcaRig {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;

  // --- 1. bones ----------------------------------------------------------
  const mk = (name: string, x: number, y = 0, z = 0): THREE.Bone => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    return b;
  };

  const root = mk("orca_root", 0);
  const spine = mk("orca_spine", BONE_LAYOUT.spine - BONE_LAYOUT.root);
  const head = mk("orca_head", BONE_LAYOUT.head - BONE_LAYOUT.spine);
  const jaw = mk("orca_jaw", BONE_LAYOUT.jaw.x - BONE_LAYOUT.head, BONE_LAYOUT.jaw.y);
  spine.add(head);
  head.add(jaw);
  root.add(spine);

  const caudal: THREE.Bone[] = [];
  let parent: THREE.Bone = root;
  let prevX = BONE_LAYOUT.root;
  for (let i = 0; i < N_CAUDAL; i++) {
    const x = BONE_LAYOUT.caudal[i];
    const b = mk(`orca_caudal_${i}`, x - prevX);
    parent.add(b);
    caudal.push(b);
    parent = b;
    prevX = x;
  }

  const pectoralL = mk("orca_pectoral_L", BONE_LAYOUT.pec.x, BONE_LAYOUT.pec.y, BONE_LAYOUT.pec.z);
  const pectoralR = mk("orca_pectoral_R", BONE_LAYOUT.pec.x, BONE_LAYOUT.pec.y, -BONE_LAYOUT.pec.z);
  root.add(pectoralL);
  root.add(pectoralR);

  // Ordered (by world X, descending) chain used for 1-D body skinning.
  const chain: { bone: THREE.Bone; x: number }[] = [
    { bone: head, x: BONE_LAYOUT.head },
    { bone: spine, x: BONE_LAYOUT.spine },
    { bone: root, x: BONE_LAYOUT.root },
    ...caudal.map((b, i) => ({ bone: b, x: BONE_LAYOUT.caudal[i] })),
  ];

  // Stable bone index list for the skeleton.
  const bones: THREE.Bone[] = [
    root, spine, head, jaw, ...caudal, pectoralL, pectoralR,
  ];
  const boneIndex = new Map<THREE.Bone, number>();
  bones.forEach((b, i) => boneIndex.set(b, i));

  // --- 2. skin weights ---------------------------------------------------
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);

  const pecMin = BONE_LAYOUT.pec.x - 0.9;
  const pecMax = BONE_LAYOUT.pec.x + 0.7;
  const jawX0 = BONE_LAYOUT.head; // verts forward of the head bone can join the jaw
  const v = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);

    // (a) base 1-D body weight: blend the two chain bones bracketing v.x.
    let lo = 0;
    while (lo < chain.length - 1 && chain[lo + 1].x > v.x) lo++;
    const a = chain[lo];
    const b = chain[Math.min(lo + 1, chain.length - 1)];
    let tBody = 0;
    if (a.x !== b.x) tBody = THREE.MathUtils.clamp((a.x - v.x) / (a.x - b.x), 0, 1);
    const wA = 1 - tBody;
    const wB = tBody;

    const w: { idx: number; weight: number }[] = [
      { idx: boneIndex.get(a.bone)!, weight: wA },
      { idx: boneIndex.get(b.bone)!, weight: wB },
    ];

    // (b) jaw region: lower-front verts smoothly hand weight to the mandible.
    if (v.x > jawX0 && v.y < BONE_LAYOUT.jaw.y + 0.35) {
      const jawMask =
        THREE.MathUtils.smoothstep(v.x, jawX0, jawX0 + 0.9) *
        THREE.MathUtils.smoothstep(BONE_LAYOUT.jaw.y + 0.35, BONE_LAYOUT.jaw.y - 0.2, v.y);
      if (jawMask > 0.001) {
        for (const e of w) e.weight *= 1 - jawMask;
        w.push({ idx: boneIndex.get(jaw)!, weight: jawMask });
      }
    }

    // (c) pectoral region: lateral, lower, forward-ish verts -> nearest flipper.
    const absZ = Math.abs(v.z);
    if (v.x > pecMin && v.x < pecMax && absZ > 0.55 && v.y < 0.25) {
      const pecMask =
        THREE.MathUtils.smoothstep(v.x, pecMin, pecMin + 0.4) *
        THREE.MathUtils.smoothstep(pecMax, pecMax - 0.4, v.x) *
        THREE.MathUtils.smoothstep(absZ, 0.55, 0.95) *
        THREE.MathUtils.smoothstep(0.25, -0.2, v.y);
      if (pecMask > 0.001) {
        const pec = v.z > 0 ? pectoralL : pectoralR;
        for (const e of w) e.weight *= 1 - pecMask;
        w.push({ idx: boneIndex.get(pec)!, weight: pecMask });
      }
    }

    // (d) normalize, keep the top 4.
    w.sort((p, q) => q.weight - p.weight);
    const top = w.slice(0, 4);
    let sum = 0;
    for (const e of top) sum += e.weight;
    if (sum <= 1e-6) {
      top.length = 0;
      top.push({ idx: boneIndex.get(root)!, weight: 1 });
      sum = 1;
    }
    for (let k = 0; k < 4; k++) {
      const e = top[k];
      skinIndex[i * 4 + k] = e ? e.idx : 0;
      skinWeight[i * 4 + k] = e ? e.weight / sum : 0;
    }
  }

  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));

  // --- 3. skinned mesh + skeleton ---------------------------------------
  const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
  skinnedMesh.name = "orca";
  skinnedMesh.add(root);
  skinnedMesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skinnedMesh.bind(skeleton);
  // Wide bounds so the deforming tail is never frustum-culled.
  const r = bbox.getSize(new THREE.Vector3()).length();
  skinnedMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), r);
  skinnedMesh.frustumCulled = false;

  const outer = new THREE.Group();
  outer.name = "orca_root_group";
  outer.add(skinnedMesh);

  // --- 4. DOF API --------------------------------------------------------
  const clamp = THREE.MathUtils.clamp;
  const baseSpineQ = spine.quaternion.clone();
  const baseCaudalQ = caudal.map((b) => b.quaternion.clone());
  const baseHeadQ = head.quaternion.clone();

  let flukePhase = 0;
  let flukeAmp = 0;
  let spineYaw = 0;
  let bankRoll = 0;
  const caudalFollow = new Array(N_CAUDAL).fill(0);
  let headYaw = 0;
  let headPitch = 0;

  function applyCaudal(): void {
    // Dorso-ventral fluke beat (rotation about local Z) + OPHYS follow-through,
    // both clamped per joint. Bank lean distributes a small roll along the chain.
    for (let i = 0; i < N_CAUDAL; i++) {
      const beat =
        Math.sin(flukePhase - i * CAUDAL_PHASE_DELAY) *
        CAUDAL_AMP_PROFILE[i] *
        flukeAmp *
        limits.flukeJointMax;
      const follow = clamp(caudalFollow[i], -limits.flukeJointMax, limits.flukeJointMax);
      const z = clamp(beat + follow, -limits.flukeJointMax * 1.4, limits.flukeJointMax * 1.4);
      const bankShare = (bankRoll / N_CAUDAL) * (i + 1) * 0.4;
      const e = new THREE.Euler(clamp(bankShare, -limits.bankMax, limits.bankMax), 0, z, "XYZ");
      caudal[i].quaternion.setFromEuler(e).premultiply(baseCaudalQ[i]);
    }
  }

  function applySpine(): void {
    const yaw = clamp(spineYaw, -limits.spineFlexMax, limits.spineFlexMax);
    const roll = clamp(bankRoll, -limits.bankMax, limits.bankMax);
    spine.quaternion
      .setFromEuler(new THREE.Euler(roll * 0.5, yaw, 0, "XYZ"))
      .premultiply(baseSpineQ);
  }

  function applyHead(): void {
    head.quaternion
      .setFromEuler(new THREE.Euler(0, headYaw, headPitch, "XYZ"))
      .premultiply(baseHeadQ);
  }

  applyCaudal();
  applySpine();
  applyHead();

  return {
    root: outer,
    skinnedMesh,
    bones: { root, spine, head, jaw, caudal, pectoralL, pectoralR },
    limits,

    setOrientation(pitch, roll, yaw) {
      // Body axes: yaw about +Y, pitch about lateral +Z (nose up positive),
      // roll about longitudinal +X. Telemetry is authoritative here.
      outer.rotation.set(0, 0, 0);
      outer.rotateY(yaw);
      outer.rotateX(roll);
      outer.rotateZ(pitch);
    },
    setDepthPose(depthM, worldUnitsPerMeter) {
      outer.position.y = -depthM * worldUnitsPerMeter;
    },
    setFluke(phase, amplitude) {
      flukePhase = phase;
      flukeAmp = clamp(amplitude, 0, 1);
      applyCaudal();
    },
    setJaw(openRad) {
      jaw.rotation.z = -clamp(openRad, 0, limits.jawMax);
    },
    setHeadOffset(yaw, pitch) {
      headYaw = clamp(yaw, -limits.headOffsetMax, limits.headOffsetMax);
      headPitch = clamp(pitch, -limits.headOffsetMax, limits.headOffsetMax);
      applyHead();
    },
    setPectoral(leftRad, rightRad) {
      pectoralL.rotation.z = clamp(leftRad, -limits.pectoralMax, limits.pectoralMax);
      pectoralR.rotation.z = clamp(rightRad, -limits.pectoralMax, limits.pectoralMax);
    },
    setSecondaryFlex(sy, br) {
      spineYaw = sy;
      bankRoll = br;
      applySpine();
      applyCaudal();
    },
    setCaudalFollow(offsets) {
      for (let i = 0; i < N_CAUDAL; i++) caudalFollow[i] = offsets[i] ?? 0;
      applyCaudal();
    },

    dispose() {
      geometry.dispose();
      skeleton.dispose();
    },
  };
}
