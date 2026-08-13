"use server";

// THE POST BUTTON, WIRED TO SOMETHING REAL.
//
// This is the seam where a plan becomes a post. It is deliberately thin: the
// rules live in `plan.ts`, the fan-out and its honesty live in `publish.ts`,
// and what counts as "connected" lives in `deliverers.ts` — shared with the
// scheduler, so a post that goes NOW and a post that goes LATER can never
// disagree about which platforms are reachable.
//
// External platforms without a stored credential report `skipped` with
// "Posting here is not connected yet" — a deliberate outcome rather than an
// omission: `publish.ts` has no state meaning "probably fine", so a platform
// with no deliverer says so in the report instead of quietly vanishing.

import { getCurrentUser } from "@/lib/auth";
import { resolveDeliverers } from "./deliverers";
import { publishToTargets, type PublishReport } from "./publish";
import type { Draft } from "./plan";

export type PublishInput = {
  text: string;
  title?: string;
  targets: string[];
};

export async function publishEverywhere(input: PublishInput): Promise<PublishReport | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const draft: Draft = {
    text: input.text ?? "",
    // Media is not carried through the composer yet; declaring it empty keeps
    // the plan honest (Instagram and TikTok will correctly refuse) rather than
    // pretending an attachment exists.
    media: [],
    title: input.title,
  };

  const deliverers = await resolveDeliverers(user);
  return publishToTargets(draft, input.targets, deliverers);
}
