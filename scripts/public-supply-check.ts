/**
 * THE SUPPLY LAYER TOUCHES OTHER PEOPLE'S SERVERS. THIS IS WHAT KEEPS IT HONEST.
 *
 * mesh.me fetches public content from platforms using its own app credentials
 * so that a brand-new account has something to read. That is the product's
 * whole premise, and it is also the part of the codebase most able to embarrass
 * everyone: a lane that scrapes, a lane that hammers an API, a lane that
 * invents content when its key is missing, or a claim on the connect page that
 * a platform is browsable when it is not.
 *
 * Every rule below exists because breaking it is cheap, invisible in review,
 * and expensive afterwards.
 *
 *   NO FABRICATION. The worst failure here is not an empty Flow — it is a full
 *   one that made things up. A lane with no key returns nothing and says
 *   "not_configured". Mock arrays and sample fallbacks are banned outright,
 *   because the day someone adds one "just for local dev" is the day the
 *   product starts lying in production.
 *
 *   NO SCRAPING. Official APIs only. A lane fetching text/html, parsing a DOM,
 *   or pretending to be a browser is a terms violation regardless of intent.
 *
 *   NO USER CREDENTIALS. These lanes run on mesh.me's app keys. A lane reading
 *   ConnectedAccount, accessToken, or anything user-scoped is borrowing a
 *   person's identity to fill a public feed.
 *
 *   BOUNDED EVERYTHING. Every call goes through the timeout-capped helper. This
 *   codebase already has a route hitting the 300s function ceiling; an
 *   unbounded fetch to a third party is how that happens again.
 *
 *   THE PAGE SAYS WHAT THE CODE DOES. Platform verdicts come from the registry,
 *   so the honesty surface cannot drift from the lanes that actually exist.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That a platform's terms actually permit what a lane claims. `endpoint` and
 * `authModel` are declarations checked for presence and shape, not verified
 * against anyone's developer agreement. That judgement is human, and the
 * registry records it next to the lane so it can be re-checked when terms
 * change. What this proves is that no lane can exist WITHOUT that declaration,
 * and that the mechanics around it are safe.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
/** Line comments FIRST — a `//` containing `/*` opens a phantom block otherwise. */
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const DIR = "src/lib/public-supply";
const PROVIDER_DIR = `${DIR}/providers`;

if (!existsSync(join(ROOT, DIR))) {
  console.error(`\npublic-supply: ${DIR} does not exist — this gate is checking nothing.\n`);
  process.exit(1);
}

/** Every provider file. Discovered, never listed: a list goes stale silently. */
const providerFiles = existsSync(join(ROOT, PROVIDER_DIR))
  ? readdirSync(join(ROOT, PROVIDER_DIR)).filter((f) => f.endsWith(".ts")).map((f) => `${PROVIDER_DIR}/${f}`)
  : [];

// ── 1. Providers exist and are visible to this gate ──────────────────────────
{
  if (providerFiles.length === 0) {
    fail("1 discovery", `no provider files found in ${PROVIDER_DIR} — either the supply layer has no lanes, or this gate cannot see them`);
  } else ok();
}

// ── 2. No fabrication ────────────────────────────────────────────────────────
//
// The single most damaging thing a provider could do: return invented content
// so an unconfigured deployment looks alive. Named patterns rather than a broad
// regex, so honest words like "example.com" in a doc comment do not trip it.
{
  const FABRICATION = [
    { re: /\bconst\s+(MOCK|SAMPLE|FAKE|DUMMY|STUB|PLACEHOLDER)_/i, why: "a mock/sample constant" },
    { re: /\bmockItems\b|\bsampleItems\b|\bfakePosts\b|\bstubItems\b/i, why: "a mock item collection" },
    { re: /\bfaker\./i, why: "a fake-data library" },
    { re: /lorem ipsum/i, why: "placeholder copy" },
  ];
  for (const file of providerFiles) {
    const body = strip(read(file));
    let clean = true;
    for (const { re, why } of FABRICATION) {
      if (re.test(body)) {
        clean = false;
        fail("2 no fabrication", `${file} contains ${why}. A lane with no credential must return [] and report "not_configured" — never invent an item. An empty Flow that explains itself beats a full one that lies.`);
      }
    }
    if (clean) ok();
  }
}

// ── 3. No scraping ───────────────────────────────────────────────────────────
{
  const SCRAPING = [
    { re: /text\/html/i, why: "requests HTML" },
    { re: /\bcheerio\b|\bjsdom\b|\bpuppeteer\b|\bplaywright\b/i, why: "uses a DOM/browser library" },
    { re: /DOMParser|querySelector/i, why: "parses markup" },
    { re: /Mozilla\/5\.0/i, why: "spoofs a browser User-Agent" },
  ];
  for (const file of providerFiles) {
    const body = strip(read(file));
    let clean = true;
    for (const { re, why } of SCRAPING) {
      if (re.test(body)) {
        clean = false;
        fail("3 no scraping", `${file} ${why}. This layer is official-API-only; parsing someone's HTML is a terms violation however the data is used.`);
      }
    }
    if (clean) ok();
  }
}

// ── 4. No user credentials, ever ─────────────────────────────────────────────
//
// These lanes run on mesh.me's OWN app keys. A lane that reaches for a user's
// token is using someone's identity to populate a feed they did not ask to
// populate — and it would silently break the promise that you can browse
// without connecting anything.
{
  const USER_SCOPED = [
    { re: /\bconnectedAccount\b/i, why: "reads ConnectedAccount" },
    { re: /\baccessToken\b|\brefreshToken\b/, why: "touches a user OAuth token" },
    { re: /getCurrentUser/, why: "resolves the signed-in user" },
    { re: /\bprisma\b/, why: "queries the database directly (lanes fetch; store.ts persists)" },
  ];
  for (const file of providerFiles) {
    const body = strip(read(file));
    let clean = true;
    for (const { re, why } of USER_SCOPED) {
      if (re.test(body)) {
        clean = false;
        fail("4 app credentials only", `${file} ${why}. Lanes run on mesh.me's app credentials and receive everything they need through LaneContext.`);
      }
    }
    if (clean) ok();
  }
}

// ── 5. Every call is bounded and identified ──────────────────────────────────
{
  for (const file of providerFiles) {
    const body = strip(read(file));
    // `ctx.get` is the timeout-capped, User-Agent-bearing helper. A bare
    // `fetch(` in a lane is an unbounded call to a third party inside a
    // serverless function — the exact shape of the 300s timeouts this codebase
    // already suffers on another route.
    if (/(?<![.\w])fetch\s*\(/.test(body)) {
      fail("5 bounded", `${file} calls fetch() directly. Lanes must use ctx.get, which enforces the timeout and sends MESH_API_USER_AGENT — identifying honestly is a term of service on several of these APIs, not a nicety.`);
    } else ok();

    if (/process\.env/.test(body)) {
      fail("5 bounded", `${file} reads process.env directly. Lanes receive ctx.env so configuration is injectable and a lane stays testable without a live environment.`);
    } else ok();
  }
}

// ── 6. The fetch helper actually bounds ──────────────────────────────────────
{
  const f = strip(read(`${DIR}/fetch.ts`));
  if (!/AbortController/.test(f) || !/signal:/.test(f)) {
    fail("6 the helper", "fetch.ts does not attach an AbortSignal — every lane's timeout guarantee rests on this one file");
  } else ok();
  if (!/MESH_API_USER_AGENT/.test(f)) {
    fail("6 the helper", "fetch.ts no longer sends MESH_API_USER_AGENT, so mesh.me is calling these APIs anonymously");
  } else ok();
  if (!/redactUrl/.test(f)) {
    fail("6 the helper", "fetch.ts no longer redacts URLs; an API key in a query string would reach the error detail stored in PublicSupplyRun");
  } else ok();
}

// ── 7. Retention is enforced, not promised ───────────────────────────────────
{
  const store = strip(read(`${DIR}/store.ts`));
  if (!/expiresAt/.test(store)) {
    fail("7 retention", "store.ts does not set expiresAt — retention limits from platform terms would be unenforced");
  } else ok();
  // Filter AND sweep. Either alone leaves a hole: no filter means expired rows
  // are still served, no sweep means they live in the database forever.
  if (!/expiresAt:\s*\{\s*gt:/.test(store)) {
    fail("7 retention", "reads in store.ts do not filter on expiresAt, so content past its retention limit would still be served");
  } else ok();
  if (!/deleteMany[\s\S]{0,120}expiresAt/.test(store)) {
    fail("7 retention", "store.ts has no sweep deleting rows past expiresAt");
  } else ok();
}

// ── 8. Every lane declares what it is doing ──────────────────────────────────
//
// The declarations are the audit trail. A lane without an endpoint cannot be
// checked against anyone's terms; a lane without an interval is a lane that
// will eventually be rate-limited on someone else's behalf.
//
// Lanes are declared in their PROVIDER file and imported into the registry —
// the first version of this section parsed registry.ts and found zero lanes,
// which is the parser looking in the wrong place rather than the code being
// wrong. It reported that instead of passing, which is the only reason the
// mistake was mine to fix and not the next person's to inherit.
{
  const laneBlocks: string[] = [];
  for (const file of providerFiles) {
    // Each `export const x: PublicSupplyLane = { … }` object.
    for (const block of read(file).split(/:\s*PublicSupplyLane\s*=\s*\{/).slice(1)) {
      laneBlocks.push(block.slice(0, 2000));
    }
  }

  if (laneBlocks.length < 1) {
    fail("8 declarations", `no lanes parsed from ${providerFiles.length} provider file(s) — either none export a PublicSupplyLane, or this gate's parser is broken`);
  } else ok();

  for (const head of laneBlocks) {
    const laneId = /\bid:\s*"([^"]+)"/.exec(head)?.[1] ?? "<unnamed>";
    for (const field of ["endpoint", "authModel", "envKeys", "retentionHours", "minIntervalSeconds"]) {
      if (!new RegExp(`\\b${field}:`).test(head)) {
        fail("8 declarations", `lane "${laneId}" does not declare ${field}. Every lane must state the documented endpoint it calls, how it authenticates, what it needs configured, how long its results may be kept, and how often it may run.`);
      } else ok();
    }
    // These are written as readable arithmetic — `30 * 60`, `24 * 60 * 60` —
    // so a regex capturing the first integer reads "30" and reports a lane
    // that runs every 30 seconds. The first version of this check did exactly
    // that and failed three correct lanes. Evaluate the product instead.
    const numeric = (field: string): number | null => {
      const raw = new RegExp(`${field}:\\s*([\\d\\s*]+?)\\s*,`).exec(head)?.[1];
      if (!raw) return null;
      const parts = raw.split("*").map((p) => Number(p.trim()));
      if (parts.some((n) => !Number.isFinite(n))) return null;
      return parts.reduce((a, b) => a * b, 1);
    };

    const interval = numeric("minIntervalSeconds");
    if (interval !== null && interval < 60) {
      fail("8 declarations", `lane "${laneId}" would run every ${interval}s. Nothing here is worth calling someone else's API more than once a minute.`);
    } else ok();

    const retention = numeric("retentionHours");
    if (retention !== null && retention > 24 * 30) {
      fail("8 declarations", `lane "${laneId}" keeps content for ${retention}h. Retention beyond 30 days needs the platform's terms to actually allow it, not a bigger number here.`);
    } else ok();

    // Per-platform contractual ceilings, from each provider's own developer
    // terms. The global 30-day rule above would happily pass a Twitch lane set
    // to 29 days, which breaches a written 24-hour cap. A researched fact is
    // only durable once it is enforceable, so it lives here rather than in a
    // comment somebody will later "optimise".
    const CONTRACTUAL_MAX_HOURS: Record<string, { hours: number; source: string }> = {
      twitch: { hours: 24, source: "Twitch Developer Services Agreement, Schedule 1 §C — cache for no more than 24 hours absent written authorisation" },
      youtube: { hours: 24 * 30, source: "YouTube API Services Developer Policies — Non-Authorized Data may be stored no longer than 30 calendar days" },
    };
    const platform = laneId.split(":")[0];
    const cap = CONTRACTUAL_MAX_HOURS[platform];
    if (cap && retention !== null && retention > cap.hours) {
      fail(
        "8 declarations",
        `lane "${laneId}" keeps content for ${retention}h, but ${platform} permits ${cap.hours}h.\n` +
        `    ${cap.source}.\n` +
        `    This is a contractual limit, not a tuning knob — raising it needs their written permission, not a bigger number.`,
      );
    } else ok();
  }
}

// ── 9. The refresh endpoint fails closed ─────────────────────────────────────
//
// An unset secret compared against a missing header is "" === "": an open,
// public endpoint that calls third-party APIs on demand. That is a free
// amplifier pointed at other people's infrastructure.
{
  const route = strip(read("src/app/api/public-supply/refresh/route.ts"));
  const fn = /function secretMatches\([\s\S]*?\n\}/.exec(route)?.[0] ?? "";
  if (!fn) {
    fail("9 fail closed", "refresh route has no secretMatches guard");
  } else {
    ok();
    if (!/if\s*\(!expected\)\s*return false/.test(fn)) {
      fail("9 fail closed", "secretMatches does not refuse when PUBLIC_SUPPLY_CRON_SECRET is unset. Absent config must mean no access, never universal access.");
    } else ok();
    if (!/timingSafeEqual/.test(fn)) {
      fail("9 fail closed", "the shared secret is compared without timingSafeEqual");
    } else ok();
  }
}

// ── 10. The page cannot claim more than the code does ────────────────────────
{
  const registry = strip(read(`${DIR}/registry.ts`));
  if (!/PLATFORM_SUPPLY_STATUS/.test(registry)) {
    fail("10 one truth", "registry.ts no longer exports PLATFORM_SUPPLY_STATUS, so the honesty surface has no single source to read from");
  } else ok();

  const statusPage = "src/app/(app)/connected-accounts/public-supply-status.tsx";
  if (!existsSync(join(ROOT, statusPage))) {
    fail("10 one truth", `${statusPage} is missing — nothing tells a user which platforms they can browse without connecting, or why not`);
  } else {
    ok();
    const page = strip(read(statusPage));
    if (!/PLATFORM_SUPPLY_STATUS/.test(page)) {
      fail("10 one truth", `${statusPage} does not read PLATFORM_SUPPLY_STATUS. Hardcoding the verdicts is how the page ends up promising a platform the code cannot deliver.`);
    } else ok();
  }
}

if (failures.length) {
  console.error(`\npublic-supply: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`public-supply: ${checks} assertions passed — ${providerFiles.length} provider(s), official APIs only, bounded, and nothing invented.`);
