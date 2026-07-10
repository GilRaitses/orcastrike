// Behavior -> motion-clip ethogram, built from the REAL behavior-clip manifest
// (web/public/orca/motion/clips/manifest.json), which is derived offline by
// modeling/acoustic/derive_srkw_clips.py from the measured SRKW DTAG driver.
//
// HONESTY (locked, R04/R05): every clip is a time WINDOW into the measured SRKW
// driver, so the pose a spawned orca plays is always measured telemetry. The
// behavior NAME (Traveling, Side_rolls, ...) is a MODELED kinematic match to the
// humpback ethogram, disclosed as such, never presented as measured orca
// behavior. WHICH clip an orca plays is a KINEMATIC choice (this module), NEVER
// driven by the acoustic classifier (which only decides presence / how many).
//
// This module is fully data-driven over the manifest: it works with whatever
// clips the offline derivation could honestly match, so adding or removing a
// class in the manifest needs no code change here.

import type {
  BehaviorClassId,
  BehaviorMotionClip,
  ClipManifest,
} from "@/lib/scene/reenactment/types";

export interface EthogramEntry {
  clip: BehaviorMotionClip;
  behaviorClass: BehaviorClassId | null;
  behaviorName: string;
  /** Disclosed modeled-label honesty string for this clip (on-screen safe). */
  modeledLabel: string;
  /** Measured kinematic signature carried from the manifest, for the HUD. */
  measured?: Record<string, number>;
}

export interface ClipAssignmentOptions {
  /** Force every instance onto one clip by id or behavior name (fixed policy). */
  fixedId?: string;
  /** Restrict the breadth rotation to these behavior classes, in order. */
  behaviorClasses?: BehaviorClassId[];
  /**
   * distinct: each instance gets the next behavior in the rotation (breadth).
   * fixed: every instance plays `fixedId` (or the first clip when unset).
   * Default distinct, falling back to fixed when `fixedId` is set.
   */
  policy?: "distinct" | "fixed";
}

export interface Ethogram {
  /** Mandatory representativeness label, carried from the manifest. */
  representativeness: string;
  honestyNote: string;
  entries: EthogramEntry[];
  fallback: EthogramEntry;
  byClass(behaviorClass: BehaviorClassId): EthogramEntry | null;
  byName(name: string): EthogramEntry | null;
  /** Resolve one entry by clip id OR behavior name, else the fallback. */
  resolve(clipIdOrName?: string): EthogramEntry;
  /** Per-instance clip assignment for multi-orca breadth (modeled UX choice,
   * never acoustic-driven). Returns exactly `n` entries. */
  assign(n: number, opts?: ClipAssignmentOptions): EthogramEntry[];
}

/** Build the disclosed modeled-label string for a clip. Prose-gate safe (no
 * semicolons, parentheses, em dashes, or colons in the rendered text). */
export function modeledClipLabel(clip: BehaviorMotionClip): string {
  if (clip.behaviorClass == null || clip.behaviorName === "unclassified") {
    return "behavior unclassified. Continuous measured SRKW DTAG telemetry.";
  }
  return `motion is measured SRKW DTAG. Behavior "${clip.behaviorName}" is a modeled kinematic match, not measured orca behavior.`;
}

function toEntry(clip: BehaviorMotionClip): EthogramEntry {
  return {
    clip,
    behaviorClass: clip.behaviorClass,
    behaviorName: clip.behaviorName,
    modeledLabel: modeledClipLabel(clip),
    measured: clip.measured,
  };
}

export function buildEthogram(manifest: ClipManifest): Ethogram {
  const entries = manifest.clips.map(toEntry);
  const fallback = toEntry(manifest.fallback);

  function byClass(behaviorClass: BehaviorClassId): EthogramEntry | null {
    return entries.find((e) => e.behaviorClass === behaviorClass) ?? null;
  }
  function byName(name: string): EthogramEntry | null {
    return entries.find((e) => e.behaviorName === name || e.clip.id === name) ?? null;
  }
  function resolve(clipIdOrName?: string): EthogramEntry {
    if (clipIdOrName) {
      const hit = byName(clipIdOrName);
      if (hit) return hit;
    }
    return entries[0] ?? fallback;
  }

  function assign(n: number, opts: ClipAssignmentOptions = {}): EthogramEntry[] {
    const count = Math.max(0, Math.floor(n));
    if (count === 0) return [];

    const fixed =
      opts.policy === "fixed" || (opts.policy == null && opts.fixedId != null);
    if (fixed) {
      const e = resolve(opts.fixedId);
      return Array.from({ length: count }, () => e);
    }

    // distinct breadth rotation across the available (or requested) behaviors.
    let pool: EthogramEntry[];
    if (opts.behaviorClasses && opts.behaviorClasses.length > 0) {
      pool = opts.behaviorClasses
        .map((c) => byClass(c))
        .filter((e): e is EthogramEntry => e != null);
    } else {
      pool = entries;
    }
    if (pool.length === 0) pool = [fallback];

    return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
  }

  return {
    representativeness: manifest.representativeness,
    honestyNote: manifest.honesty_note,
    entries,
    fallback,
    byClass,
    byName,
    resolve,
    assign,
  };
}
