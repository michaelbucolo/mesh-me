"use server";

// THE POST BUTTON, WIRED TO SOMETHING REAL.
//
// This is the seam where a plan becomes a post. It is deliberately thin: the
// rules live in `plan.ts`, the fan-out and its honesty live in `publish.ts`,
// and the protocol lives in `atproto.ts`. What is left here is the part only a
// server can do — establish who is asking, and hand each platform a deliverer.
//
// ── WHAT ACTUALLY POSTS TODAY, AND WHAT HONESTLY DOES NOT ──────────────────
//
// mesh.me posts for real: `createPost` is the same action the feed composer
// uses, so a post made here is indistinguishable from one made there.
//
// Every external platform reports `skipped` with "Posting here is not
// connected yet", because delivery needs a stored credential and that is not
// built. That is a deliberate outcome rather than an omission: `publish.ts`
// has no state meaning "probably fine", so a platform with no deliverer says
// so in the report instead of quietly vanishing from it.
//
// The moment a credential store exists, a deliverer goes in the map below and
// nothing else in this file changes.

import { getCurrentUser } from "@/lib/auth";
import { createPost } from "@/lib/actions";
import { publishToTargets, type Deliverer, type PublishReport } from "./publish";
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

  // The native deliverer. Rate limiting, validation and visibility all stay in
  // `createPost` — reusing it means a post made here obeys every rule a post
  // made anywhere else in the app obeys, rather than a second, weaker copy.
  const mesh: Deliverer = async (d) => {
    const form = new FormData();
    form.set("content", d.text);
    form.set("visibility", "public");
    const res = await createPost(form);
    if (res && typeof res === "object" && "error" in res && res.error) {
      // A rate limit is worth retrying; a validation refusal is not. The action
      // does not distinguish, so this reads the one case we can be sure about.
      const message = String(res.error);
      return { ok: false, retryable: /too fast|slow down/i.test(message), message };
    }
    return { ok: true, url: "/profile" };
  };

  const deliverers: Record<string, Deliverer> = { mesh };

  return publishToTargets(draft, input.targets, deliverers);
}
