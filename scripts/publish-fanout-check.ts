// A CROSS-POST THAT PARTLY WORKS AND DOES NOT SAY SO IS THE WHOLE PROBLEM.
//
// Five platforms, three take it, two refuse — and if the composer says
// "Posted!" the person has to open all five to find out which. That is not a
// saved trip; it is an added one. So the fan-out reports per target, always,
// and this pins the properties that make the report trustworthy:
//
//   • a blocked target is never attempted (its refusal was already known)
//   • one leg failing never costs the legs that were fine
//   • a deliverer that throws is recorded, not allowed to abort the publish
//   • the summary is exhaustive — "Posted." only when everything posted
//
// Pure: deliverers are injected. `npm run publish-fanout:check`.

import { publishToTargets, type Deliverer } from "../src/lib/compose/publish";

let checks = 0;
const failures: string[] = [];
const ok = () => { checks += 1; };
const fail = (s: string, m: string) => { failures.push(`[${s}] ${m}`); };

const good = (url: string): Deliverer => async () => ({ ok: true, url });
const bad = (retryable: boolean, message = "no"): Deliverer => async () => ({ ok: false, retryable, message });
const boom: Deliverer = async () => { throw new Error("kaboom"); };
const text = { text: "hello world", media: [] as Array<{ kind: "image" | "video" }> };

async function main() {
  // 1. Everything works.
  {
    const r = await publishToTargets(text, ["mesh", "twitter"], { mesh: good("u1"), twitter: good("u2") });
    if (!r.complete || r.posted.length !== 2) fail("1 all", `expected 2 posted, got ${JSON.stringify(r.posted)}`); else ok();
    if (r.summary !== "Posted to all 2.") fail("1 all", `summary was ${JSON.stringify(r.summary)}`); else ok();
  }

  // 2. Partial failure must be reported, never rounded up to success.
  {
    const r = await publishToTargets(text, ["mesh", "twitter"], { mesh: good("u1"), twitter: bad(true, "later") });
    if (r.complete) fail("2 partial", "a publish with a failed leg reported complete"); else ok();
    if (r.posted[0] !== "mesh" || r.failed[0] !== "twitter") fail("2 partial", "legs were not separated"); else ok();
    if (!/failed/.test(r.summary)) fail("2 partial", `summary hid the failure: ${JSON.stringify(r.summary)}`); else ok();
    const t = r.outcomes.find((o) => o.platform === "twitter");
    if (t?.state !== "failed" || t.retryable !== true) fail("2 partial", "retryability was lost"); else ok();
  }

  // 3. A blocked target is never attempted.
  {
    let touched = false;
    const spy: Deliverer = async () => { touched = true; return { ok: true, url: "x" }; };
    // Instagram needs media; this draft has none, so plan blocks it.
    const r = await publishToTargets(text, ["mesh", "instagram"], { mesh: good("u1"), instagram: spy });
    if (touched) fail("3 blocked", "a target the plan already refused was still sent — that spends a rate limit to be told what we knew"); else ok();
    const ig = r.outcomes.find((o) => o.platform === "instagram");
    if (ig?.state !== "skipped") fail("3 blocked", `instagram was ${ig?.state}, not skipped`); else ok();
    if (ig.state === "skipped" && !/photo|video/i.test(ig.reason)) fail("3 blocked", `the reason was not actionable: ${ig.state === "skipped" ? ig.reason : ""}`); else ok();
  }

  // 4. A thrown deliverer is caught, and does not take the others with it.
  {
    const r = await publishToTargets(text, ["mesh", "twitter", "bluesky"], { mesh: good("u1"), twitter: boom, bluesky: good("u3") });
    if (r.posted.length !== 2) fail("4 throw", `a throwing leg cost the others: posted ${JSON.stringify(r.posted)}`); else ok();
    const t = r.outcomes.find((o) => o.platform === "twitter");
    if (t?.state !== "failed") fail("4 throw", "a throw was not recorded as a failure"); else ok();
    // We do not know it did not land, so it must be retryable.
    if (t?.state === "failed" && !t.retryable) fail("4 throw", "an unknown outcome was marked permanent"); else ok();
  }

  // 5. A selected target with no publisher is skipped with the truth.
  {
    const r = await publishToTargets(text, ["mesh", "reddit"], { mesh: good("u1") });
    const rd = r.outcomes.find((o) => o.platform === "reddit");
    // Reddit needs a title, so the plan blocks it first — either way it must
    // not be silently dropped.
    if (!rd) fail("5 missing", "a selected target vanished from the report"); else ok();
    if (rd && rd.state === "posted") fail("5 missing", "a target with no publisher reported as posted"); else ok();
  }

  // 6. Nothing selected says so rather than claiming success.
  {
    const r = await publishToTargets(text, [], {});
    if (r.complete) fail("6 empty", "an empty publish reported complete"); else ok();
    if (r.summary !== "Nothing to post.") fail("6 empty", `summary was ${JSON.stringify(r.summary)}`); else ok();
  }

  // 7. Every selected platform appears exactly once — no target can be lost.
  {
    const sel = ["mesh", "twitter", "bluesky", "instagram"];
    const r = await publishToTargets(text, sel, { mesh: good("a"), twitter: bad(false), bluesky: good("c") });
    const seen = r.outcomes.map((o) => o.platform).sort();
    if (JSON.stringify(seen) !== JSON.stringify([...sel].sort())) {
      fail("7 total", `report covered ${JSON.stringify(seen)} rather than every selected target`);
    } else ok();
    if (r.posted.length + r.skipped.length + r.failed.length !== sel.length) {
      fail("7 total", "the buckets do not add up to the selection");
    } else ok();
  }

  if (failures.length) {
    console.error(`\npublish-fanout: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
    for (const f of failures) console.error("  " + f);
    console.error("");
    process.exit(1);
  }

  console.log(
    `publish-fanout OK — ${checks} assertions. Every selected target appears in the report exactly once and the\n` +
      "  buckets add up to the selection, so a platform cannot be lost. A target the plan already refused is never\n" +
      "  sent. One leg failing — including a deliverer that throws — never costs the legs that were fine, and an\n" +
      "  unknown outcome is retryable rather than declared permanent. \"Posted.\" is only ever said when everything\n" +
      "  posted; a partial result names what failed and what was skipped.\n" +
      "  Does NOT cover: whether a real platform accepted anything. Deliverers are injected here.",
  );
}

main();
