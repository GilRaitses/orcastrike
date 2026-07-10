// Bake a true-scale DECORATIVE DEM horizon ring asset from AWS Terrain Tiles.
//
// Provenance. Source is the Mapzen-derived global bare-earth DEM published on the
// Registry of Open Data on AWS, bucket s3://elevation-tiles-prod, Terrarium PNG
// height encoding, no AWS account required. The composite aggregates SRTM,
// NASADEM, GMTED, NED and 3DEP. The consumer is responsible for per-source
// attribution. The geometry built from this asset is labeled decorative, not
// surveyed, in horizonRing.ts userData and in WIRING-decor.md.
//
// No new npm dependency. PNG decode uses only Node builtins (https, zlib). This
// build script lives under web/lib/scene/decor/ (Scenic Decorator ownership) and
// writes one static asset under web/public/geo/ (also Scenic Decorator owned).
//
// Run:  node web/lib/scene/decor/bakeHorizonRing.mjs
//
// Honesty. Every elevation in the output is a real sample of the open DEM at the
// computed lat/lng. Nothing here invents place data.

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:https";
import { inflateSync } from "node:zlib";

// --- Served extent centre (matches SalishScene TILESET_BOUNDS) -------------
// lat 48.40..48.70, lng -123.25..-122.75 -> centre 48.55, -123.00.
const CENTER = { lat: 48.55, lng: -123.0 };

// Ring radii in metres. rMin sits just beyond the served half-diagonal (~24.8 km)
// so the ring starts outside the rendered tiles. rMax reaches the far ranges
// (Olympics, Cascades/Baker, Vancouver Island) at ~120 km.
const R_MIN_M = 28_000;
const R_MAX_M = 120_000;

// Polar sample grid. 360 bearings (1 deg) x 56 radial steps.
const N_BEARINGS = 360;
const N_RADII = 56;

// Slippy-tile zoom. z9 is ~150 m/px at this latitude, enough for a distant
// silhouette while keeping the fetch small.
const ZOOM = 9;

const TILE_URL = (z, x, y) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

const R_EARTH = 6_371_000;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Forward geodesic on a sphere: destination lat/lng from a start point, a true
// bearing (clockwise from north) and a distance in metres.
function destPoint(lat, lng, bearingDeg, distM) {
  const d = distM / R_EARTH;
  const th = bearingDeg * DEG;
  const f1 = lat * DEG;
  const l1 = lng * DEG;
  const sinF2 = Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(th);
  const f2 = Math.asin(Math.max(-1, Math.min(1, sinF2)));
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(th) * Math.sin(d) * Math.cos(f1),
      Math.cos(d) - Math.sin(f1) * sinF2,
    );
  return { lat: f2 * RAD, lng: l2 * RAD };
}

// Web Mercator slippy projection: fractional tile coordinates at a zoom.
function lngLatToFracTile(lat, lng, z) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latR = lat * DEG;
  const y = ((1 - Math.asinh(Math.tan(latR)) / Math.PI) / 2) * n;
  return { x, y };
}

// --- PNG decode (8-bit RGB, non-interlaced) using only zlib -----------------
function readChunks(buf) {
  // Skip the 8-byte PNG signature.
  let off = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const dataStart = off + 8;
    if (type === "IHDR") {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
    } else if (type === "IDAT") {
      idat.push(buf.subarray(dataStart, dataStart + len));
    } else if (type === "IEND") {
      break;
    }
    off = dataStart + len + 4; // + 4 byte CRC
  }
  return { width, height, bitDepth, colorType, idat: Buffer.concat(idat) };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Returns a Float32 elevation grid (metres) of size width*height.
function decodeTerrarium(buf) {
  const { width, height, bitDepth, colorType, idat } = readChunks(buf);
  if (bitDepth !== 8 || colorType !== 2) {
    throw new Error(`unexpected PNG format bitDepth=${bitDepth} colorType=${colorType}`);
  }
  const channels = 3;
  const raw = inflateSync(idat);
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  let prev = new Uint8Array(stride);
  let rp = 0;
  for (let row = 0; row < height; row++) {
    const filter = raw[rp++];
    const cur = out.subarray(row * stride, row * stride + stride);
    for (let i = 0; i < stride; i++) {
      const x = raw[rp++];
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let val;
      switch (filter) {
        case 0: val = x; break;
        case 1: val = x + a; break;
        case 2: val = x + b; break;
        case 3: val = x + ((a + b) >> 1); break;
        case 4: val = x + paeth(a, b, c); break;
        default: throw new Error(`bad filter ${filter}`);
      }
      cur[i] = val & 0xff;
    }
    prev = cur;
  }
  const elev = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = out[i * 3];
    const g = out[i * 3 + 1];
    const b = out[i * 3 + 2];
    elev[i] = r * 256 + g + b / 256 - 32768;
  }
  return { width, height, elev };
}

// --- Tile cache + fetch -----------------------------------------------------
const tileCache = new Map();

function fetchBuffer(url) {
  return new Promise((res, rej) => {
    get(url, (r) => {
      if (r.statusCode !== 200) {
        r.resume();
        rej(new Error(`HTTP ${r.statusCode} for ${url}`));
        return;
      }
      const parts = [];
      r.on("data", (d) => parts.push(d));
      r.on("end", () => res(Buffer.concat(parts)));
    }).on("error", rej);
  });
}

async function getTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  let t = tileCache.get(key);
  if (t) return t;
  const buf = await fetchBuffer(TILE_URL(z, x, y));
  t = decodeTerrarium(buf);
  tileCache.set(key, t);
  return t;
}

// Bilinear sample of the DEM at a lat/lng (metres).
async function sampleElev(lat, lng, z) {
  const n = 2 ** z;
  const { x: fx, y: fy } = lngLatToFracTile(lat, lng, z);
  const px = fx * 256;
  const py = fy * 256;
  const gx = Math.floor(px - 0.5);
  const gy = Math.floor(py - 0.5);
  const tx = px - 0.5 - gx;
  const ty = py - 0.5 - gy;

  async function pixel(gpx, gpy) {
    let ix = gpx;
    let iy = gpy;
    let tileX = Math.floor(ix / 256);
    let tileY = Math.floor(iy / 256);
    tileX = ((tileX % n) + n) % n;
    tileY = Math.max(0, Math.min(n - 1, tileY));
    const lx = ((ix % 256) + 256) % 256;
    const ly = Math.max(0, Math.min(255, ((iy % 256) + 256) % 256));
    const tile = await getTile(z, tileX, tileY);
    return tile.elev[ly * tile.width + lx];
  }

  const e00 = await pixel(gx, gy);
  const e10 = await pixel(gx + 1, gy);
  const e01 = await pixel(gx, gy + 1);
  const e11 = await pixel(gx + 1, gy + 1);
  const top = e00 * (1 - tx) + e10 * tx;
  const bot = e01 * (1 - tx) + e11 * tx;
  return top * (1 - ty) + bot * ty;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, "../../../public/geo/horizon-ring.json");
  await mkdir(dirname(outPath), { recursive: true });

  const elevMeters = new Array(N_BEARINGS * N_RADII);
  let done = 0;
  for (let i = 0; i < N_BEARINGS; i++) {
    const bearing = (i / N_BEARINGS) * 360;
    for (let j = 0; j < N_RADII; j++) {
      const t = N_RADII === 1 ? 0 : j / (N_RADII - 1);
      const distM = R_MIN_M + t * (R_MAX_M - R_MIN_M);
      const p = destPoint(CENTER.lat, CENTER.lng, bearing, distM);
      const e = await sampleElev(p.lat, p.lng, ZOOM);
      elevMeters[i * N_RADII + j] = Math.round(e);
    }
    done++;
    if (done % 30 === 0) {
      process.stdout.write(`  bearings ${done}/${N_BEARINGS}, tiles cached ${tileCache.size}\n`);
    }
  }

  const asset = {
    schema: "orcast.horizon-ring.v1",
    decorativeNotSurveyed: true,
    label: "decorative, not surveyed",
    source: "AWS Terrain Tiles (s3://elevation-tiles-prod)",
    dataset: "Mapzen Terrarium global DEM (SRTM, NASADEM, GMTED, NED, 3DEP)",
    attribution:
      "Distant terrain decorative, sampled from AWS Terrain Tiles, derived from SRTM, NASADEM, GMTED. Not surveyed.",
    center: CENTER,
    rMinMeters: R_MIN_M,
    rMaxMeters: R_MAX_M,
    nBearings: N_BEARINGS,
    nRadii: N_RADII,
    zoom: ZOOM,
    bearingFromNorthClockwise: true,
    elevMeters,
  };

  await new Promise((res, rej) => {
    const ws = createWriteStream(outPath);
    ws.on("error", rej);
    ws.on("finish", res);
    ws.write(JSON.stringify(asset));
    ws.end();
  });

  const peak = Math.max(...elevMeters);
  process.stdout.write(
    `wrote ${outPath}\n  samples ${elevMeters.length}, tiles fetched ${tileCache.size}, peak ${peak} m\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`bake failed: ${err.stack || err}\n`);
  process.exit(1);
});
