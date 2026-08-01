// THE ONE DOOR THE PLATFORMS CANNOT QUIETLY CLOSE — AND THE THREE WAYS IT
// COULD START LYING.
//
// Six of the twelve platforms mesh.me offers grant NO content API: Instagram,
// Facebook, Threads, Snapchat, LinkedIn, Pinterest. mesh.me can hold an OAuth
// token for them and do nothing with it. That is their commercial decision, not
// an engineering gap, and waiting for it to change is waiting forever — a
// working export is exactly how a competitor solves cold-start, so degrading it
// is rational rather than careless.
//
// GDPR Art. 20 and DMA Art. 6(9) oblige them to hand the USER their own
// archive. A legal duty, not an API grant. `portabilityImport` marks the
// platforms where a documented consumer export exists.
//
// That is a genuinely different claim from every other capability on the table,
// and it can decay in three specific ways. This gates all three.

import assert from "node:assert/strict";
import { ALL_PLATFORM_IDS } from "../src/lib/oauth";
import {
  getPlatformCapability,
  getPlatformPortabilityCapability,
} from "../src/lib/platform-capabilities";

let checks = 0;

const roster = ALL_PLATFORM_IDS;
assert.ok(roster.length >= 10, `the roster parsed as ${roster.length} platforms; a loop over an empty roster passes everything.`);
checks += 1;

const portability = roster.filter((id) => getPlatformCapability(id)?.portabilityImport);
const importContent = roster.filter((id) => getPlatformCapability(id)?.importContent);

// ── 1. THE TWO AXES MUST STAY DISJOINT ──────────────────────────────────────
//
// `importContent` means mesh.me can ask the platform's API, and keep asking —
// a live sync. `portabilityImport` means a human downloads a file and hands it
// over, once. If a platform ever carried both, "import your Instagram history"
// would start satisfying a claim that reads "syncs your Instagram", and
// unified-claim-check would wave it through because the platform now has AN
// import flag. That is the whole failure mode, so it is assertion one.
{
  const both = portability.filter((id) => importContent.includes(id));
  assert.deepEqual(
    both,
    [],
    `these platforms claim BOTH a live content API and a user-supplied export:\n` +
      both.map((id) => `    ${id}`).join("\n") +
      "\n  They are different promises. A one-time file a person hands over must never be able to\n" +
      "  satisfy a sentence that says mesh.me syncs, follows, or keeps up with that platform.\n" +
      "  If a platform genuinely gains a content API, move it — do not let it hold both.",
  );
  checks += 1;
}

// ── 2. EVERY PORTABILITY PLATFORM CARRIES A READABLE REASON ─────────────────
//
// Mirrors the rule the messaging gate already enforces: a capability that is
// true with no explanation is a flag somebody set, not a fact somebody checked.
// The reason has to name it as a user-supplied export, because the entire
// honesty of this axis rests on WHO does the fetching.
{
  for (const id of portability) {
    const capability = getPlatformCapability(id)!;
    const reason = capability.portabilityReason ?? "";
    assert.ok(
      reason.length >= 20,
      `${id} sets portabilityImport with no usable portabilityReason. Say which export it is and\n` +
        "  that the person supplies it.",
    );
    assert.match(
      reason,
      /user-supplied|you |your |download/i,
      `${id}'s portabilityReason does not make clear the USER supplies the file:\n    "${reason}"\n` +
        "  mesh.me does not fetch this. If the wording lets a reader think it does, the claim is wrong.",
    );
    checks += 2;
  }
}

// ── 3. THE COPY MAY NOT PROMISE THE SOCIAL GRAPH ────────────────────────────
//
// W3C's data-portability minutes record that the follower graph is "the primary
// asset and normally not exported, not even upon GDPR request". The archives
// carry posts, media and messages. So "import your history" is true and
// "import your connections" is not — and the second is the more tempting
// sentence, which is why it is gated rather than trusted to a comment.
{
  const FORBIDDEN = /\b(connections|followers|following|friend graph|social graph)\b/i;
  for (const id of portability) {
    const reason = getPlatformCapability(id)!.portabilityReason ?? "";
    // Naming what is ABSENT is fine and encouraged — "the follower graph is not
    // included" is the honest sentence. Only a PROMISE of the graph fails.
    const promises = FORBIDDEN.test(reason) && !/not included|not as a graph|only as names|does not/i.test(reason);
    assert.ok(
      !promises,
      `${id}'s portabilityReason appears to promise the social graph:\n    "${reason}"\n` +
        "  Consumer exports do not contain the follower graph. Say history, posts, media, messages —\n" +
        "  and if you mention connections at all, say they are NOT included.",
    );
    checks += 1;
  }
}

// ── 4. THE GETTER FAILS CLOSED ──────────────────────────────────────────────
{
  const unknown = getPlatformPortabilityCapability("a-platform-that-does-not-exist");
  assert.equal(unknown.supported, false, "an unknown platform must not report a supported export.");
  assert.ok(unknown.reason.length > 20, "the unsupported branch must explain itself, not return an empty string.");
  checks += 2;

  for (const id of portability) {
    const verdict = getPlatformPortabilityCapability(id);
    assert.equal(verdict.supported, true, `${id} sets portabilityImport but the getter reports unsupported.`);
    checks += 1;
  }
  // And a platform with no flag must be unsupported, not merely undefined.
  for (const id of roster.filter((x) => !portability.includes(x))) {
    assert.equal(
      getPlatformPortabilityCapability(id).supported,
      false,
      `${id} has no portabilityImport flag but the getter reports it supported.`,
    );
    checks += 1;
  }
}

console.log(
  `portability-claim OK — ${checks} assertions across ${roster.length} platforms.\n` +
    `  ${portability.length} carry a documented consumer export (${portability.join(", ")}),\n` +
    `  ${importContent.length} carry a live content API, and the two sets do not overlap —\n` +
    "  so a file a person hands over can never satisfy a sentence that says mesh.me syncs.\n" +
    "  Every export names the user as the supplier, and none promises the follower graph,\n" +
    "  which consumer archives do not contain.\n" +
    "  Does NOT cover: whether the export FORMAT still parses — that is the importer's problem,\n" +
    "  and these files change shape without notice.",
);
