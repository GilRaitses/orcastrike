// Unit assertions for the Salish Sea gazetteer.
//
// No vitest/jest runner is configured in web/ (only Playwright e2e), so this file
// is a self-contained assertion script. Run it offline with:
//
//   cd web && npx tsx lib/geo/gazetteer.test.ts
//
// It exits non-zero on the first failed assertion. PHOTON_URL is intentionally
// left unset so the Photon fallback stays disabled and no network call is made.

import assert from "node:assert/strict";
import {
  GAZETTEER,
  photonEnabled,
  resolvePlace,
  resolvePlaceDetailed,
  type Place,
} from "./gazetteer";

function within(place: Place): boolean {
  const b = place.bounds;
  return (
    b.min_lat < place.lat &&
    place.lat < b.max_lat &&
    b.min_lng < place.lng &&
    place.lng < b.max_lng &&
    b.min_lat < b.max_lat &&
    b.min_lng < b.max_lng
  );
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check("east sound resolves to East Sound village", () => {
  const p = resolvePlace("east sound");
  assert.ok(p, '"east sound" should resolve');
  assert.equal(p!.id, "east-sound");
  assert.equal(p!.kind, "village");
  // Sane bounds: center inside its own box and box around the real Eastsound.
  assert.ok(within(p!), "center must lie inside its bounds");
  assert.ok(p!.bounds.min_lat > 48.6 && p!.bounds.max_lat < 48.75, "lat box near 48.69");
  assert.ok(p!.bounds.min_lng > -123.0 && p!.bounds.max_lng < -122.85, "lng box near -122.90");
});

check("friday harbor resolves to Friday Harbor", () => {
  const p = resolvePlace("friday harbor");
  assert.ok(p, '"friday harbor" should resolve');
  assert.equal(p!.id, "friday-harbor");
  assert.equal(p!.kind, "harbor");
  assert.ok(within(p!), "center must lie inside its bounds");
  assert.ok(p!.bounds.min_lat > 48.5 && p!.bounds.max_lat < 48.56, "lat box near 48.53");
  assert.ok(p!.bounds.min_lng > -123.05 && p!.bounds.max_lng < -122.98, "lng box near -123.02");
});

check("matching is case-insensitive and trims whitespace", () => {
  assert.equal(resolvePlace("  FRIDAY HARBOR  ")!.id, "friday-harbor");
  assert.equal(resolvePlace("Eastsound")!.id, "east-sound");
});

check("partials resolve", () => {
  assert.equal(resolvePlace("orcas")!.id, "orcas-island");
  assert.equal(resolvePlace("anacortes ferry")!.id, "anacortes");
});

check("typo tolerance via fuzzy match", () => {
  assert.equal(resolvePlace("fridey harbor")!.id, "friday-harbor");
  assert.equal(resolvePlace("anacortez")!.id, "anacortes");
});

check("detailed result reports match kind and score", () => {
  const r = resolvePlaceDetailed("friday harbor");
  assert.ok(r);
  assert.equal(r!.match, "exact");
  assert.equal(r!.score, 1);
});

check("unknown query returns null (no throw, no network)", () => {
  assert.equal(resolvePlace("zzz nowhere land"), null);
});

check("every curated place has sane bounds and a known kind", () => {
  const kinds = new Set([
    "sound",
    "harbor",
    "island",
    "village",
    "terminal",
    "airport",
    "landmark",
    "city",
  ]);
  for (const p of GAZETTEER) {
    assert.ok(within(p), `${p.id} center inside bounds`);
    assert.ok(kinds.has(p.kind), `${p.id} has valid kind`);
    assert.ok(p.lng < 0, `${p.id} longitude is west (negative)`);
  }
  assert.ok(GAZETTEER.length >= 38, "gazetteer covers ~40 places");
});

check("Photon fallback is gated off by default (PHOTON_URL unset)", () => {
  assert.equal(photonEnabled(), false, "PHOTON_URL must be unset in tests");
});

console.log(`\n${passed} checks passed`);
