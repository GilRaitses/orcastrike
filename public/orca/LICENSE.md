# orca.glb - source mesh license and attribution

`orca.glb` in this directory is a converted, reoriented, texture-optimized, and
meshopt-compressed derivative of a Creative Commons licensed killer whale model.
CC-BY requires that this attribution travel with the asset and any published build.

## Honesty label

This is an artist-**modeled** animal. It is not a 3D scan of a real, named orca,
and it is not derived from measured biologging data. Motion applied to it elsewhere
in the twin is driven by separately labeled real or simulated telemetry, not by this
mesh.

## Source asset actually used (PRIMARY - Trouvaille CC-BY 4.0)

- Title: **Killer Whale**
- Author: **Abner Wu / Trouvaille (@dashdu)**
- License: **Creative Commons Attribution 4.0 (CC-BY 4.0)** - http://creativecommons.org/licenses/by/4.0/
- Source page: https://sketchfab.com/3d-models/killer-whale-63b680d7e58f463a9868ed7bf163094a
- Author page: https://sketchfab.com/dashdu
- Date acquired: 2026-06-28 (operator download, glTF export)

### Required attribution text (reproduce wherever the asset is shown)

> This work is based on "Killer Whale"
> (https://sketchfab.com/3d-models/killer-whale-63b680d7e58f463a9868ed7bf163094a)
> by Abner Wu (https://sketchfab.com/dashdu) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/). Modified for the ORCAST underwater
> twin: reoriented to +X forward / +Y up, scaled to 7.0 m metric length, recentered,
> textures resized 2K to 1K, welded/deduplicated/pruned, and meshopt-compressed.

## Changes made to produce orca.glb (CC-BY "indicate changes" requirement)

- Reoriented to the twin frame: rotated +90 degrees about Y so the rostrum points +X
  (forward) with +Y up. Source orientation had the body length along Z (nose +Z, fluke -Z).
- Uniformly scaled to a body length of **7.0 m** (midpoint of the 6-8 m adult range in
  docs/orca/SKELETON.md), placing the mesh in a metric frame (1 unit = 1 meter).
- Recentered on the bounding-box origin.
- Resized the baseColor and normal textures from 2048x2048 to 1024x1024 and re-encoded
  as PNG (OMAT-R LOD-1 set; halves the wire size at no visible cost on a 7 m animal).
- Welded, deduplicated, and pruned (no geometry decimation; triangle count unchanged).
- Applied `EXT_meshopt_compression` (the compression already decoded by the existing
  tile runtime).

## Resulting asset

- Triangles: 3072. Vertices: 1656. Bounding box (m): X(length)=7.00, Y(up)=2.79, Z(lateral)=3.68.
- Maps: baseColor (painted countershading) + tangent-space normal, 1024x1024 PNG.
- File size: ~475 KB (`orca.glb`).
- KTX2/Basis texture compression is NOT applied (no `toktx` binary in the build env, and
  KTX2 adds a runtime Basis transcoder dependency to the standalone orca loader). This is
  a flagged, deferred optimization for O0: with a `toktx` install plus a `KTX2Loader` wired
  onto the orca `GLTFLoader`, the 1K PNG set drops to roughly 0.3-0.5 MB on the wire.

## Backup asset (CC-BY 3.0 Poly by Google) - retained for hot-swap

`orca-poly-backup.glb` is the previous backup mesh, kept so O0 can revert with a one-line
loader change if needed.

- Title: **Killer Whale**, Author: **Poly by Google**
- License: **CC-BY 3.0** - https://creativecommons.org/licenses/by/3.0/
- Source page: https://poly.pizza/m/7pqZEQ9b_E-
- Direct source file: https://static.poly.pizza/a7baa268-485e-4bc8-a936-64087228e963.glb

> "Killer Whale" by Poly by Google, licensed under CC-BY 3.0
> (https://creativecommons.org/licenses/by/3.0/), via Poly Pizza
> (https://poly.pizza/m/7pqZEQ9b_E-). Modified: reoriented, scaled to metric, and
> meshopt-compressed for the ORCAST underwater twin.

- Triangles: 636. Vertices: 1137. File size: ~28.4 KB. Tiny 32x32 baseColor texture only.
