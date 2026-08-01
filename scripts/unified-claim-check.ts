/**
 * THE PRODUCT MAY NOT PROMISE A UNIFICATION THE CAPABILITY TABLE DOES NOT GRANT.
 *
 * mesh.me's premise is that one account stands in for someone's other accounts.
 * That premise is only as good as the part of it that is actually true, and the
 * true part is written down: src/lib/platform-capabilities.ts records, per
 * platform, whether an official API permits importing content, cross-posting,
 * syncing interactions, or syncing messages — with a reason for each refusal.
 *
 * The copy had drifted a long way from it. Measured off that table:
 *
 *     18 platforms listed
 *      5 can import content        (X, YouTube, Twitch, Spotify, Discord)
 *      2 can cross-post            (X, Reddit — Reddit gained it later; this line said
 *                                  "1 (X)" for a while after that, which is how a
 *                                  gate about honest copy came to carry a stale count)
 *      3 can sync interactions
 *      0 of 9 messengers can sync a message — not one of WhatsApp, Messenger,
 *        Telegram, Signal, Discord, WeChat, LINE, Viber or KakaoTalk exposes a
 *        direct-message API to connected apps
 *
 * While that was so, the app shell described /messages as "Your universal
 * messaging hub. All your conversations, in one place.", its empty state said
 * "Every conversation — from mesh.me and all your connected platforms — lives
 * here", and Meshi answered "what can this do?" with "Messages (unified inbox)"
 * and "cross-platform posting". Four confident statements, zero platforms
 * behind them.
 *
 * This is the same failure `claim-truth:check` was written for — copy asserting
 * what the code does not do — with one difference that makes it checkable
 * rather than judgeable: the truth is already a data structure. So this gate
 * does not pattern-match marketing language against a wordlist. It reads the
 * capability table, computes what is actually supported, and fails when
 * user-facing copy claims a category the table cannot back.
 *
 * WHICH MEANS IT UNBLOCKS ITSELF. The day enough messengers ship an official
 * DM API and their entries flip to supported, the messaging claims stop
 * failing here on their own. Nobody has to remember to relax a rule.
 *
 * ── WHAT THIS CANNOT DO ──────────────────────────────────────────────────────
 *
 * It reads string literals in named files. Copy assembled from variables, held
 * in the database, or living in a file not listed below is invisible to it. It
 * also cannot judge a claim that is merely optimistic rather than categorically
 * false — "bring your world together" asserts nothing checkable, and this gate
 * deliberately says nothing about it.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformCapability, getPlatformMessagingCapability } from "../src/lib/platform-capabilities";
import { MESH_PLATFORM_IDS, MESH_PLATFORMS } from "../src/lib/platforms";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => {
  checks += 1;
};

// ── 1. WHAT IS ACTUALLY TRUE, COMPUTED ──────────────────────────────────────
const caps = MESH_PLATFORM_IDS.map((id) => getPlatformCapability(id)).filter(Boolean) as Array<{
  id: string;
  importContent: boolean;
  crossPost: boolean;
  interactionSync: boolean;
}>;

const MESSENGER_IDS = MESH_PLATFORMS.filter((p) => p.category === "messaging").map((p) => p.id);

const supported = {
  import: caps.filter((c) => c.importContent).map((c) => c.id),
  crossPost: caps.filter((c) => c.crossPost).map((c) => c.id),
  interaction: caps.filter((c) => c.interactionSync).map((c) => c.id),
  messaging: MESSENGER_IDS.filter((id) => {
    const m = getPlatformMessagingCapability(id) as { supported?: boolean };
    return Boolean(m?.supported);
  }),
};

if (caps.length < 5) {
  fail("1 capability table", "the capability table returned almost nothing; this gate has lost its subject");
} else ok();

// ── 2. NO SURFACE CLAIMS A UNIFICATION WITHOUT THE PLATFORMS TO BACK IT ─────
//
// A CLAIM IS EARNED BY ENOUGH PLATFORMS, NOT BY MORE THAN ZERO. The first
// spelling of this section asked only `backing.length > 0`, and mutation
// testing caught what that lets through: re-inserting "cross-platform posting"
// PASSED, because exactly one platform (X) can cross-post. One platform is not
// cross-platform. The word is plural and so is the promise.
//
// So each rule carries the strength of its own wording:
//   "all" — the copy says every/all/universal, so every platform in the
//           relevant set has to support it or the sentence is simply false.
//   2     — the copy is plural ("cross-platform", "unified"), which cannot be
//           satisfied by a single platform whatever else is true.
type Rule = {
  category: keyof typeof supported;
  pattern: RegExp;
  minBacking: number | "all";
  what: string;
};

const RULES: Rule[] = [
  {
    category: "messaging",
    pattern: /\b(all your conversations|every conversation|universal messaging)\b/i,
    minBacking: "all",
    what: "that EVERY conversation, from every connected platform, is held here",
  },
  {
    category: "messaging",
    pattern: /\bunified inbox\b/i,
    minBacking: 2,
    what: "that inboxes from more than one platform are unified",
  },
  {
    category: "messaging",
    pattern: /messages?\s+from\s+(all|every)\b/i,
    minBacking: "all",
    what: "that messages arrive from all other platforms",
  },
  {
    category: "crossPost",
    pattern: /\b(cross-platform posting|cross-post to your platforms)\b/i,
    minBacking: 2,
    what: "that a post can be published across more than one platform",
  },
  {
    category: "crossPost",
    pattern: /\b(post to all|publish everywhere|post everywhere|posts everywhere)\b/i,
    minBacking: "all",
    what: "that a post reaches every connected platform",
  },
];

const SURFACES = [
  "src/components/layout/app-shell.tsx",
  "src/components/messages/messages-index-pane.tsx",
  "src/components/messages/mechat-conversation-list.tsx",
  "src/app/api/meshi/chat/route.ts",
  "src/lib/brand.ts",
  "src/components/analytics/analytics-dashboard.tsx",
];

/** Blank out comments so a rule EXPLAINING a retired claim is not itself a claim. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/^\s*\/\/.*$/gm, (m) => " ".repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => " ".repeat(m.length));
}

for (const file of SURFACES) {
  let body: string;
  try {
    body = stripComments(read(file));
  } catch {
    fail("2 no empty promises", `${file} is gone; this gate has lost one of its subjects`);
    continue;
  }

  for (const rule of RULES) {
    const hit = rule.pattern.exec(body);
    if (!hit) continue;
    const backing = supported[rule.category];
    const universe = rule.category === "messaging" ? MESSENGER_IDS.length : caps.length;
    const needed = rule.minBacking === "all" ? universe : rule.minBacking;
    if (backing.length >= needed) {
      // The claim is now earned. This is the self-unblocking path.
      continue;
    }
    const line = body.slice(0, hit.index).split("\n").length;
    fail(
      "2 no empty promises",
      `${file}:${line} claims ${rule.what} — "${hit[0]}".\n` +
        `  ${backing.length} of ${universe} platforms support that; this wording needs ${needed}.\n` +
        (backing.length ? `  Supported today: ${backing.join(", ")}.\n` : "") +
        "  The capability table is the source of truth; when enough platforms permit this, the claim\n" +
        "  stops failing here by itself. Until then the sentence is bigger than the feature.",
    );
  }
}
if (!failures.some((f) => f.startsWith("[2"))) ok();

// ── 3. THE REFUSALS STAY EXPLAINED ──────────────────────────────────────────
//
// A capability set to false with no reason is how the table stops being usable
// as an answer to "why can't it do that?" — which is the question a person asks
// the moment the honest copy above tells them it can't.
{
  const unexplained = MESSENGER_IDS.filter((id) => {
    const m = getPlatformMessagingCapability(id) as { supported?: boolean; reason?: string };
    return !m?.supported && (!m?.reason || m.reason.trim().length < 20);
  });
  if (unexplained.length) {
    fail(
      "3 refusals explained",
      `these platforms refuse messaging with no usable reason: ${unexplained.join(", ")}.\n` +
        "  The reason is what the One Account page shows a person who asks why. Without it the product\n" +
        "  can only say no.",
    );
  } else ok();
}

// ── 4. THE TABLE IS STILL THE ONE PLACE ─────────────────────────────────────
//
// If a second hard-coded list of "platforms we can post to" appears anywhere,
// the gate above becomes decorative: copy would be checked against one list
// while the feature reads another. That is this codebase's oldest failure —
// two places state one fact, and only one of them is ever taught the rule.
{
  const capsSource = read("src/lib/platform-capabilities.ts");
  assert.ok(
    /crossPost/.test(capsSource) && /importContent/.test(capsSource),
    "platform-capabilities.ts no longer declares the capability flags this gate reads",
  );
  ok();
}

if (failures.length) {
  console.error(`\nunified-claim: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `unified-claim OK — ${checks} assertions. Measured from the capability table: ` +
    `${supported.import.length} of ${caps.length} platforms can import, ${supported.crossPost.length} can cross-post, ` +
    `${supported.interaction.length} can sync interactions, and ${supported.messaging.length} of ${MESSENGER_IDS.length} messengers\n` +
    "  can sync a message. No shipped surface claims a unification without the platforms to back it —\n" +
    "  universal wording needs universal support, plural wording needs at least two — and every refusal\n" +
    "  carries a reason a person can read. These rules unblock themselves: when enough platforms permit\n" +
    "  something, the claim stops failing without anyone editing this file.\n" +
    "  Does NOT cover: copy built from variables, held in the database, or outside the named files —\n" +
    "  nor claims that are merely optimistic rather than categorically false.",
);
