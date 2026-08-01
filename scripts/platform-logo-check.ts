// EVERY PLATFORM ON THE CONNECT GRID MUST HAVE A REAL MARK.
//
// The connect page is now the logos. There is no name-and-description card
// behind them any more: a tile is its mark, its name, and one line of state.
// That works exactly as long as every platform in the roster HAS a mark.
//
// `PlatformLogo` falls back to a grey disc with the platform's first letter
// when `TILE` has no entry. The fallback is correct as a fallback — it renders,
// it is legible, it does not crash — and that is the problem. Adding a platform
// to OAUTH_CONFIGS is one object literal, and nothing about doing it tells you
// that a mark is also required. The grid would ship a grey "D" between the
// TikTok and Discord marks and every automated check would pass, because
// nothing measures "is this a logo".
//
// So this measures it: the roster and the mark table are compared directly.
//
// It also checks the two ways a mark can exist and still be wrong — an empty
// interior (a bare coloured square) and a fill that is not a real colour — and
// that `platformLogoDataUri` covers the same set, since the mesh canvas
// rasterizes through it and a canvas node with no mark is the same hole in a
// place nobody looks.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_PLATFORM_IDS } from "../src/lib/oauth";
import { platformLogoDataUri } from "../src/components/platform/platform-logo";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

// ── 1. The mark table covers the roster ─────────────────────────────────────
//
// Read through the module's own public function rather than re-parsing TILE:
// a data URI comes back only when a mark was found, so this cannot pass by
// matching a table that the component no longer reads.
{
  const missing: string[] = [];
  for (const id of ALL_PLATFORM_IDS) {
    if (!platformLogoDataUri(id)) missing.push(id);
  }
  assert.deepEqual(
    missing,
    [],
    `these platforms are offered on the connect grid with no drawn mark:\n` +
      missing.map((id) => `    ${id}`).join("\n") +
      "\n  Each one renders as a grey disc with its first letter, between real logos.\n" +
      "  Add the mark to TILE in src/components/platform/platform-logo.tsx.",
  );
  checks += ALL_PLATFORM_IDS.length;

  assert.ok(
    ALL_PLATFORM_IDS.length >= 10,
    `the roster parsed as ${ALL_PLATFORM_IDS.length} platforms. A check that loops over an\n` +
      "  empty roster passes everything.",
  );
  checks += 1;
}

// ── 2. A mark is a drawing, not a coloured square ────────────────────────────
//
// `inner: ""` would satisfy section 1 — svgFor returns a string, the data URI
// is non-null — and render as a plain brand-coloured tile. Which is what the
// page looked like BEFORE the marks existed, so the check has to be able to
// tell the difference.
{
  const source = readFileSync(join(ROOT, "src/components/platform/platform-logo.tsx"), "utf8");
  const start = source.indexOf("const TILE");
  assert.ok(start >= 0, "the TILE table has moved out of platform-logo.tsx");

  const entries = [...source.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map((m) => m[1]);
  assert.ok(
    entries.length >= 12,
    `parsed only ${entries.length} marks out of platform-logo.tsx; expected the full table.`,
  );
  checks += 1;

  for (const id of ALL_PLATFORM_IDS) {
    const uri = platformLogoDataUri(id);
    if (!uri) continue; // section 1 already failed on this one
    const svg = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ""));
    // Everything after the background rect. A mark with nothing there is a
    // square, and `<rect width="24" height="24"` is always the background.
    const inner = svg.slice(svg.indexOf("/>", svg.indexOf('<rect width="24"')) + 2, svg.lastIndexOf("</svg>"));
    assert.ok(
      /<(path|circle|rect|ellipse|g|polygon)\b/.test(inner),
      `${id}'s mark draws nothing inside its tile — it renders as a plain coloured square.`,
    );
    assert.match(
      svg,
      /fill="#[0-9a-fA-F]{3,8}"/,
      `${id}'s tile has no literal background fill; the mark would render on nothing.`,
    );
    checks += 2;
  }
}

// ── 3. The DOM component and the canvas rasterizer read the same table ───────
//
// They are two renderers for one set of marks. When they drifted before — a
// different map each — the mesh canvas drew platforms the connect page did
// not, and vice versa. One `tileFor` is what stops that; assert it stays one.
{
  const source = readFileSync(join(ROOT, "src/components/platform/platform-logo.tsx"), "utf8");
  const tileForCalls = (source.match(/tileFor\(/g) ?? []).length;
  assert.ok(
    tileForCalls >= 3,
    `tileFor is called ${tileForCalls} time(s) — svgFor (the canvas path) and PlatformLogo (the DOM\n` +
      "  path) must both resolve through it, or the two renderers can disagree about which\n" +
      "  platforms have marks.",
  );
  checks += 1;

  // x is Twitter's id on some surfaces and twitter's on others; both must land
  // on the same mark or one surface silently shows a letter.
  assert.equal(
    platformLogoDataUri("x"),
    platformLogoDataUri("twitter"),
    "`x` and `twitter` resolve to different marks. They are one platform with two ids in this\n" +
      "  codebase, and whichever surface uses the id without an entry renders a letter.",
  );
  checks += 1;
}

console.log(
  `platform-logo OK — ${checks} assertions: all ${ALL_PLATFORM_IDS.length} platforms on the connect grid\n` +
    "  have a real drawn mark (none falls back to a letter disc), every mark draws something\n" +
    "  inside a literal background fill, and the DOM and canvas renderers resolve through one table.",
);
