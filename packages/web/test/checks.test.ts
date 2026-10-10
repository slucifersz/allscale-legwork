import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPhoto, haversineM } from "../src/checks.js";

test("haversine: Guangzhou Tianhe ≈ 0 m to itself, ~1.1 km across the district", () => {
  assert.equal(Math.round(haversineM(23.1291, 113.3245, 23.1291, 113.3245)), 0);
  const d = haversineM(23.1291, 113.3245, 23.1391, 113.3245);
  assert.ok(d > 1000 && d < 1200);
});

test("a photo without EXIF fails time and gps checks but still reports", async () => {
  const fake = Buffer.alloc(20_000, 1);
  const r = await checkPhoto(fake, { windowStart: new Date("2026-10-11T00:00:00Z"), windowEnd: new Date("2026-10-11T06:00:00Z") });
  assert.equal(r.ok, false);
  assert.equal(r.checks.find((c) => c.name === "file")?.ok, true);
  assert.equal(r.checks.find((c) => c.name === "exif_time_in_window")?.ok, false);
});
