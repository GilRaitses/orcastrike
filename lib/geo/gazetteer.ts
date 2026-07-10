// Curated Salish Sea gazetteer: place name -> { lat, lng, bounds, kind }.
//
// This module is the deterministic, offline-first place resolver for the Console
// Journey planner. It maps a free-text query (such as "east sound" or "friday
// harbor") to a curated WGS84 location with a bounding box the 3D scene can frame.
//
// Bounds use the same field shape as HeightmapBounds in web/lib/sceneIntent.ts
// (min_lat / max_lat / min_lng / max_lng), so a resolved place feeds projectToScene
// directly. Longitudes are negative west of Greenwich, matching the scene frame
// (TILESET_BOUNDS lng -123.25..-122.75).
//
// The module is fully offline at import and at call time: resolvePlace never
// touches the network. The optional Photon typeahead client (resolvePlaceAsync /
// queryPhoton) is gated behind the PHOTON_URL env var and is only consulted when
// the curated gazetteer misses. With PHOTON_URL unset it is a no-op.

export type PlaceKind =
  | "sound"
  | "harbor"
  | "island"
  | "village"
  | "terminal"
  | "airport"
  | "landmark"
  | "city";

// Structurally identical to HeightmapBounds in web/lib/sceneIntent.ts so a Place
// bounds object can be passed to projectToScene / unprojectFromScene unchanged.
export interface PlaceBounds {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

export interface Place {
  // Stable slug id (kebab-case), unique within the gazetteer.
  id: string;
  // Canonical display name.
  name: string;
  // WGS84 center used as the camera target.
  lat: number;
  lng: number;
  // Bounding box used to frame the place in the scene.
  bounds: PlaceBounds;
  kind: PlaceKind;
  // Alternate spellings / partials that should resolve to this place.
  aliases?: string[];
  // Coarse grouping for downstream UI; not used by the resolver.
  region?: "san-juans" | "mainland" | "bc" | "puget-sound";
}

// Build a bounding box from a center and a half-extent in degrees. latHalf and
// lngHalf are the half-height and half-width; lngHalf is typically larger than
// latHalf at this latitude (a degree of longitude is shorter than a degree of
// latitude near 48.5 N).
function box(
  lat: number,
  lng: number,
  latHalf: number,
  lngHalf: number,
): PlaceBounds {
  return {
    min_lat: lat - latHalf,
    max_lat: lat + latHalf,
    min_lng: lng - lngHalf,
    max_lng: lng + lngHalf,
  };
}

// The curated dataset. ~40 real Salish Sea places with accurate WGS84 centers
// and a hand-sized bounding box per place (points get tight boxes, islands wide
// ones). Coordinates verified against published charts and place records.
export const GAZETTEER: Place[] = [
  {
    id: "east-sound",
    name: "East Sound",
    lat: 48.6935,
    lng: -122.9043,
    bounds: box(48.6935, -122.9043, 0.02, 0.025),
    kind: "village",
    aliases: ["eastsound", "east sound village", "orcas village center"],
    region: "san-juans",
  },
  {
    id: "friday-harbor",
    name: "Friday Harbor",
    lat: 48.5343,
    lng: -123.0179,
    bounds: box(48.5343, -123.0179, 0.018, 0.022),
    kind: "harbor",
    aliases: ["friday harbour", "fridayharbor", "san juan town"],
    region: "san-juans",
  },
  {
    id: "orcas-island",
    name: "Orcas Island",
    lat: 48.6667,
    lng: -122.9333,
    bounds: box(48.6667, -122.9333, 0.075, 0.11),
    kind: "island",
    aliases: ["orcas", "orcas isle"],
    region: "san-juans",
  },
  {
    id: "orcas-village",
    name: "Orcas Village",
    lat: 48.5975,
    lng: -122.9445,
    bounds: box(48.5975, -122.9445, 0.01, 0.012),
    kind: "terminal",
    aliases: ["orcas landing", "orcas ferry", "orcas ferry landing"],
    region: "san-juans",
  },
  {
    id: "lopez-island",
    name: "Lopez Island",
    lat: 48.4807,
    lng: -122.8868,
    bounds: box(48.4807, -122.8868, 0.07, 0.06),
    kind: "island",
    aliases: ["lopez", "lopez isle"],
    region: "san-juans",
  },
  {
    id: "lopez-village",
    name: "Lopez Village",
    lat: 48.5126,
    lng: -122.8945,
    bounds: box(48.5126, -122.8945, 0.012, 0.014),
    kind: "village",
    aliases: ["lopez town"],
    region: "san-juans",
  },
  {
    id: "anacortes",
    name: "Anacortes",
    lat: 48.5126,
    lng: -122.6127,
    bounds: box(48.5126, -122.6127, 0.03, 0.04),
    kind: "city",
    aliases: ["anacortes ferry terminal", "anacortes terminal", "anacortez"],
    region: "mainland",
  },
  {
    id: "roche-harbor",
    name: "Roche Harbor",
    lat: 48.6111,
    lng: -123.1556,
    bounds: box(48.6111, -123.1556, 0.014, 0.018),
    kind: "harbor",
    aliases: ["roche harbour", "roche"],
    region: "san-juans",
  },
  {
    id: "deer-harbor",
    name: "Deer Harbor",
    lat: 48.6182,
    lng: -123.0011,
    bounds: box(48.6182, -123.0011, 0.012, 0.016),
    kind: "harbor",
    aliases: ["deer harbour"],
    region: "san-juans",
  },
  {
    id: "shaw-island",
    name: "Shaw Island",
    lat: 48.5833,
    lng: -122.9333,
    bounds: box(48.5833, -122.9333, 0.03, 0.04),
    kind: "island",
    aliases: ["shaw"],
    region: "san-juans",
  },
  {
    id: "sucia-island",
    name: "Sucia Island",
    lat: 48.7531,
    lng: -122.9019,
    bounds: box(48.7531, -122.9019, 0.02, 0.03),
    kind: "island",
    aliases: ["sucia"],
    region: "san-juans",
  },
  {
    id: "san-juan-island",
    name: "San Juan Island",
    lat: 48.5333,
    lng: -123.0833,
    bounds: box(48.5333, -123.0833, 0.085, 0.085),
    kind: "island",
    aliases: ["san juan", "san juans", "sanjuan island"],
    region: "san-juans",
  },
  {
    id: "decatur-island",
    name: "Decatur Island",
    lat: 48.5072,
    lng: -122.8127,
    bounds: box(48.5072, -122.8127, 0.025, 0.03),
    kind: "island",
    aliases: ["decatur"],
    region: "san-juans",
  },
  {
    id: "blakely-island",
    name: "Blakely Island",
    lat: 48.5783,
    lng: -122.8205,
    bounds: box(48.5783, -122.8205, 0.025, 0.03),
    kind: "island",
    aliases: ["blakely"],
    region: "san-juans",
  },
  {
    id: "cypress-island",
    name: "Cypress Island",
    lat: 48.5833,
    lng: -122.7,
    bounds: box(48.5833, -122.7, 0.035, 0.03),
    kind: "island",
    aliases: ["cypress"],
    region: "san-juans",
  },
  {
    id: "guemes-island",
    name: "Guemes Island",
    lat: 48.5497,
    lng: -122.63,
    bounds: box(48.5497, -122.63, 0.025, 0.03),
    kind: "island",
    aliases: ["guemes"],
    region: "mainland",
  },
  {
    id: "bellingham",
    name: "Bellingham",
    lat: 48.7519,
    lng: -122.4787,
    bounds: box(48.7519, -122.4787, 0.04, 0.05),
    kind: "city",
    aliases: ["b'ham", "bham"],
    region: "mainland",
  },
  {
    id: "bellingham-bay",
    name: "Bellingham Bay",
    lat: 48.7,
    lng: -122.53,
    bounds: box(48.7, -122.53, 0.05, 0.06),
    kind: "sound",
    aliases: ["bellingham harbor", "bellingham harbour"],
    region: "mainland",
  },
  {
    id: "rosario",
    name: "Rosario",
    lat: 48.6453,
    lng: -122.8714,
    bounds: box(48.6453, -122.8714, 0.01, 0.012),
    kind: "landmark",
    aliases: ["rosario resort", "rosario orcas"],
    region: "san-juans",
  },
  {
    id: "olga",
    name: "Olga",
    lat: 48.6122,
    lng: -122.8126,
    bounds: box(48.6122, -122.8126, 0.01, 0.012),
    kind: "village",
    aliases: ["olga orcas"],
    region: "san-juans",
  },
  {
    id: "doe-bay",
    name: "Doe Bay",
    lat: 48.6457,
    lng: -122.774,
    bounds: box(48.6457, -122.774, 0.01, 0.012),
    kind: "landmark",
    aliases: ["doe bay resort"],
    region: "san-juans",
  },
  {
    id: "spencer-spit",
    name: "Spencer Spit",
    lat: 48.5392,
    lng: -122.8615,
    bounds: box(48.5392, -122.8615, 0.008, 0.01),
    kind: "landmark",
    aliases: ["spencer spit state park", "spencer spit lopez"],
    region: "san-juans",
  },
  {
    id: "lime-kiln",
    name: "Lime Kiln Point",
    lat: 48.5158,
    lng: -123.152,
    bounds: box(48.5158, -123.152, 0.008, 0.01),
    kind: "landmark",
    aliases: ["lime kiln", "lime kiln lighthouse", "whale watch park"],
    region: "san-juans",
  },
  {
    id: "cattle-point",
    name: "Cattle Point",
    lat: 48.4506,
    lng: -122.9636,
    bounds: box(48.4506, -122.9636, 0.008, 0.01),
    kind: "landmark",
    aliases: ["cattle point lighthouse"],
    region: "san-juans",
  },
  {
    id: "stuart-island",
    name: "Stuart Island",
    lat: 48.6772,
    lng: -123.1853,
    bounds: box(48.6772, -123.1853, 0.02, 0.03),
    kind: "island",
    aliases: ["stuart"],
    region: "san-juans",
  },
  {
    id: "patos-island",
    name: "Patos Island",
    lat: 48.7847,
    lng: -122.97,
    bounds: box(48.7847, -122.97, 0.012, 0.02),
    kind: "island",
    aliases: ["patos"],
    region: "san-juans",
  },
  {
    id: "matia-island",
    name: "Matia Island",
    lat: 48.7464,
    lng: -122.8731,
    bounds: box(48.7464, -122.8731, 0.01, 0.015),
    kind: "island",
    aliases: ["matia"],
    region: "san-juans",
  },
  {
    id: "clark-island",
    name: "Clark Island",
    lat: 48.6997,
    lng: -122.7637,
    bounds: box(48.6997, -122.7637, 0.01, 0.012),
    kind: "island",
    aliases: ["clark"],
    region: "san-juans",
  },
  {
    id: "jones-island",
    name: "Jones Island",
    lat: 48.6213,
    lng: -123.043,
    bounds: box(48.6213, -123.043, 0.01, 0.012),
    kind: "island",
    aliases: ["jones"],
    region: "san-juans",
  },
  {
    id: "turn-point",
    name: "Turn Point",
    lat: 48.6889,
    lng: -123.24,
    bounds: box(48.6889, -123.24, 0.008, 0.01),
    kind: "landmark",
    aliases: ["turn point lighthouse", "turn point stuart"],
    region: "san-juans",
  },
  {
    id: "point-roberts",
    name: "Point Roberts",
    lat: 48.9783,
    lng: -123.075,
    bounds: box(48.9783, -123.075, 0.025, 0.03),
    kind: "village",
    aliases: ["pt roberts", "point roberts wa"],
    region: "mainland",
  },
  {
    id: "sidney-bc",
    name: "Sidney BC",
    lat: 48.6506,
    lng: -123.3986,
    bounds: box(48.6506, -123.3986, 0.025, 0.03),
    kind: "city",
    aliases: ["sidney", "sidney british columbia"],
    region: "bc",
  },
  {
    id: "victoria-bc",
    name: "Victoria BC",
    lat: 48.4284,
    lng: -123.3656,
    bounds: box(48.4284, -123.3656, 0.04, 0.05),
    kind: "city",
    aliases: ["victoria", "victoria british columbia", "victoria harbour"],
    region: "bc",
  },
  {
    id: "port-townsend",
    name: "Port Townsend",
    lat: 48.117,
    lng: -122.7604,
    bounds: box(48.117, -122.7604, 0.025, 0.03),
    kind: "city",
    aliases: ["pt townsend", "porttownsend"],
    region: "puget-sound",
  },
  {
    id: "coupeville",
    name: "Coupeville",
    lat: 48.2201,
    lng: -122.6857,
    bounds: box(48.2201, -122.6857, 0.025, 0.03),
    kind: "village",
    aliases: ["whidbey", "whidbey island", "coupeville whidbey"],
    region: "puget-sound",
  },
  {
    id: "keystone",
    name: "Keystone",
    lat: 48.1607,
    lng: -122.6743,
    bounds: box(48.1607, -122.6743, 0.01, 0.012),
    kind: "terminal",
    aliases: ["keystone ferry", "fort casey", "coupeville ferry"],
    region: "puget-sound",
  },
  {
    id: "mukilteo",
    name: "Mukilteo",
    lat: 47.9445,
    lng: -122.3046,
    bounds: box(47.9445, -122.3046, 0.02, 0.025),
    kind: "terminal",
    aliases: ["mukilteo ferry", "mukilteo terminal"],
    region: "puget-sound",
  },
  {
    id: "edmonds",
    name: "Edmonds",
    lat: 47.8107,
    lng: -122.3774,
    bounds: box(47.8107, -122.3774, 0.025, 0.03),
    kind: "terminal",
    aliases: ["edmonds ferry", "edmonds terminal"],
    region: "puget-sound",
  },
  {
    id: "seattle-waterfront",
    name: "Seattle Waterfront",
    lat: 47.608,
    lng: -122.342,
    bounds: box(47.608, -122.342, 0.02, 0.025),
    kind: "city",
    aliases: ["seattle", "seattle pier", "downtown seattle", "elliott bay"],
    region: "puget-sound",
  },
  {
    id: "lake-union",
    name: "Lake Union",
    lat: 47.6276,
    lng: -122.3393,
    bounds: box(47.6276, -122.3393, 0.02, 0.02),
    kind: "terminal",
    aliases: ["kenmore air", "kenmore air lake union", "lake union seaplane", "seaplane terminal"],
    region: "puget-sound",
  },
  {
    id: "seatac",
    name: "Seattle-Tacoma International Airport",
    lat: 47.4502,
    lng: -122.3088,
    bounds: box(47.4502, -122.3088, 0.025, 0.03),
    kind: "airport",
    aliases: ["seatac", "sea-tac", "sea tac", "sea", "seatac airport", "airport"],
    region: "puget-sound",
  },
];

// --- query normalization and matching ---------------------------------------

function normalize(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[._,'`]/g, "")
    .replace(/\s+/g, " ");
}

// Levenshtein edit distance, used for typo tolerance. Iterative two-row form so
// the gazetteer stays dependency-free.
function editDistance(a: string, a2: string): number {
  if (a === a2) return 0;
  if (a.length === 0) return a2.length;
  if (a2.length === 0) return a.length;
  let prev = new Array<number>(a2.length + 1);
  let curr = new Array<number>(a2.length + 1);
  for (let j = 0; j <= a2.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= a2.length; j++) {
      const cost = a[i - 1] === a2[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[a2.length];
}

interface IndexEntry {
  key: string; // normalized alias or canonical name
  place: Place;
}

// Precomputed normalized search index over canonical names + aliases. Built once
// at module load from in-memory data only (no I/O, no network).
const INDEX: IndexEntry[] = (() => {
  const entries: IndexEntry[] = [];
  for (const place of GAZETTEER) {
    const keys = new Set<string>([place.name, place.id.replace(/-/g, " "), ...(place.aliases ?? [])]);
    for (const k of keys) entries.push({ key: normalize(k), place });
  }
  return entries;
})();

export interface ResolveResult {
  place: Place;
  // How the match was made; useful for telemetry and UI confidence.
  match: "exact" | "prefix" | "substring" | "fuzzy";
  score: number; // 1 = exact; lower for looser matches
}

// Resolve a free-text query to a curated place. Case-insensitive, trims and
// collapses whitespace, tolerates partials and small typos. Returns null when no
// curated place is a confident match. Pure and synchronous: never hits the
// network. Use resolvePlaceAsync for the optional Photon fallback.
export function resolvePlaceDetailed(query: string): ResolveResult | null {
  const q = normalize(query ?? "");
  if (!q) return null;

  // 1) exact normalized match on a name or alias.
  for (const e of INDEX) {
    if (e.key === q) return { place: e.place, match: "exact", score: 1 };
  }

  // 2) prefix match (query is the start of a key, or a key starts the query).
  let best: ResolveResult | null = null;
  for (const e of INDEX) {
    if (e.key.startsWith(q) || q.startsWith(e.key)) {
      const score = 0.9 - Math.abs(e.key.length - q.length) / 100;
      if (!best || score > best.score) best = { place: e.place, match: "prefix", score };
    }
  }
  if (best) return best;

  // 3) substring match either direction (handles "harbor" -> "Friday Harbor"
  // only when reasonably specific, so require the query be >= 3 chars).
  if (q.length >= 3) {
    for (const e of INDEX) {
      if (e.key.includes(q) || q.includes(e.key)) {
        const score = 0.75 - Math.abs(e.key.length - q.length) / 100;
        if (!best || score > best.score) best = { place: e.place, match: "substring", score };
      }
    }
    if (best) return best;
  }

  // 4) fuzzy: smallest edit distance under a length-scaled threshold.
  let fuzzyBest: { entry: IndexEntry; dist: number } | null = null;
  for (const e of INDEX) {
    const dist = editDistance(q, e.key);
    if (!fuzzyBest || dist < fuzzyBest.dist) fuzzyBest = { entry: e, dist };
  }
  if (fuzzyBest) {
    const threshold = Math.max(1, Math.floor(fuzzyBest.entry.key.length * 0.34));
    if (fuzzyBest.dist <= threshold) {
      return {
        place: fuzzyBest.entry.place,
        match: "fuzzy",
        score: Math.max(0, 0.6 - fuzzyBest.dist / 10),
      };
    }
  }

  return null;
}

// Convenience wrapper returning just the place (or null). This is the primary
// entry point for callers that do not need match metadata.
export function resolvePlace(query: string): Place | null {
  return resolvePlaceDetailed(query)?.place ?? null;
}

// --- optional Photon typeahead fallback (gated, offline by default) ----------

// Read the Photon base URL from the environment at CALL time only. Returns ""
// when unset or when no process env is available (e.g. a browser bundle without
// the var injected). Import-time code never reads this.
function photonUrl(): string {
  if (typeof process === "undefined" || !process.env) return "";
  return process.env.PHOTON_URL?.trim() ?? "";
}

// True when a Photon endpoint is configured. The fallback is OFF unless
// PHOTON_URL is set, keeping the module fully offline by default.
export function photonEnabled(): boolean {
  return photonUrl().length > 0;
}

// Salish Sea location bias / viewbox for Photon queries so typeahead favors the
// region. Mirrors the gazetteer footprint plus the Puget Sound corridor.
const PHOTON_BIAS = { lat: 48.45, lon: -122.9 };

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    extent?: [number, number, number, number]; // [minLon, maxLat, maxLon, minLat]
  };
}

function photonKind(osmKey?: string, osmValue?: string): PlaceKind {
  if (osmValue === "island") return "island";
  if (osmValue === "harbour" || osmValue === "harbor") return "harbor";
  if (osmValue === "city" || osmValue === "town") return "city";
  if (osmValue === "village" || osmValue === "hamlet") return "village";
  if (osmValue === "aerodrome" || osmKey === "aeroway") return "airport";
  if (osmValue === "ferry_terminal") return "terminal";
  if (osmValue === "bay" || osmValue === "sound") return "sound";
  return "landmark";
}

function featureToPlace(f: PhotonFeature): Place | null {
  const coords = f.geometry?.coordinates;
  if (!coords) return null;
  const [lng, lat] = coords;
  const p = f.properties ?? {};
  let bounds: PlaceBounds;
  if (p.extent && p.extent.length === 4) {
    const [minLon, maxLat, maxLon, minLat] = p.extent;
    bounds = { min_lat: minLat, max_lat: maxLat, min_lng: minLon, max_lng: maxLon };
  } else {
    bounds = box(lat, lng, 0.01, 0.012);
  }
  const name = p.name ?? "Unknown";
  return {
    id: `photon:${normalize(name).replace(/\s+/g, "-")}`,
    name,
    lat,
    lng,
    bounds,
    kind: photonKind(p.osm_key, p.osm_value),
  };
}

// Query a self-hosted Photon endpoint. Network call happens ONLY here, only when
// invoked, and only with an explicit baseUrl. Returns null on any failure.
export async function queryPhoton(
  baseUrl: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Place | null> {
  const q = query.trim();
  if (!baseUrl || !q) return null;
  const u = new URL("/api", baseUrl.endsWith("/") ? baseUrl.slice(0, -1) + "/" : baseUrl + "/");
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "1");
  u.searchParams.set("lat", String(PHOTON_BIAS.lat));
  u.searchParams.set("lon", String(PHOTON_BIAS.lon));
  try {
    const res = await fetchImpl(u.toString());
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: PhotonFeature[] };
    const feature = json.features?.[0];
    return feature ? featureToPlace(feature) : null;
  } catch {
    return null;
  }
}

// Resolve a query, falling back to Photon ONLY when the curated gazetteer misses
// AND PHOTON_URL is configured. With PHOTON_URL unset this is exactly resolvePlace
// wrapped in a resolved promise: no network, fully offline.
export async function resolvePlaceAsync(query: string): Promise<Place | null> {
  const local = resolvePlace(query);
  if (local) return local;
  const url = photonUrl();
  if (!url) return null;
  return queryPhoton(url, query);
}
