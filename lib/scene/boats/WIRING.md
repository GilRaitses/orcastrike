# WIRING boats layer

Wave 2, agent `HUNT-W2 build Agent B` of the `orca-boat-hunt` prototype. This
module owns only `web/lib/scene/boats/`. It provides arcade toy boat props,
numeric ram collision checks, and the sink visual state. It does not use AIS,
labels, routes, sonar code, or real vessel traffic data.

## Exports

```ts
import {
  BoatMarker,
  advanceSink,
  checkRamCollisions,
  spawnBoats,
  type Boat,
} from "@/lib/scene/boats";
```

## Constants

`DEFAULT_BOAT_COUNT` is 8.

`DEFAULT_MIN_RADIUS` is 14 scene units.

`DEFAULT_MAX_RADIUS` is 54 scene units.

`DEFAULT_BOAT_COLLISION_RADIUS` is 2.2 scene units.

`SINK_DURATION_SECONDS` is 1.8 seconds.

`SEA_LEVEL_Y` is 0.

These defaults keep the boats inside the 120-unit scene width while leaving the
origin open for the orca to accelerate into targets during a short play session.

## Runtime Wiring

Spawn boats once when the hunt scene initializes.

```ts
const [boats, setBoats] = useState<Boat[]>(() => spawnBoats({ seed: 7 }));
```

Each frame, read the orca world X/Z position from the future controller owner,
then check only numeric ram collisions.

```ts
const hits = checkRamCollisions(orcaX, orcaZ, boats);
```

For any hit id, flip the boat from `floating` to `sinking`. Keep this transition
in the route or controller owner so the pure helper stays stateless.

```ts
setBoats((current) =>
  current.map((boat) =>
    hits.includes(boat.id) && boat.state === "floating"
      ? { ...boat, state: "sinking", sinkProgress: 0 }
      : boat,
  ),
);
```

On every frame after that, advance non-floating boats.

```ts
setBoats((current) =>
  current.map((boat) => (boat.state === "floating" ? boat : advanceSink(boat, dt))),
);
```

Render with caller-owned placement at sea level.

```tsx
{boats.map((boat) => (
  <group key={boat.id} position={[boat.x, 0, boat.z]}>
    <BoatMarker heading={boat.heading} sinkProgress={boat.sinkProgress} />
  </group>
))}
```

The eventual route should include the required in-scene disclaimer text,
`arcade prototype, not navigational or scientific data`.

## Validation

Run from `web/`.

```sh
npm run typecheck
npm run lint
```

Lint is expected to block at the repo level because the project has no ESLint
configuration for `next lint` in this lane. Do not add an ESLint config or a new
dependency from this module.
