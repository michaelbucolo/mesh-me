// PUBLISHING TO SEVERAL PLACES AT ONCE, AND SAYING EXACTLY WHAT HAPPENED.
//
// A cross-post is a fan-out where each leg can fail on its own. The failure
// mode that matters is not "it broke" — it is "it partly worked and nobody
// said so", which sends the person to open five apps and check, the exact
// chore mesh.me exists to remove.
//
// So this returns an outcome PER TARGET, always, and the three outcomes are
// deliberately distinct:
//
//   posted   — we have a url. Not "the server returned 200": a link.
//   skipped  — never attempted, and the reason was known before we started.
//   failed   — attempted and refused, with whether it is worth trying again.
//
// There is no fourth state meaning "probably fine". A publisher that cannot
// tell you which of those five platforms has your post has not saved you the
// trip.
//
// ── PURE ORCHESTRATION: THE DELIVERERS ARE INJECTED ────────────────────────
//
// This file does no network and holds no credentials. The caller supplies a
// deliverer per platform, which is what lets the whole fan-out — including
// partial failure, permanent refusal and retry classification — be checked
// without a single live account.

import { planPublish, type Draft } from "./plan";

type PublishOutcome =
  | { platform: string; state: "posted"; url: string }
  | { platform: string; state: "skipped"; reason: string }
  | { platform: string; state: "failed"; retryable: boolean; message: string };

export type PublishReport = {
  outcomes: PublishOutcome[];
  posted: string[];
  skipped: string[];
  failed: string[];
  /** True when every selected target ended in `posted`. */
  complete: boolean;
  /** One sentence a person can read without decoding the array. */
  summary: string;
};

/** What a platform-specific publisher must do. Returning a url rather than a
 * boolean is the point: a link is proof, a boolean is a claim. */
export type Deliverer = (draft: Draft) => Promise<
  { ok: true; url: string } | { ok: false; retryable: boolean; message: string }
>;

/**
 * Fan the draft out, and report per target.
 *
 * Blocked targets are never attempted — `plan.ts` already knows they would be
 * refused, and spending a request to be told so wastes the platform's rate
 * limit and the person's time.
 *
 * Legs run in PARALLEL and no leg can abort another: one platform being down
 * must not cost you the four that were fine. Every promise is settled, never
 * raced, and a deliverer that throws is caught and recorded rather than taking
 * the whole publish with it.
 */
export async function publishToTargets(
  draft: Draft,
  selected: readonly string[],
  deliverers: Record<string, Deliverer>,
): Promise<PublishReport> {
  const plan = planPublish(draft, selected);

  const blocked = new Map(
    plan.targets.filter((t) => !t.ok).map((t) => [t.platform, t.problems[0]?.message ?? "Not accepted here."]),
  );

  const results = await Promise.all(
    selected.map(async (platform): Promise<PublishOutcome> => {
      const reason = blocked.get(platform);
      if (reason) return { platform, state: "skipped", reason };

      const deliver = deliverers[platform];
      if (!deliver) {
        // A target with no publisher is skipped with the truth, not silently
        // dropped — the person selected it and deserves to know it did not go.
        return { platform, state: "skipped", reason: "Posting here is not connected yet." };
      }

      try {
        const res = await deliver(draft);
        if (res.ok) return { platform, state: "posted", url: res.url };
        return { platform, state: "failed", retryable: res.retryable, message: res.message };
      } catch {
        // A deliverer that throws is a bug in that deliverer, not a verdict on
        // the post. Retryable, because we do not know that it did not land.
        return { platform, state: "failed", retryable: true, message: "Something went wrong sending it." };
      }
    }),
  );

  const posted = results.filter((r) => r.state === "posted").map((r) => r.platform);
  const skipped = results.filter((r) => r.state === "skipped").map((r) => r.platform);
  const failed = results.filter((r) => r.state === "failed").map((r) => r.platform);

  return {
    outcomes: results,
    posted,
    skipped,
    failed,
    complete: results.length > 0 && posted.length === results.length,
    summary: summarise(posted.length, skipped.length, failed.length),
  };
}

/**
 * The sentence shown after publishing.
 *
 * Never "Posted!" when something did not go. The whole reason a person would
 * trust one composer over five apps is that this line is exhaustive.
 */
function summarise(posted: number, skipped: number, failed: number): string {
  if (posted === 0 && skipped === 0 && failed === 0) return "Nothing to post.";

  const parts: string[] = [];
  if (posted > 0) parts.push(`Posted to ${posted}`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);

  if (posted > 0 && failed === 0 && skipped === 0) {
    return posted === 1 ? "Posted." : `Posted to all ${posted}.`;
  }
  if (posted === 0) {
    return failed > 0 ? `Could not post — ${failed} failed.` : "Nothing went out.";
  }
  return `${parts.join(" · ")}.`;
}
