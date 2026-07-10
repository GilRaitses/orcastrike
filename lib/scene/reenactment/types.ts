// BRE reenactment contracts. These match, on the consumer side, the JSON the
// acoustic lane (BAM) emits and the behavior-clip manifest derived from the
// REAL SRKW driver. BRE consumes BAM's classification (WHICH/HOW MANY orcas)
// and the kinematic clips (HOW they move). The two are wired but never
// conflated: acoustic presence picks the spawn; measured DTAG telemetry is the
// only thing that drives a DOF.

/** One precomputed window of the acoustic-silhouette inference (BAM). */
export interface AcousticWindow {
  tStartS: number;
  tEndS: number;
  presence: boolean;
  presenceConfidence: number; // real model posterior, 0..1
}

/** BAM precomputed inference JSON. schema "bsw-acoustic-classification/v1". */
export interface AcousticClassificationRecord {
  schema: "bsw-acoustic-classification/v1";
  model_version: string;
  train_run_id: string;
  clipId: string;
  stationId: string;
  station: { name: string; lat: number; lng: number };
  audio: {
    url: string;
    durationS: number;
    license: string;
    attribution: string;
    honesty: "measured";
  };
  window: { windowS: number; hopS: number; threshold: number };
  classes: string[];
  eval: {
    task: string;
    selected_model: string;
    test_f1: number;
    test_precision: number;
    test_recall: number;
    test_auprc: number;
    held_out: string;
    label_basis: string;
    known_confounds: string[];
  };
  honesty: {
    inference: "measured_model_output";
    claim: "estimate";
    wording: string;
    not_claimed: string[];
    spawn: "modeled_3d_placement";
    motion: "measured_srkw_dtag";
    crossSensor: "illustrative";
    representativeness: string;
  };
  windows: AcousticWindow[];
  summary: {
    presenceFraction: number;
    meanConfidence: number;
    clipPresence: boolean;
    spawnCount: number;
    spawnCountBasis: "presence_only" | "count_head" | "capped_fallback";
  };
}

export type BehaviorClassId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** A behavior->motion clip: always a window into the REAL SRKW driver. */
export interface BehaviorMotionClip {
  id: string;
  driverUrl: string; // always the real SRKW driver
  t0_s: number;
  t1_s: number;
  behaviorClass: BehaviorClassId | null;
  behaviorName: string;
  loop: boolean;
  honesty: "measured" | "measured_motion_modeled_label";
  selection: "srkw_native_segment" | "srkw_kinematic_match" | "continuous_fallback";
  measured?: Record<string, number>;
}

export interface ClipManifest {
  schema: "bsw-behavior-clips/v1";
  driver: Record<string, unknown>;
  honesty_note: string;
  representativeness: string;
  fallback: BehaviorMotionClip;
  clips: BehaviorMotionClip[];
}

/** Minimal scene-time source BRE follows. Structurally satisfied by BSH's
 * `SpectroTimelineAuthority` (web/lib/scene/hud/spectro), so BRE compiles
 * independently of BSH's concrete impl. */
export interface ReenactmentTimeline {
  durationS: number;
  currentTimeS: number;
  playbackRate: number;
  playing: boolean;
  subscribe(fn: (state: Readonly<ReenactmentTimeline>) => void): () => void;
}

/** One spawned orca instance (BRE owns placement; motion is measured SRKW). */
export interface OrcaSpawnInstance {
  instanceId: string;
  anchor: { lat: number; lng: number };
  sceneOffsetM?: { x: number; z: number };
  clip: BehaviorMotionClip;
  /** HUD-only acoustic label; MUST NOT affect kinematics. */
  acousticLabel?: { text: string; confidence?: number };
  /** Disclosed modeled behavior-label string for this instance's clip. */
  behaviorLabel?: string;
  /** Per-instance offset (seconds) INTO the measured clip window. A modeled
   * presentation choice so spawned orcas sharing a clip do not move in perfect
   * lockstep; it samples a different REAL moment of the driver, never fabricates
   * motion. Default 0. */
  phaseOffsetS?: number;
  bodyScale?: number;
}

/** How the spawn count was decided. The first three mirror BAM's
 * `summary.spawnCountBasis`; `capability_demo` marks a sandbox override that is
 * explicitly NOT a model estimate (the classifier does not resolve count). */
export type SpawnCountBasis =
  | "presence_only"
  | "count_head"
  | "capped_fallback"
  | "capability_demo";

export interface ReenactmentSpawnRecord {
  classification: AcousticClassificationRecord;
  instances: OrcaSpawnInstance[]; // length === resolved spawn count
  timelineDurationS: number;
  countBasis: SpawnCountBasis;
  /** On-screen honesty wording for how the count was decided. */
  countBasisLabel: string;
  honesty: {
    motion: "measured_srkw_dtag";
    spawn: "modeled_3d_placement";
    crossSensor: "illustrative";
    representativeness: string;
  };
}
