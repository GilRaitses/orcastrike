# Orca Strike

Standalone arcade game: pilot an orca over real Salish Sea bathymetry, ram boats,
breach, blowhole squirt, hydrophone sonar, timed scoring.

**No WorkOS. No Playwright. No orcast forecasting site.**

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000/orca-strike

## Assets (all in this repo)

| Asset | Path |
|-------|------|
| Skinned orca GLB | `public/orca/orca.glb` |
| DTAG driver | `public/orca/motion/orca_srkw_oo14_driver.{json,bin}` |
| Hydrophone audio | `public/hydrophone/slice/orcasound_lab_20210825_srkw.m4a` |
| Classifications | `public/hydrophone/slice/classification.json` |
| Tileset | CloudFront URL in `app/orca-strike/OrcaStrikeScene.tsx` |

## Bash.tv builder

Paste `deliverable/BASH_TV_BUILDER_PROMPT.txt`

## Controls

Q dive, E surface, W/S forward/back, A/D roll, Space breach, B blowhole, O sonar, F radar, 1–9 teleport.

Specs: ported from [orcast](https://github.com/GilRaitses/orcast) STRIKE lane.
