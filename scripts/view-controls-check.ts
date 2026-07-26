/**
 * ONE CONTROL OWNS THE VIEW. (Feed and Explore.)
 *
 * The feed had three rows of view controls — six "adaptive modes", five
 * "content filters", three "layout" buttons — fourteen decisions stacked above
 * a timeline. Two of those rows wrote the SAME state (`contentFilter`) with
 * DIFFERENT vocabularies, and the result was visible:
 *
 *   FeedContentFilter has 8 values. The filter row offered 5 of them and the
 *   mode presets set 3 it had no button for. Reproduced in a browser: pressing
 *   Photo, Video or Text put ALL FIVE chips at aria-pressed="false" — a
 *   radio-style group claiming nothing was selected while a filter was actively
 *   narrowing the feed.
 *
 * Two modes were duplicates outright: `creator` set the same contentFilter and
 * layoutMode as `classic` and only added a stats panel /profile?tab=analytics
 * already renders in full; `clean` was `classic` plus compact cards, which is
 * exactly what the "Compact" layout button beside it did.
 *
 * This holds the shape that makes the bug unrepresentable rather than merely
 * fixed: ONE list, covering EVERY value of the type, and one writer.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const FEED = "src/app/(app)/feed/feed-timeline-client.tsx";
const EXPLORE = "src/app/(app)/explore/explore-discovery.tsx";
const src = read(FEED);
const code = strip(src);
const explore = strip(read(EXPLORE));

// ── 1. Each control list covers its type, exactly ────────────────────────────
//
// The feed narrows on two independent facts: WHO the post came from
// (`FeedSource` — For you / Following / Explore) and WHAT kind of post it is
// (`FeedContentFilter`). Two facts, two rows, is honest. The bug was one fact
// spread across two rows with different vocabularies. So the law is per-fact:
// the list that renders a type must offer every value of it, once.
{
  const feedTypes = read("src/lib/feed-data.ts");
  const pairs = [
    { list: "feedViews", type: "FeedContentFilter", file: FEED, code, types: feedTypes },
    { list: "sourceFilters", type: "FeedSource", file: FEED, code, types: feedTypes },
    // Explore declares its own types locally; the law is the same either way.
    { list: "MEDIA_FILTERS", type: "MediaFilter", file: EXPLORE, code: explore, types: explore },
    { list: "SORT_MODES", type: "SortMode", file: EXPLORE, code: explore, types: explore },
  ];
  for (const { list, type, file, code: body, types } of pairs) {
    const typeLine = new RegExp(`(?:export )?type ${type}\\s*=\\s*([^;]+);`).exec(types);
    // Only the list's own literal — these files declare more than one `id:` list.
    const block = new RegExp(`const ${list}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`).exec(body);
    if (!typeLine) {
      fail("1 coverage", `${type} has moved — the gate can no longer read what the control must cover`);
      continue;
    }
    if (!block) {
      fail("1 coverage", `${list} is no longer a literal array in ${file} — the control list has to stay readable to stay checkable`);
      continue;
    }
    const declared = [...typeLine[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();
    const listed = [...block[1].matchAll(/\bid:\s*"([a-z]+)"/g)].map((m) => m[1]).sort();
    const missing = declared.filter((v) => !listed.includes(v));
    const extra = listed.filter((v) => !declared.includes(v));
    if (missing.length) {
      fail("1 coverage", `${list} cannot reach ${missing.join(", ")} — a filter the UI can set but never shows as selected is exactly the desync this replaced`);
    } else ok();
    if (extra.length) {
      fail("1 coverage", `${list} offers ${extra.join(", ")}, which ${type} does not contain`);
    } else ok();
    // Duplicates would make two buttons claim the same state.
    if (new Set(listed).size !== listed.length) {
      fail("1 coverage", `${list} lists the same value twice`);
    } else ok();
  }
}

// ── 2. One row, not three ────────────────────────────────────────────────────
{
  for (const gone of ["adaptiveModes", "contentFilters", "layoutModes", "AdaptiveFeedMode", "applyAdaptiveMode"]) {
    if (new RegExp(`\\b${gone}\\b`).test(code)) {
      fail("2 one row", `${gone} is back — the feed is presenting more than one row of view controls again`);
    } else ok();
  }
  // The rendered rows: exactly one .map over the view list.
  const rowMaps = [...code.matchAll(/(\w+)\.map\(\((?:view|mode|filter)\b/g)].map((m) => m[1]);
  const viewRows = rowMaps.filter((n) => n === "feedViews").length;
  if (viewRows !== 1) {
    fail("2 one row", `feedViews is rendered ${viewRows} times; the point is that exactly one control writes the view`);
  } else ok();
}

// ── 3. Only one writer of the state ──────────────────────────────────────────
{
  const writers = [...code.matchAll(/applyContentFilter\(/g)].length;
  // One definition + one call site in the row. More call sites means more than
  // one control can set the view, which is how the vocabularies drifted apart.
  if (writers > 3) {
    fail("3 one writer", `applyContentFilter is referenced ${writers} times; more than one control is setting the view`);
  } else ok();
  if (/setAdaptiveMode\(/.test(code)) {
    fail("3 one writer", "setAdaptiveMode is back — a second piece of state describing the same view");
  } else ok();
}

// ── 4. The duplicated surfaces stay gone ─────────────────────────────────────
{
  if (/feed-creator-dashboard/.test(code)) {
    fail("4 duplicates", "the Creator dashboard is back in the feed; /profile?tab=analytics already renders it in full");
  } else ok();
  // "Clean" was Compact wearing a different label, and its copy promised
  // "fewer controls" while removing none.
  if (/label:\s*"Clean"/.test(code) || /label:\s*"Classic"/.test(code)) {
    fail("4 duplicates", "a Clean/Classic preset is back — both were duplicates of a control sitting beside them");
  } else ok();
}

// ── 5. Explore: the impostor row stays gone ──────────────────────────────────
//
// `FeedMode` was a third vocabulary spanning the other two. "Trending" was the
// sort already being Top — provably a no-op on load — and "Media" was a content
// type. Neither may come back as its own piece of state.
{
  for (const gone of ["FeedMode", "FEED_MODES", "feedMode", "setFeedMode"]) {
    if (new RegExp(`\\b${gone}\\b`).test(explore)) {
      fail("5 explore", `${gone} is back — the row whose values belonged to the content filter and the sort`);
    } else ok();
  }
  // The specific no-op: a sort that fires on a mode as well as on the sort.
  if (/sortMode\s*===\s*"top"\s*\|\||\|\|\s*sortMode\s*===\s*"top"/.test(explore)) {
    fail("5 explore", 'the sort is once again reachable through a second condition — that is what made "For you" and "Trending" identical');
  } else ok();
}

// ── 6. Explore: content type is one control, so it cannot contradict itself ──
{
  // Media (has attachments) and Text (has none) were settings of two different
  // controls, so they could be asked for together and always returned nothing.
  // The old code papered over it by withdrawing the Text button.
  const filterIds = [...(/const MEDIA_FILTERS\b[^=]*=\s*\[([\s\S]*?)\n\];/.exec(explore)?.[1] ?? "").matchAll(/\bid:\s*"([a-z]+)"/g)].map((m) => m[1]);
  for (const required of ["media", "text"]) {
    if (!filterIds.includes(required)) {
      fail("6 explore", `MEDIA_FILTERS no longer offers "${required}" — both must be values of the SAME control or they can be set at once again`);
    } else ok();
  }
  if (/filter\.id\s*!==\s*"text"/.test(explore)) {
    fail("6 explore", "a control is withdrawing another control's option again; mutually exclusive values belong to one control, not two");
  } else ok();
  // One writer for the content type, one for the order.
  const writers = [...explore.matchAll(/setMediaFilter\(/g)].length;
  if (writers > 2) {
    fail("6 explore", `setMediaFilter is called ${writers} times; the content type should have exactly one control writing it`);
  } else ok();
}

if (failures.length) {
  console.error(`\nview-controls: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`view-controls: ${checks} assertions passed — one control per fact, every value one click away.`);
