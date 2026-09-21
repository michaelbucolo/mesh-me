import assert from "node:assert/strict";
import { mediaFrameRatio } from "../src/lib/media-layout";

const cases = [
  ["landscape", { width: 1920, height: 1080 }, 16 / 9],
  ["portrait", { width: 1080, height: 1350 }, 4 / 5],
  ["square", { width: 1200, height: 1200 }, 1],
  ["camera photo", { width: 4000, height: 3000 }, 4 / 3],
  ["tall screenshot", { width: 400, height: 2400 }, 4 / 5],
  ["panorama", { width: 6000, height: 1000 }, 16 / 9],
  ["unknown", {}, 4 / 5],
  ["incomplete", { width: 1920 }, 4 / 5],
  ["corrupt", { width: 1920, height: 0 }, 4 / 5],
  ["nonfinite", { width: Infinity, height: 100 }, 4 / 5],
] as const;
for (const [name, dimensions, expected] of cases) {
  assert.equal(mediaFrameRatio(dimensions), expected, `${name} reserves its expected bounded frame`);
}
assert.equal(mediaFrameRatio({}, 4 / 3), 4 / 3, "message attachment fallback remains stable without dimensions");
assert.equal(mediaFrameRatio({}, 16 / 9), 16 / 9, "video fallback reserves its player before metadata");
assert.equal(mediaFrameRatio({ width: 1080, height: 1920 }, 1, 1, 1), 1, "gallery thumbnail keeps a square frame for a portrait");
assert.equal(mediaFrameRatio({ width: 1920, height: 1080 }, 1, 1, 1), 1, "gallery thumbnail keeps the same square frame for landscape");
assert.equal(mediaFrameRatio({}, NaN, NaN, NaN), 4 / 5, "invalid frame settings never emit invalid CSS");
console.log("media-layout: 15 shape, fallback, and invalid-metadata checks passed");
