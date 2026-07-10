// STRIKE-W2b — O-key hydrophone sonar stub. Plays a classified SRKW window from
// classification.json + visual pulse spec for the scene to render.

export interface HydrophoneClassificationWindow {
  tStartS: number;
  tEndS: number;
  presence: boolean;
  presenceConfidence: number;
}

export interface HydrophoneClassificationDoc {
  audio: {
    url: string;
    durationS: number;
  };
  window: {
    windowS: number;
    hopS: number;
  };
  windows: HydrophoneClassificationWindow[];
}

export interface HydrophoneSonarPulseSpec {
  center: { x: number; y: number; z: number };
  /** Max ring radius in world units (metres). */
  maxRadiusM: number;
  /** Ring expansion duration, seconds. */
  durationS: number;
  /** Scene elapsed time when the pulse started. */
  startTimeS: number;
  /** Stroke colour hint for r3f mesh (hex). */
  color: string;
}

export interface HydrophoneSonarEmitResult {
  pulse: HydrophoneSonarPulseSpec;
  windowIndex: number;
  tStartS: number;
  playDurationS: number;
  confidence: number;
  skipped: boolean;
  skipReason?: string;
}

export interface HydrophoneSonarOptions {
  /** Defaults to `/hydrophone/slice/classification.json`. */
  classificationUrl?: string;
  /** Defaults to doc.audio.url or locked m4a path. */
  audioUrl?: string;
  /** Minimum confidence for SRKW presence windows. */
  minConfidence?: number;
  /** Visual pulse max radius, metres. */
  pulseMaxRadiusM?: number;
  /** Visual pulse duration, seconds. */
  pulseDurationS?: number;
  /** Called when a pulse should be rendered in world space. */
  onPulse?: (pulse: HydrophoneSonarPulseSpec) => void;
}

export interface HydrophoneSonar {
  /** Preload classification JSON (idempotent). */
  load(): Promise<void>;
  /**
   * Emit O-key sonar at `worldPosition`. Returns pulse spec + audio segment
   * metadata; plays audio when the browser AudioContext is available.
   */
  emitSonar(
    worldPosition: { x: number; y: number; z: number },
    sceneElapsedS: number,
  ): Promise<HydrophoneSonarEmitResult>;
  dispose(): void;
}

const DEFAULT_CLASSIFICATION_URL = "/hydrophone/slice/classification.json";
const DEFAULT_AUDIO_URL = "/hydrophone/slice/orcasound_lab_20210825_srkw.m4a";
const DEFAULT_MIN_CONFIDENCE = 0.5;
const DEFAULT_PULSE_MAX_RADIUS_M = 45;
const DEFAULT_PULSE_DURATION_S = 3.0;
const RECENT_WINDOW_COOLDOWN = 8;

export function createHydrophoneSonar(opts: HydrophoneSonarOptions = {}): HydrophoneSonar {
  const classificationUrl = opts.classificationUrl ?? DEFAULT_CLASSIFICATION_URL;
  const minConfidence = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const pulseMaxRadiusM = opts.pulseMaxRadiusM ?? DEFAULT_PULSE_MAX_RADIUS_M;
  const pulseDurationS = opts.pulseDurationS ?? DEFAULT_PULSE_DURATION_S;
  const onPulse = opts.onPulse;

  let doc: HydrophoneClassificationDoc | null = null;
  let audioUrl = opts.audioUrl ?? DEFAULT_AUDIO_URL;
  let loadPromise: Promise<void> | null = null;
  const recentWindowIndices = new Map<number, number>();
  let audioEl: HTMLAudioElement | null = null;

  function getAudioElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.preload = "auto";
    }
    return audioEl;
  }

  function pickWindow(sceneElapsedS: number): { window: HydrophoneClassificationWindow; index: number } | null {
    if (!doc) return null;
    const candidates: { window: HydrophoneClassificationWindow; index: number }[] = [];
    doc.windows.forEach((window, index) => {
      if (!window.presence || window.presenceConfidence < minConfidence) return;
      const lastPlayed = recentWindowIndices.get(index);
      if (lastPlayed !== undefined && sceneElapsedS - lastPlayed < RECENT_WINDOW_COOLDOWN) {
        return;
      }
      candidates.push({ window, index });
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.window.presenceConfidence - a.window.presenceConfidence);
    return candidates[0];
  }

  async function load(): Promise<void> {
    if (doc) return;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const res = await fetch(classificationUrl);
      if (!res.ok) {
        throw new Error(`hydrophoneSonar: failed to load ${classificationUrl} (${res.status})`);
      }
      doc = (await res.json()) as HydrophoneClassificationDoc;
      if (!opts.audioUrl && doc.audio?.url) {
        audioUrl = doc.audio.url;
      }
    })();
    return loadPromise;
  }

  async function emitSonar(
    worldPosition: { x: number; y: number; z: number },
    sceneElapsedS: number,
  ): Promise<HydrophoneSonarEmitResult> {
    await load();

    const picked = pickWindow(sceneElapsedS);
    if (!picked || !doc) {
      return {
        pulse: {
          center: { ...worldPosition },
          maxRadiusM: pulseMaxRadiusM,
          durationS: pulseDurationS,
          startTimeS: sceneElapsedS,
          color: "#5ec8ff",
        },
        windowIndex: -1,
        tStartS: 0,
        playDurationS: 0,
        confidence: 0,
        skipped: true,
        skipReason: doc ? "no_eligible_srkw_window" : "classification_not_loaded",
      };
    }

    const { window, index } = picked;
    const playDurationS = Math.min(
      doc.window?.windowS ?? 3.0,
      window.tEndS - window.tStartS,
    );
    recentWindowIndices.set(index, sceneElapsedS);

    const pulse: HydrophoneSonarPulseSpec = {
      center: { ...worldPosition },
      maxRadiusM: pulseMaxRadiusM,
      durationS: pulseDurationS,
      startTimeS: sceneElapsedS,
      color: "#5ec8ff",
    };
    onPulse?.(pulse);

    const el = getAudioElement();
    if (el) {
      el.src = audioUrl;
      el.currentTime = window.tStartS;
      void el.play().catch(() => {
        // Autoplay policy or missing asset; scene still gets pulse spec.
      });
      const stopAt = window.tStartS + playDurationS;
      const onTimeUpdate = (): void => {
        if (el.currentTime >= stopAt) {
          el.pause();
          el.removeEventListener("timeupdate", onTimeUpdate);
        }
      };
      el.addEventListener("timeupdate", onTimeUpdate);
    }

    return {
      pulse,
      windowIndex: index,
      tStartS: window.tStartS,
      playDurationS,
      confidence: window.presenceConfidence,
      skipped: false,
    };
  }

  function dispose(): void {
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
      audioEl = null;
    }
    doc = null;
    loadPromise = null;
    recentWindowIndices.clear();
  }

  return { load, emitSonar, dispose };
}

/** Evaluate ring radius at `sceneElapsedS` for r3f pulse mesh (pure). */
export function hydrophonePulseRadiusAt(
  pulse: HydrophoneSonarPulseSpec,
  sceneElapsedS: number,
): number {
  const age = sceneElapsedS - pulse.startTimeS;
  if (age <= 0 || age >= pulse.durationS) return 0;
  const t = age / pulse.durationS;
  return pulse.maxRadiusM * t;
}

/** Opacity fade for pulse ring material (pure). */
export function hydrophonePulseOpacityAt(
  pulse: HydrophoneSonarPulseSpec,
  sceneElapsedS: number,
): number {
  const age = sceneElapsedS - pulse.startTimeS;
  if (age <= 0 || age >= pulse.durationS) return 0;
  return 1 - age / pulse.durationS;
}
