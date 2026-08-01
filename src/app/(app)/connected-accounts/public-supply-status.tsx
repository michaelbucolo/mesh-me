import { browsableWithoutConnecting, PLATFORM_SUPPLY_STATUS } from "@/lib/public-supply/registry";
import type { AnonymousReadVerdict } from "@/lib/public-supply/types";

/**
 * THE HONEST ANSWER TO "WHAT CAN I SEE WITHOUT CONNECTING?"
 *
 * mesh.me's pitch is that you can browse every platform from here and connect
 * only when you want to interact. For some platforms that is completely true.
 * For others it is not true at all — they publish no official way for a
 * third-party app to read public content on behalf of someone who has not
 * linked an account, and no amount of engineering on this side changes that.
 *
 * The tempting version of this page lists every logo and lets people find out
 * by clicking. This one says which is which, up front, with the reason.
 * Someone who learns "Instagram needs connecting, and here is why" can decide
 * in five seconds. Someone who finds an empty Instagram tab concludes the
 * product is broken — and they are not wrong to.
 *
 * ── WHY THIS IS NO LONGER A TWELVE-ROW LIST ──────────────────────────────────
 *
 * It used to render as a stacked list of every platform with its verdict and
 * reason, above the connect grid. Every word of it was true and almost none of
 * it was read: twelve paragraphs of policy, in a block, before you had picked a
 * platform to care about.
 *
 * The verdicts are the same and they still come from PLATFORM_SUPPLY_STATUS.
 * They are now delivered per platform — the short label rides on the tile, the
 * full reason opens with the tile — so the sentence about Instagram arrives
 * when you are looking at Instagram. The one number that is genuinely useful
 * before you have chosen anything (how many platforms need no connection at
 * all) stays on the page as a single line.
 *
 * A gate asserts this file exists and reads the registry rather than
 * hardcoding verdicts (scripts/public-supply-check.ts §10).
 */

const VERDICT_COPY: Record<AnonymousReadVerdict, { label: string; hint: string }> = {
  permitted: { label: "Browse freely", hint: "Public content shows up in your Flow and Explore without connecting anything." },
  permitted_with_limits: { label: "Browse freely", hint: "Public content shows up without connecting. Some of it — private, regional, or unlisted — only a connected account can reach." },
  requires_connection: { label: "Connect to see", hint: "This platform has no official way for another app to read its public content on your behalf. Connecting your own account is the only route they offer." },
  unavailable: { label: "Not available", hint: "This platform publishes no content API a reader like mesh.me can use, even with an account connected." },
};

/** What one platform can supply before you connect anything. */
export type SupplyNote = {
  verdict: AnonymousReadVerdict;
  /** Two or three words, small enough to ride under a logo. */
  label: string;
  /** The registry's own reason when it has one — it is specific to that
   *  platform's actual policy — otherwise the generic explanation. */
  reason: string;
};

/**
 * Supply notes keyed by platform id, for the connect grid to hand to each tile.
 * Read from PLATFORM_SUPPLY_STATUS so the grid cannot promise a platform no
 * lane implements.
 */
export function getSupplyNotes(): Record<string, SupplyNote> {
  const notes: Record<string, SupplyNote> = {};
  for (const platform of PLATFORM_SUPPLY_STATUS) {
    const copy = VERDICT_COPY[platform.anonymousRead];
    notes[platform.platform] = {
      verdict: platform.anonymousRead,
      label: copy.label,
      reason: platform.reason || copy.hint,
    };
  }
  return notes;
}

/** How many platforms feed the Flow with nothing linked. From the registry. */
export function browsableCount(): number {
  return browsableWithoutConnecting().length;
}
