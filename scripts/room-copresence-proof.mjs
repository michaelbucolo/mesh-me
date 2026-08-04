#!/usr/bin/env node
//
// TWO BROWSERS, ONE ROOM — the only proof that co-presence is real.
//
// Every other check on this stack is arithmetic: the roster reconciles
// sightings correctly, the glide eases correctly, the payload parses
// correctly. All of that passed while the room was still solo, because none of
// it can see whether a SECOND PERSON actually shows up on your screen.
//
// So this drives two real signed-in browser contexts into the same room and
// watches one from the other. It asserts three things, in the order they have
// to be true:
//
//   1. PRESENCE     — each session renders the other's Meshi, by user id.
//   2. TRAVEL       — when one walks, the other's copy MOVES, and passes
//                     through the middle rather than jumping to the end.
//   3. AGREEMENT    — it arrives where the walker actually went, in the
//                     normalised room space both sides share.
//
// Run against a server that is already up:
//   node scripts/room-copresence-proof.mjs [--base-url=http://localhost:3000]
//
// Not part of `npm run check`: it needs a live server, a browser, and a
// seeded database, none of which CI has. It is the thing you run before
// claiming the room works.

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
const headed = process.argv.includes("--headed");

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
  await db.execute("select id, username, displayName from User where onboarded = 1 order by createdAt asc limit 2")
).rows;
if (users.length < 2) {
  console.error("need two onboarded users in the local database");
  process.exit(1);
}
const [host, guest] = users;

// The guest has to be ALLOWED into the host's room, or the proof is measuring
// the privacy gate instead of co-presence. Open the host's mesh for the run and
// put it back exactly as it was afterwards.
const priorPrivacy = (
  await db.execute({ sql: "select meshVisibility from MeshPrivacy where userId = ?", args: [host.id] })
).rows[0];
await setHostVisibility("public");

const hostSession = await openSession(host.id);
const guestSession = await openSession(guest.id);

const browser = await chromium.launch({ headless: !headed, args: ["--no-sandbox"], ...browserBinary() });
const shots = [];

try {
  const hostPage = await signedInPage(hostSession, "host");
  const guestPage = await signedInPage(guestSession, "guest");

  // The host stands in their own mesh; the guest walks into it. Same room id
  // on both sides — that is what makes them able to see each other at all.
  await hostPage.goto(`${baseUrl}/mesh`, { waitUntil: "domcontentloaded" });
  await guestPage.goto(`${baseUrl}/mesh?user=${encodeURIComponent(host.username)}`, {
    waitUntil: "domcontentloaded",
  });

  for (const [page, label] of [
    [hostPage, "host"],
    [guestPage, "guest"],
  ]) {
    const room = await page.waitForSelector('[data-testid="mesh-room"]', { timeout: 20000 }).catch(() => null);
    check(!!room, `${label} is standing in a room`, room ? "mesh-room mounted" : "no [data-testid=mesh-room]");
  }

  // ── 1. PRESENCE ─────────────────────────────────────────────────────────
  //
  // Generous: heartbeat cadence plus the stream handshake plus the roster's
  // grace period. If they cannot find each other in 25s they never will.
  const guestSeesHost = await waitFor(guestPage, `[data-testid="room-meshi"][data-user="${host.id}"]`, 25000);
  const hostSeesGuest = await waitFor(hostPage, `[data-testid="room-meshi"][data-user="${guest.id}"]`, 25000);
  check(guestSeesHost, "the guest can see the host standing in the room", `looked for data-user=${host.id}`);
  check(hostSeesGuest, "the host can see the guest walk in", `looked for data-user=${guest.id}`);

  if (guestSeesHost) {
    // ── 2 & 3. TRAVEL + AGREEMENT ─────────────────────────────────────────
    //
    // The host walks to a far corner. Sample the GUEST's copy of the host the
    // whole way: a teleport and a walk have the same endpoint and completely
    // different sample sets, which is exactly what "travel never teleport"
    // means and exactly what a static screenshot cannot tell apart.
    // The FLOOR, not the room element. Normalised 0..1 spans the part of the
    // room the app's own chrome is not covering, so a click measured against
    // the outer box would land a header's height off, and the agreement
    // assertion below would be measuring the inset rather than the room.
    const box = await hostPage.evaluate(() => {
      const el = document.querySelector('[data-testid="room-floor"]');
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const targetVx = 0.82;
    const targetVy = 0.78;

    const before = await readPos(guestPage, host.id);
    await hostPage.mouse.click(box.left + box.width * targetVx, box.top + box.height * targetVy);

    const samples = [];
    for (let i = 0; i < 40; i++) {
      const p = await readPos(guestPage, host.id);
      if (p) samples.push(p);
      await guestPage.waitForTimeout(150);
    }
    const after = samples[samples.length - 1];

    const moved = before && after && (Math.abs(after.vx - before.vx) > 0.05 || Math.abs(after.vy - before.vy) > 0.05);
    check(
      moved,
      "the host's walk is visible on the guest's screen",
      before && after ? `${fmt(before)} → ${fmt(after)}` : "could not read a position",
    );

    const distinct = new Set(samples.map((s) => `${s.vx.toFixed(3)},${s.vy.toFixed(3)}`)).size;
    check(
      distinct >= 4,
      "they TRAVEL rather than teleport",
      `${distinct} distinct positions across ${samples.length} samples`,
    );

    // Both sides are in normalised room space, so the guest's copy should land
    // where the host actually clicked regardless of either window's size.
    const err = after ? Math.hypot(after.vx - targetVx, after.vy - targetVy) : Number.NaN;
    check(
      Number.isFinite(err) && err < 0.12,
      "the guest sees them arrive where the host actually went",
      `clicked (${targetVx}, ${targetVy}), guest shows ${after ? fmt(after) : "nothing"} — error ${err.toFixed(3)}`,
    );

    for (const [page, label] of [
      [hostPage, "host"],
      [guestPage, "guest"],
    ]) {
      const path = `/tmp/room-copresence-${label}.png`;
      await page.screenshot({ path });
      shots.push(path);
    }
  }
} finally {
  await browser.close();
  await db.execute({ sql: "delete from Session where id = ?", args: [hostSession] });
  await db.execute({ sql: "delete from Session where id = ?", args: [guestSession] });
  await setHostVisibility(priorPrivacy ? String(priorPrivacy.meshVisibility) : null);
}

console.log(`\nroom co-presence: ${host.username} (host) × ${guest.username} (guest) @ ${baseUrl}`);
for (const line of notes) console.log(line);
for (const line of failures) console.log(line);
if (shots.length) console.log(`\nscreenshots: ${shots.join(", ")}`);
console.log(failures.length === 0 ? "\nTWO MESHIS, ONE ROOM — verified." : `\n${failures.length} failure(s)`);
process.exit(failures.length === 0 ? 0 : 1);

// ---------------------------------------------------------------------------

/** Read a remote Meshi's position back out of the DOM in ROOM space, which is
 * what both clients actually agree about — pixels are per-window. */
async function readPos(page, userId) {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="room-meshi"][data-user="${id}"]`);
    if (!el) return null;
    const vx = parseFloat(el.style.left);
    const vy = parseFloat(el.style.top);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return null;
    return { vx: vx / 100, vy: vy / 100 };
  }, userId);
}

async function waitFor(page, selector, timeout) {
  return page
    .waitForSelector(selector, { timeout })
    .then(() => true)
    .catch(() => false);
}

async function signedInPage(sessionId, label) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await context.addCookies([
    {
      name: "mesh_session",
      value: sessionId,
      domain: new URL(baseUrl).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 30 * 60,
    },
  ]);
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`  FAIL ${label} page error — ${e.message}`));
  return page;
}

async function openSession(userId) {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.execute({ sql: "insert into Session (id, userId, expiresAt) values (?, ?, ?)", args: [id, userId, expiresAt] });
  return id;
}

/** null restores "no row at all", which is NOT the same as "public" — the
 * canonical default is private, so leaving a row behind would quietly open a
 * mesh that was shut before the run. */
async function setHostVisibility(visibility) {
  await db.execute({ sql: "delete from MeshPrivacy where userId = ?", args: [host.id] });
  if (visibility) {
    await db.execute({
      sql: "insert into MeshPrivacy (id, userId, meshVisibility, updatedAt) values (?, ?, ?, ?)",
      args: [`copresence-${host.id}`, host.id, visibility, new Date().toISOString()],
    });
  }
}

function fmt(p) {
  return `(${p.vx.toFixed(3)}, ${p.vy.toFixed(3)})`;
}

/** The repo's Playwright and the image's pre-installed Chromium are different
 * builds, so the bundled path lookup misses. Point at the real binary when it
 * is there and let Playwright find its own otherwise. */
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
