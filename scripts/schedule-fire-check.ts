/**
 * THE SCHEDULER'S FIRE PATH — exactly-once, honestly late, never doubled.
 *
 * The failure shapes this gate exists to catch:
 *
 *   - THE DOUBLE POST: two ticks (or a tick racing Send now) both firing one
 *     row; or a retry handing a leg that already POSTED its live deliverer.
 *     The claim's status predicate and buildRetryDeliverers' replay are the
 *     two lines that prevent it — both truth-tabled here.
 *   - THE STALE "GOOD MORNING": a post fired hours past its time is mesh.me
 *     putting words in someone's mouth. Past the grace it goes MISSED —
 *     announced, cron-terminal, re-armed only by its owner.
 *   - THE AUTO-REFIRED INTERRUPT: an unconfirmed leg may have landed; a
 *     crashed invocation settles with posted legs preserved and the rest
 *     failed — never re-fired by the machine.
 *   - THE CHURN LEVER: caps reachable from the fire path would let a lapse
 *     strand a queue. Depth is adjudicated at schedule time, full stop.
 *   - THE CHATTY SCHEDULER: success notifies nothing; bad news notifies at
 *     most once per promise.
 *
 * WHAT THIS CANNOT PROVE: real DB race interleavings (the guarded updateMany
 * is source-asserted, its semantics exercised in the slice's DB drive);
 * Vercel's actual tick cadence.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveScheduleCaps } from "../src/lib/mesh-pro";
import { publishToTargets, type Deliverer, type PublishReport } from "../src/lib/compose/publish";
import {
  buildRetryDeliverers,
  decideFire,
  leaseExpired,
  missedReport,
  parseStoredReport,
  parseStoredTargets,
  settleInterrupted,
  settleReport,
} from "../src/lib/compose/schedule";
import { SCHEDULE_LAW } from "../src/lib/compose/schedule-law";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const fire = strip(read("src/lib/compose/schedule-fire.ts"));
const route = strip(read("src/app/api/compose/scheduler/route.ts"));
const deliverers = strip(read("src/lib/compose/deliverers.ts"));
const pure = strip(read("src/lib/compose/schedule.ts"));
const actions = strip(read("src/lib/compose/schedule-actions.ts"));
const meshPro = strip(read("src/lib/mesh-pro.ts"));

function body(source: string, marker: string) {
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const next = source.indexOf("export ", start + marker.length);
  return next > start ? source.slice(start, next) : source.slice(start);
}

// ── 1. Claim exclusivity: one guarded updateMany is the whole lock ───────────
{
  const claim = body(fire, "export async function claimScheduledPost");
  if (!/updateMany\(\{\s*where: \{ id, status: \{ in: \[\.\.\.from\] \} \}/.test(claim)) {
    fail("1 claim", "the claim lost its status predicate — two ticks (or a cancel race) would both fire the row");
  } else ok();
  if (!/status: "firing", claimedAt: now, attempts: \{ increment: 1 \}/.test(claim)) {
    fail("1 claim", "the claim no longer flips to firing with a lease clock and an attempt count");
  } else ok();
  if (!/return claimed\.count === 1;/.test(claim)) {
    fail("1 claim", "count===1 is no longer the lock");
  } else ok();
  // Both entries go through the SAME claim: the cron and the owner's verbs.
  if (!/claimScheduledPost\(row\.id, \[row\.status\], now\)/.test(route)) {
    fail("1 claim", "the cron tick no longer claims through claimScheduledPost");
  } else ok();
  for (const verb of ["sendScheduledNow", "retryFailedLegs"]) {
    if (!/claimScheduledPost\(/.test(body(actions, `export async function ${verb}`))) {
      fail("1 claim", `${verb} bypasses the shared claim — a racing tick could double it`);
    } else ok();
  }
}

// ── 2. Grace boundary, both sides — and missed is cron-terminal ──────────────
{
  const now = new Date("2026-08-13T12:00:00Z");
  const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60 * 1000);
  if (decideFire(now, at(59), SCHEDULE_LAW) !== "fire") {
    fail("2 grace", "59 minutes late no longer fires");
  } else ok();
  if (decideFire(now, at(61), SCHEDULE_LAW) !== "missed") {
    fail("2 grace", "61 minutes late still fires — mesh.me would put words in a sleeping owner's mouth");
  } else ok();
  if (decideFire(now, new Date(now.getTime() + 60_000), SCHEDULE_LAW) !== "wait") {
    fail("2 grace", "a future row is claimable");
  } else ok();
  // The route's due query must exclude past-grace rows and the missed sweep
  // must be guarded; "missed" must never appear in the claimable set.
  if (!/status: "queued", scheduledFor: \{ lte: now, gt: graceCutoff \}/.test(route)) {
    fail("2 grace", "the due query no longer fences the grace window");
  } else ok();
  if (!/where: \{ id: row\.id, status: "queued", scheduledFor: \{ lte: graceCutoff \} \}/.test(route)) {
    fail("2 grace", "the missed sweep lost its guard");
  } else ok();
  const dueBlock = route.slice(route.indexOf("const due ="), route.indexOf("for (const row of due)"));
  if (/"missed"/.test(dueBlock)) {
    fail("2 grace", "missed rows are claimable by the cron — missed is terminal until the OWNER re-arms");
  } else ok();
  const report = missedReport(["mesh", "bluesky"]);
  if (report.posted.length !== 0 || report.skipped.length !== 2 || report.complete) {
    fail("2 grace", "missedReport claims something went out");
  } else ok();
  // Suspension: rows untouched — every sweep and the due query join on it.
  if ((route.match(/user: \{ isSuspended: false \}/g) ?? []).length !== 3) {
    fail("2 grace", "a sweep or the due query stopped excluding suspended owners — their rows must be left untouched");
  } else ok();
}

// ── 3. The no-double-post theorem, through the REAL fan-out ──────────────────
{
  const stored: PublishReport = {
    outcomes: [
      { platform: "mesh", state: "posted", url: "/feed/abc" },
      { platform: "bluesky", state: "failed", retryable: true, message: "The server asked us to try later (503)." },
      { platform: "threads", state: "failed", retryable: false, message: "Post is past the protocol's byte limit." },
    ],
    posted: ["mesh"], skipped: [], failed: ["bluesky", "threads"],
    complete: false, summary: "Posted to 1 · 2 failed.",
  };
  let meshSpy = 0;
  let blueskySpy = 0;
  const live: Record<string, Deliverer> = {
    mesh: async () => { meshSpy += 1; return { ok: true, url: "/feed/DUPLICATE" }; },
    bluesky: async () => { blueskySpy += 1; return { ok: true, url: "https://bsky.app/x" }; },
  };
  const retry = buildRetryDeliverers(stored, live);
  publishToTargets({ text: "hello world", media: [] }, ["mesh", "bluesky", "threads"], retry).then((second) => {
    const meshLeg = second.outcomes.find((o) => o.platform === "mesh");
    if (meshSpy !== 0) {
      fail("3 no-double", "a POSTED leg's live deliverer ran on retry — the duplicate-post hole");
    } else ok();
    if (!meshLeg || meshLeg.state !== "posted" || meshLeg.url !== "/feed/abc") {
      fail("3 no-double", "the posted leg no longer replays its recorded URL");
    } else ok();
    if (blueskySpy !== 1) {
      fail("3 no-double", "the retryable leg did not re-attempt exactly once");
    } else ok();
    const permanentLeg = second.outcomes.find((o) => o.platform === "threads");
    if (!permanentLeg || permanentLeg.state !== "failed" || (permanentLeg.state === "failed" && permanentLeg.retryable)) {
      fail("3 no-double", "the permanent failure was retried or rewritten — retrying a malformed post forever is how you get rate-limited off a platform");
    } else ok();
    if (second.posted.length !== 2 || second.complete) {
      fail("3 no-double", "the retry's buckets lie (the permanent leg still failed, so the set is incomplete)");
    } else ok();

    afterAsync();
  });
}

function afterAsync() {
  // ── 4. Attempts cap + settle ───────────────────────────────────────────────
  {
    const now = new Date("2026-08-13T12:00:00Z");
    const failing: PublishReport = {
      outcomes: [{ platform: "bluesky", state: "failed", retryable: true, message: "503" }],
      posted: [], skipped: [], failed: ["bluesky"], complete: false, summary: "Could not post — 1 failed.",
    };
    const first = settleReport(failing, 1, now, SCHEDULE_LAW);
    if (first.status !== "retrying" || first.nextAttemptAt.getTime() !== now.getTime() + 5 * 60 * 1000) {
      fail("4 attempts", "attempt 1's retryable failure does not retry at +5 min");
    } else ok();
    const second = settleReport(failing, 2, now, SCHEDULE_LAW);
    if (second.status !== "retrying" || second.nextAttemptAt.getTime() !== now.getTime() + 15 * 60 * 1000) {
      fail("4 attempts", "attempt 2's retryable failure does not retry at +15 min");
    } else ok();
    if (settleReport(failing, SCHEDULE_LAW.maxAttempts, now, SCHEDULE_LAW).status !== "done") {
      fail("4 attempts", "the attempts cap does not terminate — a permanent 503 would retry forever");
    } else ok();
    const complete: PublishReport = { ...failing, outcomes: [{ platform: "mesh", state: "posted", url: "/x" }], posted: ["mesh"], failed: [], complete: true, summary: "Posted." };
    if (settleReport(complete, 1, now, SCHEDULE_LAW).status !== "done") {
      fail("4 attempts", "a complete report does not settle done");
    } else ok();
  }

  // ── 5. Interrupted is settled, never re-fired ──────────────────────────────
  {
    const stored: PublishReport = {
      outcomes: [
        { platform: "mesh", state: "posted", url: "/feed/kept" },
        { platform: "bluesky", state: "failed", retryable: true, message: "…" },
      ],
      posted: ["mesh"], skipped: [], failed: ["bluesky"], complete: false, summary: "…",
    };
    const settled = settleInterrupted(stored, ["mesh", "bluesky"]);
    const mesh = settled.outcomes.find((o) => o.platform === "mesh");
    const bluesky = settled.outcomes.find((o) => o.platform === "bluesky");
    if (!mesh || mesh.state !== "posted" || mesh.url !== "/feed/kept") {
      fail("5 interrupt", "an interrupted row's POSTED leg was not preserved verbatim");
    } else ok();
    if (!bluesky || bluesky.state !== "failed" || (bluesky.state === "failed" && bluesky.retryable)) {
      fail("5 interrupt", "an unconfirmed leg did not settle as a permanent failure — auto-refiring risks the duplicate");
    } else ok();
    const fresh = settleInterrupted(null, ["mesh"]);
    if (fresh.outcomes[0]?.state !== "failed") {
      fail("5 interrupt", "an interrupted row with no stored report does not fail closed");
    } else ok();
    const now = new Date("2026-08-13T12:00:00Z");
    if (leaseExpired(now, new Date(now.getTime() - SCHEDULE_LAW.firingLeaseMs - 1000), SCHEDULE_LAW) !== true ||
        leaseExpired(now, new Date(now.getTime() - 60_000), SCHEDULE_LAW) !== false) {
      fail("5 interrupt", "the lease boundary is wrong");
    } else ok();
    if (!/status: "done", reportJson: JSON\.stringify\(report\), completedAt: now/.test(route) ||
        !/status: "firing", claimedAt: \{ lt: leaseCutoff \}/.test(route)) {
      fail("5 interrupt", "the interrupt sweep lost its guarded settle — or started re-firing");
    } else ok();
  }

  // ── 6. Notify at most once, only bad news ──────────────────────────────────
  {
    const notify = body(fire, "export async function notifyScheduledOutcome");
    if (!/where: \{ id, notifiedAt: null \}/.test(notify) || !/if \(guard\.count !== 1\) return;/.test(notify)) {
      fail("6 notify", "the notifiedAt guard is gone — two settle passes would notify twice");
    } else ok();
    if (!/if \(decision\.status === "done" && !report\.complete\) \{/.test(fire)) {
      fail("6 notify", "success notifies (or terminal bad news doesn't) — the queue's Sent row is the receipt, the notification is only for bad news");
    } else ok();
    if (!/notifiedAt: null,/.test(body(actions, "export async function rescheduleScheduled"))) {
      fail("6 notify", "restore no longer clears the notify guard — at-most-once is per PROMISE, not per row lifetime");
    } else ok();
  }

  // ── 7. Caps: schedule-time only, one definition, honest copy ───────────────
  {
    if (resolveScheduleCaps(false).slots !== 10 || resolveScheduleCaps(false).horizonDays !== 14 ||
        resolveScheduleCaps(true).slots !== 100 || resolveScheduleCaps(true).horizonDays !== 365) {
      fail("7 caps", "resolveScheduleCaps drifted from 10/14d free, 100/365d Pro");
    } else ok();
    if (!/const SCHEDULE_CAPS = \{\s*free: \{ slots: 10, horizonDays: 14 \},\s*pro: \{ slots: 100, horizonDays: 365 \},\s*\} as const;/.test(meshPro)) {
      fail("7 caps", "SCHEDULE_CAPS left mesh-pro.ts or drifted");
    } else ok();
    // The fire path can never see a cap: a queue filled as Pro fires as free.
    if (/resolveScheduleCaps|SCHEDULE_CAPS|hasMeshPro/.test(fire + deliverers + pure + route)) {
      fail("7 caps", "a fire-path module references caps or entitlements — a lapse could strand a queue");
    } else ok();
    if (!/resolveScheduleCaps\(hasMeshPro\(user\)\)/.test(body(actions, "export async function schedulePost"))) {
      fail("7 caps", "schedulePost no longer resolves caps from the entitlement UNION");
    } else ok();
    if (!/Your queue holds 10 posts on the free plan — a slot opens when the next one sends, or MeshPro holds a hundred\./.test(read("src/lib/compose/schedule-actions.ts"))) {
      fail("7 caps", "the free at-cap sentence drifted — one plain sentence at the moment of refusal, never a banner");
    } else ok();
    if (!/enforcedIn: \{ file: "src\/lib\/mesh-pro\.ts", symbol: "SCHEDULE_CAPS" \}/.test(strip(read("src/app/(app)/meshpro/page.tsx")))) {
      fail("7 caps", "the deeper-queue card no longer points at SCHEDULE_CAPS");
    } else ok();
  }

  // ── 8. Honesty plumbing ────────────────────────────────────────────────────
  {
    // Timestamps are fire-time: the fire path never reads scheduledFor.
    if (/scheduledFor/.test(body(fire, "export async function fireClaimedPost"))) {
      fail("8 honesty", "fireClaimedPost reads scheduledFor — a delivered createdAt must be the moment of the SEND, never backdated");
    } else ok();
    if (!/buildPost\(draft\.text, now\(\)\.toISOString\(\)\)/.test(deliverers)) {
      fail("8 honesty", "the bluesky deliverer no longer stamps fire-time");
    } else ok();
    // One fan-out: nothing re-implements publishToTargets' outcomes.
    if (!/publishToTargets\(draft, targets, deliverers\)/.test(fire)) {
      fail("8 honesty", "the fire path stopped going through the real publishToTargets");
    } else ok();
    // One deliverer resolution, shared with live publishing.
    if (!/resolveDeliverers\(user\)/.test(strip(read("src/lib/compose/publish-action.ts")))) {
      fail("8 honesty", "live publishing no longer resolves deliverers from the shared module — live and scheduled would drift on what 'connected' means");
    } else ok();
    // One line renderer.
    if (!/reportLines\(/.test(strip(read("src/components/compose/queue-view.tsx"))) ||
        !/reportLines\(res\)/.test(strip(read("src/components/compose/composer-view.tsx")))) {
      fail("8 honesty", "a surface stopped using the shared report-lines renderer — the honesty contract forked");
    } else ok();
    // Stored state parses defensively.
    if (parseStoredTargets("not json").length !== 0 || parseStoredReport("not json") !== null) {
      fail("8 honesty", "corrupt stored state does not read as absent");
    } else ok();
    // RateLimitHit is never touched; the prune touches ScheduledPost only.
    if (/rateLimitHit/i.test(fire + route + pure + deliverers + actions)) {
      fail("8 honesty", "a scheduler module touches RateLimitHit");
    } else ok();
    if (!/scheduledPost\.deleteMany\(\{\s*where: \{ status: \{ in: \["done", "missed", "canceled"\] \}/.test(route)) {
      fail("8 honesty", "the prune widened beyond terminal ScheduledPost rows");
    } else ok();
    // Schema parity: both tables in ensure-schema.sql.
    const ensure = read("prisma/ensure-schema.sql");
    if (!/CREATE TABLE IF NOT EXISTS "ScheduledPost"/.test(ensure) || !/CREATE TABLE IF NOT EXISTS "SchedulerRun"/.test(ensure)) {
      fail("8 honesty", "ScheduledPost/SchedulerRun missing from ensure-schema.sql — production never gets the queue");
    } else ok();
    // Cross-post law: visibility decided at schedule time, forced public.
    if (!/visibility: "public",/.test(body(actions, "export async function schedulePost"))) {
      fail("8 honesty", "schedulePost no longer forces public visibility — a Friends post could leak to external platforms at fire time");
    } else ok();
  }

  if (failures.length) {
    console.error(`\nschedule-fire: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
    for (const f of failures) console.error("  " + f);
    process.exit(1);
  }
  console.log(`schedule-fire: all ${checks} assertions passed — one claim, one fan-out, honest lateness, and a queue no lapse can strand.`);
}
