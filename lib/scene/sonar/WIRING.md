# Sonar Wiring

This module is the Wave 2 Agent C sonar surface for `orca-boat-hunt`. It is pure TypeScript. It does not import the orca pilot module, the boat module, React, or three.js.

The sonar readout is an arcade radar snapshot. It reports bearing and range from the orca for nearby boats and curated places. It does not model real sonar, acoustics, or navigation.

## Public Surface

- `getCuratedPlaceTargets(bounds, depth)` projects the curated gazetteer picks into world X/Z.
- `buildRadarTargets(opts)` merges plain boat data and optional place targets into sorted radar rows.
- `createSonarPing()` stores one ping snapshot for the HUD.
- `createTeleportBeat()` produces a short teleport beat and target X/Z for the later integrator to apply.

## Integration Steps

Build the static place targets once:

```ts
const TILESET_BOUNDS = {
  min_lat: 48.4,
  max_lat: 48.7,
  min_lng: -123.25,
  max_lng: -122.75,
};

const depth = sceneDepth(TILESET_BOUNDS);
const placeTargets = getCuratedPlaceTargets(TILESET_BOUNDS, depth);
```

On sonar ping, map live boats into plain data and build the snapshot:

```ts
const targets = buildRadarTargets({
  orcaX,
  orcaZ,
  orcaHeadingRad,
  boats: liveBoats.map((boat) => ({
    id: boat.id,
    label: boat.label,
    x: boat.x,
    z: boat.z,
  })),
  places: placeTargets,
  worldUnitsPerMeter,
  maxRangeWorldUnits,
});

sonarPing.ping(targets);
```

Show `sonarPing.getVisibleTargets()` in the HUD. On target selection, close the ping if desired and start the teleport:

```ts
sonarPing.clear();
teleportBeat.start(target.x, target.z);
```

Every frame, advance the beat and apply the returned position in the integrator only:

```ts
if (teleportBeat.isActive()) {
  teleportBeat.update(dt);
  const xz = teleportBeat.currentXZ();
  if (xz) {
    controller.root.position.x = xz.x;
    controller.root.position.z = xz.z;
  }
}
```

The write to `controller.root.position` belongs to the future gated integration wave. Nothing in `web/lib/scene/sonar/` touches the orca controller or any boat object.

## Bearing Convention

`buildRadarTargets` returns relative bearing in radians. `orcaHeadingRad = 0` points toward world `+X`, matching `orcaPilot/deadReckoning.ts`'s forward vector `(cos(heading), -sin(heading))` and `OrcaRig.setOrientation`'s `rotateY(yaw)`. Returned target bearings are normalized to `[-PI, PI]`, where `0` is straight ahead and positive values are to the orca's right.

## Curated Places

The curated in-bounds picks are:

- Friday Harbor
- Roche Harbor
- Deer Harbor
- Lime Kiln Point
- Jones Island
- Orcas Village
- East Sound
- San Juan Island

## Constants

- Ping visibility is `7` seconds by default.
- Teleport beat duration is `420` milliseconds by default.
- Teleport position snaps immediately to the selected target. Only the visual flash fades over the beat.
