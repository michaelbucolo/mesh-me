import { twitchTopClips } from "./providers/twitch";
import { youtubeMostPopular } from "./providers/youtube";
import type { PlatformSupplyStatus, PublicSupplyLane } from "./types";

/**
 * ONE LIST. THE FETCHERS AND THE PROMISE COME FROM THE SAME PLACE.
 *
 * `PLATFORM_SUPPLY_STATUS` is what the connect page tells users, and
 * `PUBLIC_SUPPLY_LANES` is what actually runs. They are the same objects, so
 * the page cannot advertise a platform no lane implements — the exact drift
 * that let /meshpro sell a gold aura nothing drew.
 *
 * ── THE VERDICTS ARE RESEARCHED, NOT ASSUMED ────────────────────────────────
 *
 * Each was established against the platform's own developer documentation and
 * terms, then independently challenged. Two of them are the reason this file
 * reads the way it does:
 *
 *   REDDIT looks available — this repo already carries REDDIT_CLIENT_ID and
 *   REDDIT_CLIENT_SECRET from the connected-account flow, so wiring a public
 *   lane would have felt like free reuse. It is not. Reddit closed self-service
 *   API registration in November 2025, and a product that charges for anything
 *   falls inside its definition of commercial use, which needs a signed
 *   contract. Building on those existing variables would have shipped a terms
 *   violation that looked like an easy win.
 *
 *   INSTAGRAM, TIKTOK, X and SNAPCHAT are the four platforms people ask for
 *   most, and the honest answer for them is no. That answer is written into the
 *   product rather than hidden behind an empty tab, because "connect Instagram
 *   to see Instagram" is a five-second disappointment while a blank feed is a
 *   conclusion that mesh.me is broken.
 *
 * When a platform changes its terms, this file is the one place to change —
 * and `reason` is user-facing, so it must stay plain, specific, and free of
 * blame. These companies are not villains for having an API policy.
 *
 * ── THE SUPPLY IS NOW CREDENTIAL-GATED, AND THAT IS A REAL COST ─────────────
 *
 * mesh.me's platform list is the twelve US-popular ones in lib/platforms.ts.
 * Bluesky and Mastodon are not on it, so their lanes are gone — and they were
 * the ONLY two that ran without credentials. Measured before removal they were
 * supplying the entire Flow: 20 short videos with nothing configured.
 *
 * What remains is YouTube and Twitch, both of which need keys. Of the rest of
 * the list, Instagram, Snapchat and Threads publish no discovery API a
 * third-party reader may use, and X charges per post read. So until
 * YOUTUBE_API_KEY or TWITCH_CLIENT_ID/SECRET is set, the Flow has no public
 * supply at all and falls back to whatever mesh.me's own users have posted or
 * connected.
 *
 * That is the direct consequence of the platform list, written down at the
 * moment it was taken rather than rediscovered as a bug.
 *
 * ── THE ANTI-SUBSTITUTE CLAUSE, AND WHY IT SHAPES THIS WHOLE MODULE ─────────
 *
 * An adversarial re-check of every verdict found the same clause in three
 * different agreements, none of which the first pass had opened:
 *
 *   YouTube Developer Policies III.I — must not "recreate the browse
 *   experience from any YouTube Application without adding significant
 *   independent value to that flow".
 *
 *   X Developer Agreement III.A(c) — must not "create a substitute or similar
 *   service or product to the X Applications".
 *
 *   Snap Public Content Display Terms §2 — "Don't use the Embed or Public
 *   Content to replicate or compete with the Snapchat application."
 *
 * That is not three coincidences. Every large platform forbids being cloned,
 * and a single-platform feed inside mesh.me is exactly a clone of that
 * platform's browse experience. What makes this defensible is the ONE thing
 * mesh.me does that no source can: putting several networks in one place
 * alongside a person's own mesh. The independent value is the meshing.
 *
 * So this is a design constraint, not a footnote. A "YouTube tab" or a
 * "Twitch tab" — one platform, its own surface, its own browse flow — would
 * breach the clause the moment it shipped. Lanes feed the MERGED Flow, and
 * that is why the store has no per-platform browse route and why
 * getPublicSupplyFeedPosts returns into getCombinedFeedPosts rather than
 * anywhere a single platform could be isolated.
 *
 * ── WHAT ELSE THE RE-CHECK CORRECTED ────────────────────────────────────────
 *
 * VIMEO was researched as permitted and is not: its Developer Addendum §3.5
 * says "You may not charge End Users a fee for your Application", and MeshPro
 * is a fee. It was never built, which was luck rather than judgement — it was
 * on the shortlist as "the cheapest next platform to add".
 *
 * MASTODON needs a per-server answer, not a platform-wide one. Mastodon gGmbH
 * publishes a default terms template that many servers adopt, and it prohibits
 * automated systems accessing the service. Reading a documented public trends
 * endpoint that a server has deliberately left open is a long way from the
 * scraping that clause targets — but it is the server operator's call, not
 * ours, and the lane currently makes it for them. Flagged, not resolved.
 */

export const PUBLIC_SUPPLY_LANES: PublicSupplyLane[] = [
  youtubeMostPopular,
  twitchTopClips,
];

export const PLATFORM_SUPPLY_STATUS: PlatformSupplyStatus[] = [
  {
    platform: "youtube",
    name: "YouTube",
    anonymousRead: "permitted_with_limits",
    reason:
      "Trending videos play here without connecting anything. Connect YouTube to see your own subscriptions, and to like or comment without leaving.",
    lanes: [youtubeMostPopular],
    docsUrl: "https://developers.google.com/youtube/v3",
  },
  {
    platform: "twitch",
    name: "Twitch",
    anonymousRead: "permitted_with_limits",
    reason:
      "Top clips from the biggest categories show up without connecting. Connect Twitch to follow channels and see who is live for you.",
    lanes: [twitchTopClips],
    docsUrl: "https://dev.twitch.tv/docs/api/",
  },
  {
    platform: "instagram",
    name: "Instagram",
    // The subtlest verdict here, and worth getting exactly right because
    // Instagram is the platform people ask for most.
    //
    // Instagram's oEmbed no longer needs a token, so a specific post CAN be
    // shown when mesh.me already has its link. What does not exist is any way
    // to search, list or discover — no trending endpoint, no hashtag read for
    // an app like this, no public timeline. Business Discovery and Hashtag
    // Search look like the answer and are not: both run AS a connected
    // Instagram professional account and need App Review.
    //
    // So there is no lane, because a feed needs discovery and Instagram
    // publishes none. Connecting gets you YOUR OWN posts, and that is the whole
    // of what any third-party app can offer.
    //
    // CORRECTED after an adversarial re-check: the first version of this entry
    // said a linked post "shows up fine". The transport does work tokenless,
    // but Meta Developer Policies §6.2 says don't "use the Instagram Platform
    // to simply display User Content" — which is what an unfurl in someone
    // else's feed is. Working and permitted are different questions, and this
    // entry originally answered only the first.
    anonymousRead: "requires_connection",
    reason:
      "Instagram offers no way for another app to browse or search its content, and Meta's developer policies separately forbid an app from existing to display other people's Instagram posts. Connecting your account brings your own Instagram posts onto your mesh — that is the whole of what any third-party app can do here.",
    lanes: [],
    docsUrl: "https://developers.facebook.com/docs/instagram-platform",
  },
  {
    platform: "twitter",
    name: "X",
    // The one platform where the barrier is price rather than permission. The
    // app-only bearer token still officially serves public posts — but since
    // 6 February 2026 X charges per post read with no free allowance. So this
    // is buildable the moment someone decides to fund it, and dishonest to
    // ship before then. Recorded as "unavailable" because that is what it is
    // for a user today; the reason says why, so nobody re-litigates it.
    anonymousRead: "unavailable",
    reason:
      "X now charges for every post an app reads, with no free allowance. Rather than pass that on or quietly show you a thin feed, mesh.me does not pull from X. A specific post still shows up when someone links it.",
    lanes: [],
    docsUrl: "https://docs.x.com/x-api/introduction",
  },
  {
    platform: "snapchat",
    name: "Snapchat",
    // The flattest no in the list. Snapchat's content-bearing endpoints are
    // allowlist-only, need a Snap Business account, and require each
    // individual creator's authorization. There is no version of this that
    // works for a general reader.
    anonymousRead: "unavailable",
    reason:
      "Snapchat has no content API another app can read — not for public Spotlights, not for Stories, and not with your account connected. Snaps cannot appear here.",
    lanes: [],
    docsUrl: "https://developers.snap.com/",
  },
];


/** Platforms a viewer can browse right now with nothing connected. */
export function browsableWithoutConnecting(): PlatformSupplyStatus[] {
  return PLATFORM_SUPPLY_STATUS.filter((entry) => entry.anonymousRead.startsWith("permitted"));
}
