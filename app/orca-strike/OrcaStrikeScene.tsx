"use client";

// STRIKE-W4 integration hub: wires orcaPilot, boats, sonar, and orcaStrike W3
// mechanics into one playable route at /orca-strike via the (game) route group.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { makeSun } from "@/app/components/scene/realism/sun";
import { skyColor } from "@/app/components/scene/realism/atmosphere";
import {
  createOrcaController,
  makeSandboxWfxEnv,
  ORCA_MESH_URL,
  type OrcaController,
  type WfxEnvHandle,
} from "@/lib/scene/orca";
import {
  createOrcaPilotInputSampler,
  createOrcaPilot,
  createChaseCamera,
  createMobilePilotInputSampler,
  isMobilePilotDevice,
  mergeOrcaPilotInputs,
  emptyOrcaPilotInput,
  type OrcaPilotInputSampler,
  type OrcaPilot,
  type ChaseCamera,
  type MobilePilotInputSampler,
} from "@/lib/scene/orcaPilot";
import MobileControlsOverlay from "./MobileControlsOverlay";
import { SeaSurface } from "./SeaSurface";
import SonarContextMap from "./SonarContextMap";
import { SceneAtmosphere } from "./SceneAtmosphere";
import {
  spawnBoats,
  checkRamCollisions,
  advanceSink,
  BoatMarker,
  spawnKayaks,
  KayakMarker,
  type Boat,
} from "@/lib/scene/boats";
import {
  buildRadarTargets,
  getCuratedPlaceTargets,
  createSonarPing,
  createTeleportBeat,
  type SonarPing,
  type SonarTarget,
  type TeleportBeat,
} from "@/lib/scene/sonar";
import { useTilesLayer } from "@/lib/scene/tiles";
import { projectToScene, sceneDepth, SCENE_WIDTH, type HeightmapBounds } from "@/lib/sceneIntent";
import {
  createStrikeControlsSampler,
  emptyStrikeControls,
  toOrcaPilotInputFromFsm,
  createInitialPilotFsmState,
  tickPilotFsm,
  setPilotFsmTrickSlots,
  applyStrikeRigLayers,
  tickMatch,
  applyMatchScoreEvent,
  trickSlotToEvent,
  tickBreachAirFrame,
  shouldStartBreachReplay,
  checkDeckLanding,
  computeSquirtOrigin,
  checkSquirtConeHits,
  createSonarScoringState,
  scoreSonarEmit,
  mergeSonarScoringIntoMatch,
  createHydrophoneSonar,
  createReplayBuffer,
  createBreachCamera,
  createReplayCamera,
  restoreBreachCameraFov,
  BREACH_CAMERA_DEFAULT_FOV_DEG,
  triggerBreachSplash,
  triggerBlowholeSpray,
  STRIKE_MIN_DEPTH_M,
  STRIKE_MAX_DEPTH_M,
  type StrikeControlsSampler,
  type PilotFsmState,
  type PilotFsmOutput,
  type MatchState,
  type ApplyScoreResult,
  type StrikeSpawnSelection,
  type SonarScoringState,
  type HydrophoneSonar,
  type ReplayBuffer,
  type BreachCamera,
  type ReplayCamera,
} from "@/lib/scene/orcaStrike";

const SCENE_TIME = new Date("2026-06-27T20:00:00Z");

const FULL_TILESET_URL = "https://d8kxxpcnj3ub5.cloudfront.net/3dtwin/full/tileset.json";
const TILESET_BOUNDS: HeightmapBounds = {
  min_lat: 48.4,
  max_lat: 48.7,
  min_lng: -123.25,
  max_lng: -122.75,
};
const SCENE_DEPTH = sceneDepth(TILESET_BOUNDS);

function geoRadiusMeters(b: HeightmapBounds): number {
  const latSpanM = (b.max_lat - b.min_lat) * 111_000;
  const lngSpanM = (b.max_lng - b.min_lng) * 73_600;
  return 0.5 * Math.hypot(latSpanM, lngSpanM);
}

const TILESET_METRIC_DIAMETER_UNITS = 2 * geoRadiusMeters(TILESET_BOUNDS);
const METRIC_SCENE_SCALE = TILESET_METRIC_DIAMETER_UNITS / SCENE_WIDTH;
const PILOT_WORLD_UNITS_PER_METER = 1;
const SONAR_MAX_RANGE_WORLD_UNITS = 90;
const TELEPORT_STANDOFF_WORLD_UNITS = 6;

const HUD_TEXT_STYLE: React.CSSProperties = {
  font: "12px/1.5 ui-monospace, monospace",
  color: "#cfe6ff",
};

function bearingLabel(bearingRad: number): string {
  const deg = Math.round((bearingRad * 180) / Math.PI);
  if (Math.abs(deg) < 5) return "ahead";
  if (Math.abs(deg) > 175) return "behind";
  return deg > 0 ? `${deg}° right` : `${-deg}° left`;
}

function latLngToMetricSceneXZ(lat: number, lng: number): [number, number] {
  const [x, z] = projectToScene(lat, lng, TILESET_BOUNDS, SCENE_DEPTH);
  return [x * METRIC_SCENE_SCALE, z * METRIC_SCENE_SCALE];
}

function clampDepthM(depthM: number): number {
  return Math.min(STRIKE_MAX_DEPTH_M, Math.max(STRIKE_MIN_DEPTH_M, depthM));
}

export interface OrcaStrikeSceneProps {
  spawn: StrikeSpawnSelection;
  match: MatchState;
  onMatchUpdate: (match: MatchState) => void;
  onFsmOutput: (fsm: PilotFsmOutput | null) => void;
}

interface SceneContentProps {
  spawn: StrikeSpawnSelection;
  matchRef: React.MutableRefObject<MatchState>;
  onMatchUpdate: (match: MatchState) => void;
  onFsmOutput: (fsm: PilotFsmOutput | null) => void;
  onVisibleTargetsChange: (targets: SonarTarget[] | null) => void;
  onPointerLockChange: (locked: boolean) => void;
  onBathyFailed: () => void;
  onPilotUpdate: (state: { x: number; z: number; heading: number; depthM: number }) => void;
  teleportRequestRef: React.MutableRefObject<{ x: number; z: number } | null>;
  pingRequestedRef: React.MutableRefObject<boolean>;
  isMobilePilot: boolean;
  mobileSamplerRef: React.MutableRefObject<MobilePilotInputSampler | null>;
}

function SceneContent({
  spawn,
  matchRef,
  onMatchUpdate,
  onFsmOutput,
  onVisibleTargetsChange,
  onPointerLockChange,
  onBathyFailed,
  onPilotUpdate,
  teleportRequestRef,
  pingRequestedRef,
  isMobilePilot,
  mobileSamplerRef,
}: SceneContentProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const sun = useMemo(() => makeSun(SCENE_TIME, 48.55, -123), []);
  const sky = useMemo(() => skyColor(sun.elevationDeg), [sun]);

  const env = useMemo<WfxEnvHandle>(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const handle = makeSandboxWfxEnv({
      sunDirection: sun.direction,
      sunColor: sun.color,
      sunIntensity: sun.intensity,
      skyColor: sky,
      pmrem,
    });
    handle.underwater.absorption.set(0.012, 0.006, 0.003);
    handle.underwater.inScatterColor.set("#124550");
    handle.underwater.visibility = 70;
    return handle;
  }, [gl, sun, sky]);

  useEffect(() => {
    scene.environment = env.pmremEnvironment;
    return () => {
      scene.environment = null;
    };
  }, [scene, env]);

  const orcaLightRef = useRef<THREE.PointLight>(null);

  const tiles = useTilesLayer({
    url: FULL_TILESET_URL,
    groupRotationX: -Math.PI / 2,
    fitScaleToWidth: TILESET_METRIC_DIAMETER_UNITS,
    errorTarget: 16,
    enableShadows: false,
  });

  const [bathyFailed, setBathyFailed] = useState(false);
  useEffect(() => {
    if (!tiles) return;
    const onLoadError = () => {
      console.warn(
        "orca-strike: bathymetry tileset failed to load; switching to flat water-plane fallback.",
      );
      setBathyFailed(true);
      onBathyFailed();
    };
    tiles.addEventListener("load-error", onLoadError);
    return () => tiles.removeEventListener("load-error", onLoadError);
  }, [tiles, onBathyFailed]);

  const controllerRef = useRef<OrcaController | null>(null);
  const pilotRef = useRef<OrcaPilot | null>(null);
  const samplerRef = useRef<OrcaPilotInputSampler | null>(null);
  const strikeSamplerRef = useRef<StrikeControlsSampler | null>(null);
  const chaseCamRef = useRef<ChaseCamera | null>(null);
  const breachCamRef = useRef<BreachCamera | null>(null);
  const replayCamRef = useRef<ReplayCamera | null>(null);
  const replayBufferRef = useRef<ReplayBuffer | null>(null);
  const hydrophoneRef = useRef<HydrophoneSonar | null>(null);
  const sonarScoringRef = useRef<SonarScoringState>(createSonarScoringState());
  const fsmStateRef = useRef<PilotFsmState>(createInitialPilotFsmState(spawn.depthM));
  const trickScoredRef = useRef(false);
  const stageRef = useRef<THREE.Group>(null);
  const [, setReady] = useState(false);

  const spawnXZ = useMemo(
    () => latLngToMetricSceneXZ(spawn.lat, spawn.lng),
    [spawn.lat, spawn.lng],
  );

  useEffect(() => {
    let alive = true;
    const pilot = createOrcaPilot({
      worldUnitsPerMeter: PILOT_WORLD_UNITS_PER_METER,
      initialDepthM: spawn.depthM,
    });
    pilotRef.current = pilot;
    fsmStateRef.current = createInitialPilotFsmState(spawn.depthM);

    createOrcaController({
      env,
      meshUrl: ORCA_MESH_URL,
      worldUnitsPerMeter: PILOT_WORLD_UNITS_PER_METER,
      track: pilot.track,
    })
      .then((c) => {
        if (!alive) {
          c.dispose();
          return;
        }
        controllerRef.current = c;
        c.root.position.x = spawnXZ[0];
        c.root.position.z = spawnXZ[1];
        stageRef.current?.add(c.root);
        setReady(true);
      })
      .catch((e) => console.error("orca-strike: orca controller failed to load", e));

    return () => {
      alive = false;
      const c = controllerRef.current;
      if (c) {
        stageRef.current?.remove(c.root);
        c.dispose();
        controllerRef.current = null;
      }
      pilotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, spawn.depthM, spawnXZ]);

  useEffect(() => {
    if (isMobilePilot) {
      samplerRef.current = null;
      return undefined;
    }
    const sampler = createOrcaPilotInputSampler(gl.domElement);
    samplerRef.current = sampler;
    return () => {
      sampler.dispose();
      samplerRef.current = null;
    };
  }, [gl, isMobilePilot]);

  useEffect(() => {
    if (isMobilePilot) return undefined;
    const strikeSampler = createStrikeControlsSampler();
    strikeSamplerRef.current = strikeSampler;
    return () => {
      strikeSampler.dispose();
      strikeSamplerRef.current = null;
    };
  }, [isMobilePilot]);

  useEffect(() => {
    chaseCamRef.current = createChaseCamera({
      distance: 10,
      height: 4,
      positionSmoothing: 7,
      headingSmoothing: 2.4,
    });
    breachCamRef.current = createBreachCamera({ defaultFovDeg: 50 });
    replayCamRef.current = createReplayCamera();
    replayBufferRef.current = createReplayBuffer();
    const hydro = createHydrophoneSonar();
    hydrophoneRef.current = hydro;
    void hydro.load();
    return () => {
      hydro.dispose();
      hydrophoneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onChange = () => onPointerLockChange(document.pointerLockElement === gl.domElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, [gl, onPointerLockChange]);

  const [boats, setBoats] = useState<Boat[]>(() =>
    spawnBoats({ seed: 7, centerX: spawnXZ[0], centerZ: spawnXZ[1] }),
  );
  const kayaks = useMemo(
    () => spawnKayaks({ seed: 11, centerX: spawnXZ[0], centerZ: spawnXZ[1] }),
    [spawnXZ],
  );

  const sonarPingRef = useRef<SonarPing | null>(null);
  if (!sonarPingRef.current) sonarPingRef.current = createSonarPing();
  const teleportBeatRef = useRef<TeleportBeat | null>(null);
  if (!teleportBeatRef.current) teleportBeatRef.current = createTeleportBeat();

  const placeTargets = useMemo(() => getCuratedPlaceTargets(TILESET_BOUNDS, SCENE_DEPTH), []);
  const metricPlaceTargets = useMemo(
    () =>
      placeTargets.map((p) => ({
        id: p.id,
        label: p.label,
        x: p.x * METRIC_SCENE_SCALE,
        z: p.z * METRIC_SCENE_SCALE,
      })),
    [placeTargets],
  );
  const kayakHitboxes = useMemo(
    () => kayaks.map((k) => ({ id: k.id, x: k.x, z: k.z })),
    [kayaks],
  );

  const tmpWorldPos = useRef(new THREE.Vector3()).current;
  const scoredKayakBreachRef = useRef(new Set<string>());
  const scoredKayakBlowholeRef = useRef(new Set<string>());

  useFrame((state, dtRaw) => {
    const dt = Number.isFinite(dtRaw) && dtRaw > 0 ? Math.min(dtRaw, 1 / 30) : 0;
    const controller = controllerRef.current;
    const pilot = pilotRef.current;
    const sampler = samplerRef.current;
    const strikeSampler = strikeSamplerRef.current;
    const chaseCam = chaseCamRef.current;
    const breachCam = breachCamRef.current;
    const replayCam = replayCamRef.current;
    const replayBuffer = replayBufferRef.current;
    const hydrophone = hydrophoneRef.current;
    const teleportBeat = teleportBeatRef.current;
    const sonarPing = sonarPingRef.current;
    if (!controller || !pilot || !chaseCam || !breachCam || !replayCam || !replayBuffer || !teleportBeat || !sonarPing) {
      return;
    }
    if (!isMobilePilot && (!sampler || !strikeSampler)) return;

    const elapsed = state.clock.elapsedTime;
    let match = matchRef.current;
    const scoreResults: ApplyScoreResult[] = [];

    const desktopInput = sampler?.getInput() ?? emptyOrcaPilotInput();
    const mobileInput = isMobilePilot
      ? mobileSamplerRef.current?.getInput() ?? emptyOrcaPilotInput()
      : null;
    const merged = mergeOrcaPilotInputs(desktopInput, mobileInput);
    const ctrl = match.controlsEnabled
      ? strikeSampler?.tick(merged) ?? emptyStrikeControls()
      : emptyStrikeControls();

    const poseSample = pilot.track.sample(0);
    const fsmTick = tickPilotFsm(dt, ctrl, fsmStateRef.current, {
      depthM: poseSample.depthM,
      yaw: poseSample.yaw,
      pitch: poseSample.pitch,
      roll: poseSample.roll,
      speedMps: Math.abs(poseSample.flukeAmp) * 5.5,
    });
    fsmStateRef.current = fsmTick.state;
    const fsmOutput = fsmTick.output;
    onFsmOutput(fsmOutput);

    const adapted = toOrcaPilotInputFromFsm(merged, ctrl, fsmOutput);

    if (teleportRequestRef.current) {
      const req = teleportRequestRef.current;
      const startX = controller.root.position.x;
      const startZ = controller.root.position.z;
      const dx = req.x - startX;
      const dz = req.z - startZ;
      const dist = Math.hypot(dx, dz);
      const t =
        dist > TELEPORT_STANDOFF_WORLD_UNITS ? (dist - TELEPORT_STANDOFF_WORLD_UNITS) / dist : 0;
      teleportBeat.start(startX + dx * t, startZ + dz * t);
      teleportRequestRef.current = null;
      sonarPing.clear();
    }

    if (!teleportBeat.isActive()) {
      pilot.update(adapted.pilotInput, dt, controller.root);
    }

    const livePose = pilot.track.sample(0);
    if (fsmOutput.mode === "breach_air") {
      livePose.depthM = clampDepthM(Math.max(0, -fsmStateRef.current.worldPosY));
      controller.root.position.y = fsmStateRef.current.worldPosY;
    } else if (adapted.depthRateMps !== 0) {
      livePose.depthM = clampDepthM(livePose.depthM + adapted.depthRateMps * dt);
    } else {
      livePose.depthM = clampDepthM(livePose.depthM);
    }

    if (fsmOutput.mode === "roll_left" || fsmOutput.mode === "roll_right") {
      livePose.roll = fsmOutput.bodyRollTargetRad;
    }

    controller.update(dt, elapsed, camera.position);
    applyStrikeRigLayers(controller.rig, fsmOutput, null);

    if (teleportBeat.isActive()) {
      teleportBeat.update(dt);
      const xz = teleportBeat.currentXZ();
      if (xz) {
        controller.root.position.x = xz.x;
        controller.root.position.z = xz.z;
      }
    }

    const orcaX = controller.root.position.x;
    const orcaY = controller.root.position.y;
    const orcaZ = controller.root.position.z;
    const heading = livePose.yaw;

    if (fsmOutput.mode === "breach_air") {
      const air = tickBreachAirFrame({
        controls: ctrl,
        trickSlots: fsmStateRef.current.trickSlots,
        orcaPos: { x: orcaX, y: orcaY, z: orcaZ },
        kayaks: kayakHitboxes,
      });
      fsmStateRef.current = setPilotFsmTrickSlots(fsmStateRef.current, air.trickSlots);
      if (air.trickEvent) {
        const trickIndex = [1, 2, 4, 8].filter((bit) => (air.trickSlots & bit) !== 0).length - 1;
        const scored = applyMatchScoreEvent(
          match,
          trickSlotToEvent(air.trickEvent),
          Math.max(0, trickIndex),
        );
        match = scored.match;
        scoreResults.push(scored.result);
        trickScoredRef.current = true;
      }
      for (const kayakId of air.kayakHits) {
        if (scoredKayakBreachRef.current.has(kayakId)) continue;
        scoredKayakBreachRef.current.add(kayakId);
        const scored = applyMatchScoreEvent(match, { type: "breach_over_kayak", kayakId });
        match = scored.match;
        scoreResults.push(scored.result);
      }
    }

    for (const event of fsmOutput.transitionEvents) {
      if (event.type === "breach_launch") {
        trickScoredRef.current = false;
        scoredKayakBreachRef.current.clear();
        triggerBreachSplash({
          position: { x: orcaX, y: 0, z: orcaZ },
          kind: "exit",
          intensity: event.charge,
          sceneElapsedS: elapsed,
        });
        controller.root.getWorldPosition(tmpWorldPos);
        breachCam.activate(tmpWorldPos, heading);
      } else if (event.type === "breach_land") {
        triggerBreachSplash({
          position: { x: orcaX, y: 0, z: orcaZ },
          kind: "entry",
          intensity: event.chargeAtLaunch,
          sceneElapsedS: elapsed,
        });
        replayBuffer.push({
          t: elapsed,
          position: { x: orcaX, y: orcaY, z: orcaZ },
          rotation: { x: livePose.pitch, y: livePose.yaw, z: livePose.roll },
          mode: "breach_land",
          charge: event.chargeAtLaunch,
        });
        if (
          shouldStartBreachReplay({
            replayBufferSize: replayBuffer.size(),
            chargeAtLaunch: event.chargeAtLaunch,
            trickScored: event.trickScored || trickScoredRef.current,
            sceneElapsedS: elapsed,
          })
        ) {
          const window = replayBuffer.getWindow(elapsed);
          controller.root.getWorldPosition(tmpWorldPos);
          replayCam.start(tmpWorldPos, window.samples, elapsed);
          match = tickMatch(match, { dt: 0, requestReplay: true });
        }
        breachCam.deactivate();
      } else if (event.type === "blowhole_squirt") {
        const origin = computeSquirtOrigin(
          { x: orcaX, y: orcaY, z: orcaZ },
          heading,
        );
        triggerBlowholeSpray({
          origin: { x: origin.x, y: origin.y, z: origin.z },
          headingRad: origin.headingRad,
          sceneElapsedS: elapsed,
          intensity: event.charge,
        });
        const squirtHits = checkSquirtConeHits(origin, kayakHitboxes);
        for (const kayakId of squirtHits) {
          if (scoredKayakBlowholeRef.current.has(kayakId)) continue;
          scoredKayakBlowholeRef.current.add(kayakId);
          const scored = applyMatchScoreEvent(match, { type: "blowhole_hit_kayak", kayakId });
          match = scored.match;
          scoreResults.push(scored.result);
        }
      }
    }

    if (match.phase === "active" || match.phase === "countdown") {
      replayBuffer.push({
        t: elapsed,
        position: { x: orcaX, y: orcaY, z: orcaZ },
        rotation: { x: livePose.pitch, y: livePose.yaw, z: livePose.roll },
        mode: fsmOutput.mode,
        charge: fsmOutput.breachCharge,
      });
    }

    const hits = checkRamCollisions(orcaX, orcaZ, boats);
    let nextBoats = boats;
    let boatsChanged = false;
    if (hits.length > 0) {
      nextBoats = nextBoats.map((b) =>
        hits.includes(b.id) && b.state === "floating"
          ? { ...b, state: "sinking", sinkProgress: 0 }
          : b,
      );
      boatsChanged = true;
      for (const boatId of hits) {
        const scored = applyMatchScoreEvent(match, { type: "ram_sink_boat", boatId });
        match = scored.match;
        scoreResults.push(scored.result);
      }
    }
    if (nextBoats.some((b) => b.state !== "floating")) {
      nextBoats = nextBoats.map((b) => (b.state === "floating" ? b : advanceSink(b, dt)));
      boatsChanged = true;
    }
    if (boatsChanged) setBoats(nextBoats);

    for (const boat of nextBoats) {
      if (boat.state !== "floating") continue;
      if (
        checkDeckLanding({
          orcaPos: { x: orcaX, y: orcaY, z: orcaZ },
          orcaVy: fsmStateRef.current.verticalVelocityMps,
          depthM: livePose.depthM,
          boatX: boat.x,
          boatZ: boat.z,
          boatHeading: boat.heading,
        })
      ) {
        const scored = applyMatchScoreEvent(match, { type: "land_on_deck", boatId: boat.id });
        match = scored.match;
        scoreResults.push(scored.result);
      }
    }

    if (ctrl.radarPing || pingRequestedRef.current) {
      pingRequestedRef.current = false;
      const liveBoats = nextBoats
        .filter((b) => b.state !== "sunk")
        .map((b) => ({ id: b.id, x: b.x, z: b.z }));
      const targets = buildRadarTargets({
        orcaX,
        orcaZ,
        orcaHeadingRad: heading,
        boats: liveBoats,
        places: metricPlaceTargets,
        worldUnitsPerMeter: PILOT_WORLD_UNITS_PER_METER,
        maxRangeWorldUnits: SONAR_MAX_RANGE_WORLD_UNITS,
      });
      sonarPing.ping(targets);
    }

    if (ctrl.sonarEmit && hydrophone && match.controlsEnabled) {
      const candidates = [
        ...nextBoats
          .filter((b) => b.state !== "sunk")
          .map((b) => ({ id: `boat:${b.id}`, x: b.x, z: b.z })),
        ...metricPlaceTargets.map((p) => ({ id: `place:${p.id}`, x: p.x, z: p.z })),
      ];
      void hydrophone
        .emitSonar({ x: orcaX, y: orcaY, z: orcaZ }, elapsed)
        .then((emitResult) => {
          const sonarTick = scoreSonarEmit(sonarScoringRef.current, {
            emitResult,
            sceneElapsedS: elapsed,
            orcaX,
            orcaZ,
            candidates,
          });
          sonarScoringRef.current = sonarTick.state;
          let nextMatch = matchRef.current;
          for (const event of sonarTick.events) {
            const scored = applyMatchScoreEvent(nextMatch, event);
            nextMatch = scored.match;
          }
          nextMatch = {
            ...nextMatch,
            scoring: mergeSonarScoringIntoMatch(nextMatch.scoring, sonarTick.state.scoring),
          };
          matchRef.current = nextMatch;
          onMatchUpdate(nextMatch);
        });
    }

    sonarPing.update(dt);
    onVisibleTargetsChange(sonarPing.getVisibleTargets());

    match = tickMatch(match, { dt, scoreResults });
    matchRef.current = match;
    onMatchUpdate(match);

    onPilotUpdate({
      x: orcaX,
      z: orcaZ,
      heading,
      depthM: livePose.depthM,
    });

    controller.root.getWorldPosition(tmpWorldPos);
    if (orcaLightRef.current) {
      orcaLightRef.current.position.set(tmpWorldPos.x, tmpWorldPos.y + 1.5, tmpWorldPos.z);
    }

    const cam = camera as THREE.PerspectiveCamera;
    if (replayCam.isPlaying() || match.phase === "replay") {
      replayCam.update(camera, elapsed, dt);
    } else if (fsmOutput.mode === "breach_air" && breachCam.isActive()) {
      breachCam.update(cam, tmpWorldPos, heading, dt);
    } else {
      if (breachCam.isActive()) breachCam.deactivate();
      if (cam instanceof THREE.PerspectiveCamera) {
        restoreBreachCameraFov(cam, BREACH_CAMERA_DEFAULT_FOV_DEG, dt);
      }
      chaseCam.update(camera, tmpWorldPos, heading, dt);
    }
  });

  return (
    <group>
      <SceneAtmosphere
        sunDirection={sun.direction}
        sunElevationDeg={sun.elevationDeg}
        tiles={tiles}
        bathyFailed={bathyFailed}
      />

      <ambientLight intensity={0.72} color="#e0f2ff" />
      <directionalLight position={[20, 60, 10]} intensity={0.55} color="#e8f6ff" />
      <directionalLight
        position={sun.direction.clone().multiplyScalar(80).toArray()}
        intensity={sun.intensity * 1.2}
        color={sun.color.getHex()}
      />
      <hemisphereLight args={["#eef8ff", "#0a3040", 0.28]} />
      <pointLight ref={orcaLightRef} intensity={2.2} distance={40} decay={2} color="#ffffff" />

      {tiles && !bathyFailed ? <primitive object={tiles.group} /> : null}

      {bathyFailed ? (
        <mesh rotation-x={-Math.PI / 2} position-y={0}>
          <planeGeometry args={[240, 240]} />
          <meshPhysicalMaterial
            color="#2e6f9e"
            roughness={0.12}
            transmission={0.6}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      <SeaSurface />

      {boats.map((boat) => (
        <group key={boat.id} position={[boat.x, 0, boat.z]}>
          <BoatMarker heading={boat.heading} sinkProgress={boat.sinkProgress} />
        </group>
      ))}

      {kayaks.map((kayak) => (
        <group key={kayak.id} position={[kayak.x, 0, kayak.z]}>
          <KayakMarker heading={kayak.heading} />
        </group>
      ))}

      <group ref={stageRef} />
    </group>
  );
}

export default function OrcaStrikeScene({
  spawn,
  match,
  onMatchUpdate,
  onFsmOutput,
}: OrcaStrikeSceneProps): JSX.Element {
  const [visibleTargets, setVisibleTargets] = useState<SonarTarget[] | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [bathyFailed, setBathyFailed] = useState(false);
  const [isMobilePilot, setIsMobilePilot] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [mobileInputReady, setMobileInputReady] = useState(false);
  const [pilotState, setPilotState] = useState({ x: 0, z: 0, heading: 0, depthM: spawn.depthM });
  const teleportRequestRef = useRef<{ x: number; z: number } | null>(null);
  const pingRequestedRef = useRef(false);
  const mobileSamplerRef = useRef<MobilePilotInputSampler | null>(null);
  const matchRef = useRef<MatchState>(match);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    setIsMobilePilot(isMobilePilotDevice());
  }, []);

  useEffect(() => {
    if (!isMobilePilot) return undefined;
    const sampler = createMobilePilotInputSampler();
    mobileSamplerRef.current = sampler;
    setMobileInputReady(true);
    return () => {
      sampler.dispose();
      mobileSamplerRef.current = null;
      setMobileInputReady(false);
    };
  }, [isMobilePilot]);

  useEffect(() => {
    if (isMobilePilot) return undefined;
    function onFirstKey() {
      setHasStarted(true);
    }
    window.addEventListener("keydown", onFirstKey, { once: true });
    return () => window.removeEventListener("keydown", onFirstKey);
  }, [isMobilePilot]);

  async function handleMobileStart(): Promise<void> {
    const sampler = mobileSamplerRef.current;
    if (sampler) {
      await sampler.requestOrientationPermission();
      sampler.setSessionActive(true);
    }
    setHasStarted(true);
  }

  function handleSonarPing(): void {
    pingRequestedRef.current = true;
  }

  function handleSelectTarget(target: SonarTarget): void {
    teleportRequestRef.current = { x: target.x, z: target.z };
    setVisibleTargets(null);
  }

  const visibleTargetsRef = useRef<SonarTarget[] | null>(null);
  visibleTargetsRef.current = visibleTargets;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const digit = Number(e.key);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
      const target = visibleTargetsRef.current?.[digit - 1];
      if (target) handleSelectTarget(target);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#08263d",
        touchAction: isMobilePilot ? "none" : undefined,
      }}
    >
      <Canvas
        camera={{ position: [10, 6, 14], fov: 50, near: 0.1, far: 800 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.22;
        }}
      >
        <SceneContent
          spawn={spawn}
          matchRef={matchRef}
          onMatchUpdate={onMatchUpdate}
          onFsmOutput={onFsmOutput}
          onVisibleTargetsChange={setVisibleTargets}
          onPointerLockChange={setPointerLocked}
          onBathyFailed={() => setBathyFailed(true)}
          onPilotUpdate={setPilotState}
          teleportRequestRef={teleportRequestRef}
          pingRequestedRef={pingRequestedRef}
          isMobilePilot={isMobilePilot}
          mobileSamplerRef={mobileSamplerRef}
        />
      </Canvas>

      <SonarContextMap
        orcaX={pilotState.x}
        orcaZ={pilotState.z}
        orcaHeadingRad={pilotState.heading}
        revealedTargets={visibleTargets}
        onSelectTarget={handleSelectTarget}
      />

      {bathyFailed && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 10px",
            borderRadius: 6,
            background: "rgba(120,40,20,0.75)",
            pointerEvents: "none",
            ...HUD_TEXT_STYLE,
          }}
        >
          Bathymetry tileset failed to load. Flat water-plane fallback active.
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "linear-gradient(90deg, #7ed4ff, #e8fbff, #7ed4ff)",
          opacity: pilotState.depthM > 0.2 ? 0.95 : 0.35,
          pointerEvents: "none",
          boxShadow: "0 0 18px rgba(180,230,255,0.55)",
        }}
        title="Water surface"
      />

      {match.phase === "countdown" && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "38%",
            transform: "translate(-50%, -50%)",
            padding: "18px 28px",
            borderRadius: 12,
            background: "rgba(8,38,61,0.9)",
            border: "1px solid rgba(207,230,255,0.35)",
            pointerEvents: "none",
            ...HUD_TEXT_STYLE,
            fontSize: 28,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {Math.max(1, Math.ceil(3 - match.phaseTimeS))}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          padding: "14px 18px",
          borderRadius: 10,
          background: "rgba(8,38,61,0.84)",
          border: "1px solid rgba(207,230,255,0.25)",
          pointerEvents: "none",
          display:
            match.phase === "active" && !isMobilePilot && !pointerLocked && !hasStarted
              ? "block"
              : "none",
          ...HUD_TEXT_STYLE,
          textAlign: "center",
          maxWidth: 340,
        }}
      >
        <strong>Click to pilot the orca.</strong>
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          Q dive · E surface · W/S thrust · A/D roll · Space breach · B blowhole · O hydrophone · F
          sonar · 1-9 warp
        </div>
      </div>

      {isMobilePilot && mobileInputReady && (
        <MobileControlsOverlay
          sampler={mobileSamplerRef.current}
          hasStarted={hasStarted}
          onStart={() => void handleMobileStart()}
          onSonarPing={handleSonarPing}
          visibleTargets={visibleTargets}
          onSelectTarget={handleSelectTarget}
        />
      )}

      <div
        style={{
          position: "absolute",
          pointerEvents: "none",
          left: 12,
          bottom: 12,
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(8,38,61,0.7)",
          border: "1px solid rgba(207,230,255,0.18)",
          ...HUD_TEXT_STYLE,
        }}
      >
        <strong>Orca Strike</strong>
        <div style={{ opacity: 0.75, marginTop: 4 }}>
          {isMobilePilot
            ? "Tilt to steer. Tap Sonar to fill the map, tap a blip to warp."
            : "Q/E depth · A/D roll · Space breach · B blowhole · O hydrophone · F sonar"}
        </div>
        <div style={{ opacity: 0.55, marginTop: 4 }}>
          Surface at y=0 · depth {pilotState.depthM.toFixed(1)}m · {spawn.islandId}
        </div>
      </div>

      {visibleTargets && visibleTargets.length > 0 && !isMobilePilot && (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(8,38,61,0.84)",
            border: "1px solid rgba(207,230,255,0.25)",
            ...HUD_TEXT_STYLE,
            minWidth: 220,
          }}
        >
          <strong>Sonar</strong>
          <div style={{ opacity: 0.75, marginTop: 2, marginBottom: 4 }}>Press 1-9 to select</div>
          <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 4 }}>
            {visibleTargets.slice(0, 9).map((target, index) => (
              <button
                key={target.id}
                onClick={() => handleSelectTarget(target)}
                style={{
                  textAlign: "left",
                  background: "rgba(207,230,255,0.08)",
                  border: "1px solid rgba(207,230,255,0.2)",
                  borderRadius: 6,
                  color: "#cfe6ff",
                  padding: "4px 8px",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                [{index + 1}] {target.kind === "boat" ? "🚤" : "📍"} {target.label} —{" "}
                {bearingLabel(target.bearingRad)}, {Math.round(target.rangeMeters)}m
              </button>
            ))}
          </div>
        </div>
      )}

      {match.phase === "ended" && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "42%",
            transform: "translate(-50%, -50%)",
            padding: "20px 28px",
            borderRadius: 12,
            background: "rgba(8,38,61,0.92)",
            border: "1px solid rgba(207,230,255,0.35)",
            pointerEvents: "none",
            ...HUD_TEXT_STYLE,
            textAlign: "center",
            minWidth: 260,
          }}
        >
          <strong>Round over</strong>
          <div style={{ marginTop: 8, fontSize: 22, color: "#3ecfff" }}>
            {match.scoring.total} pts
          </div>
          {match.endReason === "deck_win" && (
            <div style={{ marginTop: 6, opacity: 0.85 }}>Deck landing win</div>
          )}
        </div>
      )}
    </div>
  );
}
