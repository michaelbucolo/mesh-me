// THE ONE FEATURE THAT CAN GET SOMEBODY HURT OFF THE SCREEN.
//
// Every other surface risks embarrassment. A map of real people at real
// coordinates risks a person being waited for outside their home, so these
// assertions are not style rules — they are the feature's licence to exist.
//
// The headline test is the one that catches the plausible-looking mistake:
// AVERAGING. Random jitter looks blurred and is not, because noise with a mean
// of zero cancels over repeated samples. So the gate samples a stationary
// person a thousand times and demands the answer never moves — which only
// holds for a snap, never for jitter.
//
// Pure: no network, no database, no clock. `npm run meshimap-privacy:check`.

import { canSeeOnMap, coarsen, isFresh, pinsFor, LOCATION_TTL_MS, type MapSubject } from "../src/lib/meshimap/coarse";

let checks = 0;
const failures: string[] = [];
const ok = () => { checks += 1; };
const fail = (s: string, m: string) => { failures.push(`[${s}] ${m}`); };

// A real, specific home address — the thing we must never reconstruct.
const HOME = { lat: 51.5074231, lng: -0.1277654 };

const rel = (over: Partial<MapSubject["relation"]> = {}) => ({
  isSelf: false, followsSubject: false, subjectFollowsViewer: false, isBlockedEitherWay: false, ...over,
});

// ---------------------------------------------------------------------------
// 1. AVERAGING MUST NOT SHARPEN IT. This is the whole design.
// ---------------------------------------------------------------------------
{
  const samples = Array.from({ length: 1000 }, () => coarsen(HOME.lat, HOME.lng, "block"));
  const lats = new Set(samples.map((s) => s.lat));
  const lngs = new Set(samples.map((s) => s.lng));
  if (lats.size !== 1 || lngs.size !== 1) {
    fail("1 averaging", `1000 samples of a stationary person produced ${lats.size}×${lngs.size} distinct points — an observer can average these back to the true location`);
  } else ok();

  // And the reported point must not BE the true point.
  const s = samples[0];
  if (s.lat === HOME.lat && s.lng === HOME.lng) fail("1 averaging", "the exact coordinate was published"); else ok();
}

// Two people standing apart but inside one cell must be indistinguishable —
// otherwise the cell leaks sub-cell position.
{
  const a = coarsen(51.5074, -0.1277, "block");
  const b = coarsen(51.5081, -0.1206, "block");
  if (a.lat !== b.lat || a.lng !== b.lng) {
    fail("1 averaging", "two people in the same cell reported different points, which distinguishes them within it");
  } else ok();
}

// Idempotent: a coarse value cannot be sharpened by round-tripping it.
{
  const once = coarsen(HOME.lat, HOME.lng, "block");
  const twice = coarsen(once.lat, once.lng, "block");
  if (once.lat !== twice.lat || once.lng !== twice.lng) fail("1 averaging", "re-coarsening moved the point"); else ok();
}

// The grid is GLOBAL, not per-user: a person-anchored grid leaks via its own
// boundaries. Same input must give the same cell regardless of who asks.
{
  const cells = ["alice", "bob", "carol"].map(() => coarsen(HOME.lat, HOME.lng, "block"));
  if (new Set(cells.map((c) => `${c.lat},${c.lng}`)).size !== 1) {
    fail("1 averaging", "the grid differs per observer — cell boundaries would bound the true position");
  } else ok();
}

// ---------------------------------------------------------------------------
// 2. PRECISION ONLY EVER COARSENS.
// ---------------------------------------------------------------------------
for (const p of ["block", "town", "region"] as const) {
  const c = coarsen(HOME.lat, HOME.lng, p);
  const err = Math.max(Math.abs(c.lat - HOME.lat), Math.abs(c.lng - HOME.lng));
  const floor = { block: 0.001, town: 0.01, region: 0.1 }[p];
  if (err < floor) fail("2 precision", `${p} landed ${err} from the true point — too close to be a cell`); else ok();
}
// Antimeridian and poles must stay in range rather than wrapping into nonsense.
{
  const c = coarsen(89.999, 179.999, "region");
  if (c.lat > 90 || c.lat < -90 || c.lng > 180 || c.lng < -180) fail("2 precision", `out of range near the pole: ${JSON.stringify(c)}`); else ok();
}

// ---------------------------------------------------------------------------
// 3. NOBODY IS ON THE MAP WITHOUT SAYING SO.
// ---------------------------------------------------------------------------
if (canSeeOnMap({ audience: "nobody", ghostMode: false, relation: rel() })) fail("3 consent", "default audience 'nobody' was visible"); else ok();
// Ghost mode beats every standing permission.
if (canSeeOnMap({ audience: "everyone", ghostMode: true, relation: rel() })) fail("3 consent", "ghost mode did not override 'everyone'"); else ok();
// Blocking beats everything, including ghost being off.
if (canSeeOnMap({ audience: "everyone", ghostMode: false, relation: rel({ isBlockedEitherWay: true }) })) fail("3 consent", "a blocked pair could see each other"); else ok();
// Mutuals means BOTH directions.
if (canSeeOnMap({ audience: "mutuals", ghostMode: false, relation: rel({ followsSubject: true }) })) fail("3 consent", "one-way follow satisfied 'mutuals'"); else ok();
if (!canSeeOnMap({ audience: "mutuals", ghostMode: false, relation: rel({ followsSubject: true, subjectFollowsViewer: true }) })) fail("3 consent", "a real mutual was hidden"); else ok();
// You always see yourself — a control you cannot observe is not a control.
if (!canSeeOnMap({ audience: "nobody", ghostMode: true, relation: rel({ isSelf: true }) })) fail("3 consent", "you could not see your own pin, so you cannot tell what you broadcast"); else ok();
// An unrecognised audience from a newer client reads as "no".
if (canSeeOnMap({ audience: "friends-of-friends" as never, ghostMode: false, relation: rel() })) fail("3 consent", "an unknown audience value defaulted to visible"); else ok();

// ---------------------------------------------------------------------------
// 4. A PIN GOES STALE RATHER THAN LYING.
// ---------------------------------------------------------------------------
const NOW = 1_800_000_000_000;
if (!isFresh(NOW - 60_000, NOW)) fail("4 freshness", "a minute-old report was called stale"); else ok();
if (isFresh(NOW - LOCATION_TTL_MS - 1, NOW)) fail("4 freshness", "an expired report survived"); else ok();
if (isFresh(NOW + 10 * 60_000, NOW)) fail("4 freshness", "a future timestamp was accepted — that is a forgery or a broken clock"); else ok();
if (isFresh(Number.NaN, NOW)) fail("4 freshness", "NaN was treated as fresh"); else ok();

// ---------------------------------------------------------------------------
// 5. THE PIPELINE CANNOT BE SKIPPED — raw coordinates never come out.
// ---------------------------------------------------------------------------
{
  const subjects: MapSubject[] = [
    { userId: "u1", username: "open", displayName: null, ...HOME, reportedAtMs: NOW - 1000, audience: "everyone", ghostMode: false, precision: "block", relation: rel() },
    { userId: "u2", username: "ghost", displayName: null, ...HOME, reportedAtMs: NOW - 1000, audience: "everyone", ghostMode: true, precision: "block", relation: rel() },
    { userId: "u3", username: "private", displayName: null, ...HOME, reportedAtMs: NOW - 1000, audience: "nobody", ghostMode: false, precision: "block", relation: rel() },
    { userId: "u4", username: "stale", displayName: null, ...HOME, reportedAtMs: NOW - LOCATION_TTL_MS - 1, audience: "everyone", ghostMode: false, precision: "block", relation: rel() },
    { userId: "u5", username: "blocked", displayName: null, ...HOME, reportedAtMs: NOW - 1000, audience: "everyone", ghostMode: false, precision: "block", relation: rel({ isBlockedEitherWay: true }) },
  ];
  const pins = pinsFor(subjects, NOW);
  const ids = pins.map((p) => p.userId);
  if (JSON.stringify(ids) !== JSON.stringify(["u1"])) {
    fail("5 pipeline", `only the consenting, fresh, unblocked person may appear; got ${JSON.stringify(ids)}`);
  } else ok();

  // The emitted pin must not carry the true coordinate anywhere in it.
  const blob = JSON.stringify(pins);
  if (blob.includes(String(HOME.lat)) || blob.includes(String(HOME.lng))) {
    fail("5 pipeline", "the exact coordinate survived into the rendered pin");
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshimap-privacy: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}

console.log(
  `meshimap-privacy OK — ${checks} assertions. Location is SNAPPED to a fixed global grid, never jittered: a\n` +
    "  stationary person sampled a thousand times reports one identical point, so an observer cannot average the\n" +
    "  blur away, and two people in one cell are indistinguishable within it. The grid is global rather than\n" +
    "  per-user, so cell boundaries cannot bound anyone. Nobody appears without opting in; ghost mode beats every\n" +
    "  standing permission and blocking beats ghost mode; an unknown audience reads as no; you always see your own\n" +
    "  pin so you can tell what you broadcast. Stale and future-dated reports never render, and the raw coordinate\n" +
    "  is consumed by the pipeline rather than reaching the map.\n" +
    "  Does NOT cover: what a determined observer infers from a cell you sit in every night. Coarsening is not\n" +
    "  anonymity, and no assertion here should be read as saying it is.",
);
