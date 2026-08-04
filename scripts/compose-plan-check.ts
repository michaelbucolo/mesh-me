// THE COMPOSER'S PROMISE IS THAT IT KNOWS THE ANSWER BEFORE YOU PRESS POST.
//
// Cross-posting fails in a particular, miserable way: the post half-lands. Three
// platforms take it, two refuse it, and now the person has to open all five apps
// to find out which — which is the exact chore mesh.me exists to remove. A
// composer that lets that happen is worse than no composer, because it has
// added a round of checking rather than removed one.
//
// So the plan is computed up front and this gate pins the refusals that matter:
// Instagram without a photo, TikTok without video, a title-less Reddit post, and
// a body counted against the TIGHTEST selected limit rather than the kindest.
//
// Pure: no network, no database, no DOM. `npm run compose-plan:check`.

import { planPublish, ruleFor, tightestLimit, PLATFORM_RULES } from "../src/lib/compose/plan";

let checks = 0;
const failures: string[] = [];
const ok = () => { checks += 1; };
const fail = (section: string, message: string) => { failures.push(`[${section}] ${message}`); };

const text = (s: string) => ({ text: s, media: [] as Array<{ kind: "image" | "video" }> });
const withImage = (s: string) => ({ text: s, media: [{ kind: "image" as const }] });
const withVideo = (s: string) => ({ text: s, media: [{ kind: "video" as const }] });

function expectBlocked(section: string, draft: Parameters<typeof planPublish>[0], platform: string, kind: string) {
  const plan = planPublish(draft, [platform]);
  const t = plan.targets[0];
  if (t.ok) {
    fail(section, `${platform} accepted a draft it must refuse (expected ${kind})`);
    return;
  }
  if (!t.problems.some((p) => p.kind === kind)) {
    fail(section, `${platform} refused for ${t.problems.map((p) => p.kind).join(",")} rather than ${kind}`);
    return;
  }
  if (plan.ready.includes(platform)) {
    fail(section, `${platform} is blocked but still listed as ready — it would be published to`);
    return;
  }
  ok();
}

function expectOk(section: string, draft: Parameters<typeof planPublish>[0], platform: string) {
  const plan = planPublish(draft, [platform]);
  if (!plan.targets[0].ok) {
    fail(section, `${platform} refused a valid draft: ${plan.targets[0].problems.map((p) => p.message).join(" / ")}`);
    return;
  }
  ok();
}

// ---------------------------------------------------------------------------
// 1. MEDIA REQUIREMENTS — the refusals people hit most.
// ---------------------------------------------------------------------------

expectBlocked("1 media", text("just words"), "instagram", "needs-media");
expectOk("1 media", withImage("with a photo"), "instagram");
expectOk("1 media", withVideo("with a video"), "instagram");

expectBlocked("1 media", text("just words"), "tiktok", "needs-video");
expectBlocked("1 media", withImage("a photo is not a video"), "tiktok", "needs-video");
expectOk("1 media", withVideo("a clip"), "tiktok");

expectBlocked("1 media", withImage("no video here"), "youtube", "needs-video");

// Text-only is fine where text-only is fine.
expectOk("1 media", text("hello"), "twitter");
expectOk("1 media", text("hello"), "mesh");

// ---------------------------------------------------------------------------
// 2. TITLES — a Reddit post without one does not exist.
// ---------------------------------------------------------------------------

expectBlocked("2 titles", text("body only"), "reddit", "needs-title");
{
  const plan = planPublish({ text: "body", media: [], title: "A title" }, ["reddit"]);
  if (!plan.targets[0].ok) fail("2 titles", "a titled Reddit post was refused"); else ok();
}
{
  const plan = planPublish({ text: "b", media: [{ kind: "video" }], title: "x".repeat(101) }, ["youtube"]);
  if (!plan.targets[0].problems.some((p) => p.kind === "title-too-long")) {
    fail("2 titles", "a 101-character YouTube title was accepted");
  } else ok();
}

// ---------------------------------------------------------------------------
// 3. LENGTH — counted against the TIGHTEST selected platform.
// ---------------------------------------------------------------------------
//
// The failure this prevents: selecting X and Threads, writing 400 characters,
// seeing "100 left" because something counted against Threads, and losing the
// one platform you actually cared about.

if (tightestLimit(["twitter", "threads", "mesh"]) !== 280) {
  fail("3 length", `tightest limit across X+Threads+mesh should be 280, got ${tightestLimit(["twitter", "threads", "mesh"])}`);
} else ok();

if (tightestLimit(["mesh"]) !== 5000) {
  fail("3 length", "a lone mesh.me target should report its own limit");
} else ok();

if (tightestLimit([]) !== null) {
  fail("3 length", "no targets should report no limit rather than zero");
} else ok();

// Twitch is unpublishable and must not drag the limit to 0.
if (tightestLimit(["twitch", "mesh"]) !== 5000) {
  fail("3 length", `an unpublishable platform skewed the limit to ${tightestLimit(["twitch", "mesh"])}`);
} else ok();

{
  const long = "x".repeat(281);
  const plan = planPublish({ text: long, media: [] }, ["twitter", "mesh"]);
  const x = plan.targets.find((t) => t.platform === "twitter")!;
  const m = plan.targets.find((t) => t.platform === "mesh")!;
  if (x.ok) fail("3 length", "281 characters was accepted for X");
  else ok();
  if (!m.ok) fail("3 length", "281 characters was refused for mesh.me, which allows 5000");
  else ok();
  // The whole point of a per-target plan: one refusal must not block the rest.
  if (!plan.canPublish || !plan.ready.includes("mesh") || !plan.blocked.includes("twitter")) {
    fail("3 length", "a mixed plan did not separate ready from blocked");
  } else ok();
}

// ---------------------------------------------------------------------------
// 4. PLATFORMS THAT CANNOT RECEIVE A POST AT ALL.
// ---------------------------------------------------------------------------
//
// Saying so beats omitting them: a composer that silently drops Twitch looks
// broken to someone who connected Twitch.

expectBlocked("4 unpublishable", text("hi"), "twitch", "unpublishable");
expectBlocked("4 unpublishable", text("hi"), "spotify", "unpublishable");
expectBlocked("4 unpublishable", text("hi"), "myspace", "unpublishable");

// ---------------------------------------------------------------------------
// 5. NOTHING TO SAY IS NOT SOMETHING TO SEND.
// ---------------------------------------------------------------------------

expectBlocked("5 empty", text("   "), "mesh", "empty");
expectOk("5 empty", withImage(""), "mesh");

// ---------------------------------------------------------------------------
// 6. EVERY RULE IS COHERENT — the table cannot describe an impossible platform.
// ---------------------------------------------------------------------------

for (const rule of PLATFORM_RULES) {
  if (!rule.publishable) continue;
  if (rule.maxChars <= 0) {
    fail("6 coherent", `${rule.platform} is publishable with a ${rule.maxChars}-character limit`);
    continue;
  }
  if (rule.requires && rule.maxMedia < 1) {
    fail("6 coherent", `${rule.platform} requires media but accepts ${rule.maxMedia}`);
    continue;
  }
  if (rule.needsTitle && !rule.maxTitleChars) {
    fail("6 coherent", `${rule.platform} needs a title but declares no title limit`);
    continue;
  }
  if (!ruleFor(rule.platform)) {
    fail("6 coherent", `${rule.platform} is not findable by ruleFor`);
    continue;
  }
  ok();
}

if (failures.length) {
  console.error(`\ncompose-plan: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}

console.log(
  `compose-plan OK — ${checks} assertions. Every refusal is known BEFORE anything is sent: Instagram without a\n` +
    "  photo, TikTok without video, YouTube without a clip or with an over-long title, Reddit without a title,\n" +
    "  and a body measured against the TIGHTEST selected platform rather than the kindest. One platform's refusal\n" +
    "  never blocks the others — ready and blocked are separated, so a post cannot half-land without the composer\n" +
    "  having said so first. Twitch and Spotify are named as unpublishable rather than silently dropped.\n" +
    "  Does NOT cover: delivery. Whether a queued post actually reaches a platform is the publisher's problem,\n" +
    "  and no assertion here should be read as evidence that it did.",
);
