/**
 * THE SUPPLY THAT BELONGS TO NOBODY.
 *
 * mesh.me's premise is that you can browse every platform from here without
 * connecting anything, and connect only when you want to interact. Until now
 * that was not architecturally possible: every content model in the schema
 * hangs off ConnectedAccount, so the only way a video could exist in the
 * database was if some mesh.me user had linked the account that produced it.
 * A new account's Flow was empty, and it stayed empty until the user base
 * happened to supply it. The premise had no table and no fetcher.
 *
 * This module is the fetcher. `PublicPost` is the table.
 *
 * ── THE RULES THIS LAYER EXISTS TO ENFORCE ──────────────────────────────────
 *
 * 1. OFFICIAL APIS ONLY. Every lane names the documented endpoint it calls and
 *    the auth model it uses. No HTML parsing, no private/undocumented
 *    endpoints, no pretending to be a browser.
 * 2. MESH.ME'S OWN CREDENTIALS, NEVER A USER'S. These lanes run on app-level
 *    keys and client-credentials tokens. No user is ever asked for a platform
 *    password, and no user's OAuth token is borrowed to fill a public feed.
 * 3. NO FABRICATION. A lane with no key configured returns nothing and says
 *    "not_configured". It never invents an item, never falls back to a sample,
 *    never leaves a stale row looking fresh. An empty Flow that says why beats
 *    a full Flow that lies.
 * 4. RETENTION IS BOUNDED BY THEIR TERMS, NOT OUR CONVENIENCE. Every lane
 *    declares `retentionHours`; every stored row carries `expiresAt`; every
 *    read filters on it. See store.ts.
 * 5. ATTRIBUTION SURVIVES. The author, their handle and a link back to the
 *    original are carried through to the card. mesh.me is a reader, not a
 *    re-publisher.
 *
 * ── WHAT THIS LAYER CANNOT DO ───────────────────────────────────────────────
 *
 * It cannot make a platform permit something it does not permit. Several major
 * platforms — the ones people ask for most — have no official way for a
 * third-party consumer app to read public content on behalf of someone who has
 * not connected an account. For those, `anonymousRead` is
 * "requires_connection" or "unavailable" and the product SAYS SO on the
 * connect surface, with the reason. Telling someone "connect Instagram to see
 * Instagram" is honest; quietly showing an empty tab is not.
 */

/** What a platform's official API permits for a viewer with no connection. */
export type AnonymousReadVerdict =
  /** An official, documented API returns public content with app-level auth. */
  | "permitted"
  /** Permitted, but materially constrained — quota, tier, or content subset. */
  | "permitted_with_limits"
  /** Officially possible only after that user connects their own account. */
  | "requires_connection"
  /** No official mechanism exists at all for a third-party reader. */
  | "unavailable";

/** How a lane authenticates. Recorded so the claim is auditable, not implied. */
type LaneAuthModel =
  /** Genuinely public endpoint, no credential. */
  | "none"
  /** A static application key (e.g. a YouTube Data API key). */
  | "api_key"
  /** OAuth2 client_credentials — an APP token, never a user token. */
  | "app_token";

export type PublicSupplyLane = {
  /** Stable id, `platform:lane`. Stored on every row it produces. */
  id: string;
  platform: string;
  /** Human label for the status surface. */
  label: string;
  /** The documented endpoint this lane calls. Named so it can be checked. */
  endpoint: string;
  authModel: LaneAuthModel;
  /** Env vars required. Empty means the lane needs no credential. */
  envKeys: string[];
  /**
   * How long a row from this lane may be retained, from the source's terms.
   * Not a performance knob — shortening it is always safe, lengthening it is a
   * compliance decision that needs the platform's terms to actually allow it.
   */
  retentionHours: number;
  /** Minimum seconds between two runs of this lane, from the source's limits. */
  minIntervalSeconds: number;
  /** Attribution the card must carry, if the platform requires specific wording. */
  attribution?: string;
  /** Fetch. MUST return [] rather than throw when unconfigured or failing. */
  fetch: (ctx: LaneContext) => Promise<PublicItem[]>;
};

export type LaneContext = {
  /** Bounded fetch — see fetch.ts. Never call global fetch from a lane. */
  get: (url: string, init?: { headers?: Record<string, string> }) => Promise<unknown>;
  /** Resolved env, so a lane never reads process.env directly and can be tested. */
  env: (key: string) => string | undefined;
  /** How many items this run wants. Lanes should not exceed it. */
  limit: number;
};

/**
 * One item as a lane produces it. Deliberately NOT a FeedCardPost: lanes speak
 * about the source platform, and the translation into a mesh.me card happens in
 * exactly one place (normalize.ts) so every platform lands identically.
 */
export type PublicItem = {
  /** The id on the source platform. Unique per platform. */
  platformPostId: string;
  title?: string | null;
  content?: string | null;
  /** Canonical link back to the original. Attribution depends on this. */
  url: string;
  /** "video" | "short" | "clip" | "image" | "text" | "link" */
  postType: string;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  /**
   * Real length in seconds when the source reports one. The Flow is
   * shorts-only and EXCLUDES what it cannot classify, so a lane that can
   * report duration and does not is silently removing its own items.
   */
  durationSeconds?: number | null;
  lang?: string | null;
  authorName?: string | null;
  authorUsername?: string | null;
  authorAvatarUrl?: string | null;
  authorUrl?: string | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  publishedAt?: Date | null;
  /** Source-declared maturity. Folded with our own classifier, never trusted alone. */
  sourceMarkedMature?: boolean;
};

/** What a platform tells a user about browsing it without connecting. */
export type PlatformSupplyStatus = {
  platform: string;
  name: string;
  anonymousRead: AnonymousReadVerdict;
  /** Plain-language, shown to users. No jargon, no blame, no marketing. */
  reason: string;
  /** Lanes that exist for this platform (may be empty when unavailable). */
  lanes: PublicSupplyLane[];
  /** Official developer docs, so the claim is checkable by anyone. */
  docsUrl?: string;
};

type LaneRunStatus = "ok" | "not_configured" | "rate_limited" | "error";

export type LaneRunResult = {
  laneId: string;
  platform: string;
  status: LaneRunStatus;
  itemsFetched: number;
  itemsStored: number;
  detail?: string;
  durationMs: number;
};
