#!/usr/bin/env node
//
// DRIVE MESHIMAP IN A REAL BROWSER.
//
// The gates prove the arithmetic and the privacy rules. They cannot see a
// blank screen, a coastline in the wrong place, or Meshis stacked on top of
// each other — which is the entire category of bug that has cost this rebuild
// the most time. So this signs in, seeds a few coarse locations directly, and
// looks.
//
// Locations are written already-coarsened, exactly as the API would store
// them: this script must not become the one place in the codebase that puts a
// precise point in the database.
//
//   node scripts/meshimap-drive.mjs [--base-url=http://localhost:3000]

import fs from "node:fs";
import crypto from "node:crypto";
import process from "node:process";
import { createRequire } from "node:module";

loadLocalEnvFiles();

const baseUrl = stripTrailingSlash(
  process.argv.find((a) => a.startsWith("--base-url="))?.slice("--base-url=".length) ||
    process.env.MESH_DIAGNOSTICS_BASE_URL ||
    "http://localhost:3000",
);

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { createClient } = await import("@libsql/client");
const db = createClient({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

const failures = [];
const notes = [];
function check(ok, label, evidence) {
  if (ok) notes.push(`  ok   ${label}${evidence ? ` — ${evidence}` : ""}`);
  else failures.push(`  FAIL ${label}${evidence ? ` — ${evidence}` : ""}`);
}

const users = (
  await db.execute("select id, username, displayName from User where onboarded = 1 order by createdAt asc limit 5")
).rows;
if (users.length < 3) {
  console.error("need at least three onboarded users in the local database");
  process.exit(1);
}
const [me, ...others] = users;

// Cell CENTRES on the 0.1° "town" grid — the values coarsen() produces, not
// readings. Two of them deliberately share a cell so the fan-out is exercised.
const SEED = [
  { user: others[0], lat: 51.55, lng: -0.15 },
  { user: others[1], lat: 51.55, lng: -0.15 },
  ...(others[2] ? [{ user: others[2], lat: 40.75, lng: -73.95 }] : []),
];

const now = new Date().toISOString();
await db.execute({ sql: "delete from UserLocation", args: [] });
for (const s of SEED) {
  await db.execute({
    sql: "insert into UserLocation (userId, lat, lng, precision, audience, reportedAt) values (?, ?, ?, 'town', 'everyone', ?)",
    args: [s.user.id, s.lat, s.lng, now],
  });
}
await db.execute({
  sql: "insert into UserLocation (userId, lat, lng, precision, audience, reportedAt) values (?, ?, ?, 'town', 'everyone', ?)",
  args: [me.id, 51.45, -0.05, now],
});

const sessionId = crypto.randomBytes(32).toString("hex");
await db.execute({
  sql: "insert into Session (id, userId, expiresAt) values (?, ?, ?)",
  args: [sessionId, me.id, new Date(Date.now() + 3600e3).toISOString()],
});

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...browserBinary() });
const shots = [];

try {
  for (const vp of [
    { width: 1100, height: 800, name: "desktop" },
    { width: 390, height: 844, name: "phone" },
  ]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addCookies([
      {
        name: "mesh_session",
        value: sessionId,
        domain: new URL(baseUrl).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 1800,
      },
    ]);
    const page = await context.newPage();
    page.on("pageerror", (e) => failures.push(`  FAIL ${vp.name} page error — ${e.message}`));

    const resp = await page.goto(`${baseUrl}/meshimap`, { waitUntil: "domcontentloaded" });
    if (process.env.MESHIMAP_DEBUG) {
      console.log("DEBUG", vp.name, resp && resp.status(), page.url());
      console.log("DEBUG body:", (await page.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, " | "));
    }
    const mounted = await page.waitForSelector('[data-testid="meshi-map"]', { timeout: 25000 }).catch(() => null);
    check(!!mounted, `${vp.name}: the map mounts`, mounted ? "" : "no [data-testid=meshi-map]");
    if (!mounted) {
      await context.close();
      continue;
    }

    // Everyone seeded is fresh and public, so every one of them must be a body
    // on the screen — including the two sharing a cell.
    //
    // WAIT FOR A BODY, not for a duration. Pins are projected against the
    // measured viewport, which is unknown on the server, so they only exist
    // after hydration — and a fixed 600ms sleep is a bet on how fast the dev
    // server hydrates, which is exactly how a passing test starts failing on a
    // slower machine. This wait has a real signal to key on, so it uses it.
    await page.waitForSelector('[data-testid="map-meshi"]', { timeout: 20000 }).catch(() => null);
    const bodies = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="map-meshi"]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { user: el.getAttribute("data-user"), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }),
    );
    check(bodies.length >= SEED.length, `${vp.name}: everyone sharing is drawn`, `${bodies.length} Meshis for ${SEED.length + 1} rows`);

    // THE FAN-OUT, checked where it matters: two people in one cell have the
    // identical stored coordinate, so if they land on the same pixel one of
    // them is invisible and the map is quietly lying about who is there.
    const a = bodies.find((b) => b.user === SEED[0].user.id);
    const b = bodies.find((b2) => b2.user === SEED[1].user.id);
    check(
      !!a && !!b && (Math.abs(a.x - b.x) > 8 || Math.abs(a.y - b.y) > 8),
      `${vp.name}: two people in ONE cell are both visible`,
      a && b ? `(${a.x},${a.y}) vs (${b.x},${b.y})` : "one of them is missing",
    );

    // The land has to actually be on screen — an empty sea with pins floating
    // in it is what a broken coastline transform looks like.
    const landOnScreen = await page.evaluate(() => {
      // The WORLD path by name. `svg path` grabs whichever SVG is first in
      // the DOM — a Meshi's own artwork — and passes while the map is empty.
      const path = document.querySelector('[data-testid="map-land"]');
      if (!path) return false;
      const r = path.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
    });
    check(landOnScreen, `${vp.name}: the coastline is visible on screen`);

    // Tapping a Meshi is the whole feature: it must open a way into their mesh.
    await page.click(`[data-testid="map-meshi"][data-user="${SEED[0].user.id}"]`).catch(() => {});
    const card = await page.waitForSelector('[data-testid="map-pin-card"]', { timeout: 4000 }).catch(() => null);
    check(!!card, `${vp.name}: tapping a Meshi opens their card`);
    const href = await page.getAttribute('[data-testid="map-visit-mesh"]', "href").catch(() => null);
    check(
      !!href && href.startsWith("/mesh?user="),
      `${vp.name}: the card leads into their mesh`,
      href ?? "no link",
    );

    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2);
    check(noOverflow, `${vp.name}: no horizontal overflow`);

    const path = `/tmp/meshimap-${vp.name}.png`;
    await page.screenshot({ path });
    shots.push(path);
    await context.close();
  }
} finally {
  await browser.close();
  await db.execute({ sql: "delete from Session where id = ?", args: [sessionId] });
  await db.execute({ sql: "delete from UserLocation", args: [] });
}

console.log(`\nMeshiMap drive @ ${baseUrl}`);
for (const line of notes) console.log(line);
for (const line of failures) console.log(line);
if (shots.length) console.log(`\nscreenshots: ${shots.join(", ")}`);
console.log(failures.length === 0 ? "\nMeshiMap renders." : `\n${failures.length} failure(s)`);
process.exit(failures.length === 0 ? 0 : 1);

function browserBinary() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE_PATH,
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
  ].filter(Boolean);
  const executablePath = candidates.find((p) => fs.existsSync(p));
  return executablePath ? { executablePath } : {};
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function loadLocalEnvFiles() {
  for (const filename of [".env.local", ".env"]) {
    if (!fs.existsSync(filename)) continue;
    for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  }
}
