import type { PlatformContentAction } from "@/lib/api-validation";
import { isMeshPlatform, MESH_PLATFORMS } from "@/lib/platforms";

type PlatformActionCapability = {
  supported: boolean;
  reason: string;
  requiredScopes?: string[];
  docsUrl?: string;
  reviewRequired?: boolean;
  userInitiatedOnly?: boolean;
};

export type PlatformCapability = {
  id: string;
  name: string;
  authType: "oauth" | "manual";
  importContent: boolean;
  notificationSync: boolean;
  crossPost: boolean;
  interactionSync: boolean;
  officialApiOnly: boolean;
  /**
   * THE ONE AXIS THAT DOES NOT DEPEND ON THE PLATFORM SAYING YES.
   *
   * Six of the twelve platforms mesh.me offers — Instagram, Facebook, Threads,
   * Snapchat, LinkedIn, Pinterest — grant NO content API at all. mesh.me can
   * hold an OAuth token for them and do nothing with it, and no amount of
   * engineering changes that, because it is their commercial decision. Waiting
   * for it is waiting forever: a working export is how a competitor solves
   * cold-start, so degrading it is rational rather than careless.
   *
   * But under GDPR Art. 20 and DMA Art. 6(9) those platforms are OBLIGED to
   * hand the USER their own archive. That is a legal duty, not an API grant,
   * and it is the one door they cannot quietly close.
   *
   * `portabilityImport` means: a documented consumer export exists that a
   * person can download and give to mesh.me themselves.
   *
   * IT IS DELIBERATELY NOT `importContent`. importContent means mesh.me can
   * ask the platform's API and keep asking — a live sync. This is a one-time
   * file a human hands over. Collapsing the two would let "import your
   * Instagram history" quietly start satisfying a claim that reads "syncs your
   * Instagram", and the gate asserts the two sets stay disjoint.
   *
   * NOTE ON WHAT IS IN THE FILE: the archive is posts, media and messages. It
   * is NOT the social graph — W3C's data-portability minutes record that the
   * follower graph is "the primary asset and normally not exported, not even
   * upon GDPR request". Copy may say "your history". It may not say "your
   * connections".
   */
  portabilityImport?: boolean;
  /** Why, in a sentence, naming it as a user-supplied one-time export. */
  portabilityReason?: string;
  developerDocsUrl?: string;
  developerPolicyUrl?: string;
  notes: string;
};

const DEFAULT_UNSUPPORTED_REASON =
  "This source is read-only in Mesh.me right now. Mesh.me only writes to connected platforms after the official API, approved scopes, and source-specific review allow it.";

const CROSS_POST_UNSUPPORTED_REASON =
  "Cross-posting to this source is disabled until Mesh.me has official publishing API access, approved scopes, and any required platform review.";

const COMMENT_DELETE_UNSUPPORTED_REASON =
  "Deleting source-platform comments is disabled until the provider grants an official moderation API permission for this account.";

const manualSource = (id: string, name = id.charAt(0).toUpperCase() + id.slice(1)): PlatformCapability => ({
  id,
  name,
  authType: "manual",
  importContent: false,
  notificationSync: false,
  crossPost: false,
  interactionSync: false,
  officialApiOnly: true,
  notes: "Manual source tracking only. Mesh.me does not scrape, automate, or impersonate this platform.",
});

const oauthShell = (
  id: string,
  name = id.charAt(0).toUpperCase() + id.slice(1),
  extra: Partial<PlatformCapability> = {},
): PlatformCapability => ({
  id,
  name,
  authType: "oauth",
  importContent: false,
  notificationSync: false,
  crossPost: false,
  interactionSync: false,
  officialApiOnly: true,
  notes: "Connection shell is present. Full sync depends on provider approval, granted scopes, API availability, and the provider terms.",
  ...extra,
});

/**
 * Declared capabilities for platforms mesh.me still offers.
 *
 * The array below is the RAW set — it keeps entries for platforms that have
 * been retired, because deleting them would also delete the notes explaining
 * what each one does and does not permit, which is the expensive part. The
 * exported map filters through the allow-list in lib/platforms.ts, so a
 * retired entry is inert rather than removed.
 */
const RAW_PLATFORM_CAPABILITIES: PlatformCapability[] = [
  oauthShell("github", "GitHub", {
    importContent: true,
    developerDocsUrl: "https://docs.github.com/en/rest",
    developerPolicyUrl: "https://docs.github.com/en/site-policy",
    interactionSync: true,
    notes: "Imports authorized account and repository data through GitHub APIs. Starring and following are written back through the official REST API when the account grants the needed scopes.",
  }),
  oauthShell("youtube", "YouTube", {
    importContent: true,
    developerDocsUrl: "https://developers.google.com/youtube/v3",
    developerPolicyUrl: "https://developers.google.com/youtube/terms/developer-policies",
    interactionSync: true,
    notes: "Reads channel data and writes back likes, comments, and subscriptions through the official YouTube Data API when the account grants the youtube.force-ssl scope.",
  }),
  oauthShell("twitter", "X / Twitter", {
    importContent: true,
    developerDocsUrl: "https://docs.x.com/x-api",
    developerPolicyUrl: "https://developer.x.com/en/developer-terms/agreement-and-policy",
    interactionSync: true,
    crossPost: true,
    notes: "Reads account data and writes back likes, reposts, replies, follows, and posts through the official X API v2 when the account grants write scopes.",
  }),
  oauthShell("discord", "Discord", {
    importContent: true,
    developerDocsUrl: "https://docs.discord.com/developers/docs/intro",
    developerPolicyUrl: "https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service",
    notes: "Imports authorized account and server list context through Discord OAuth scopes. Message content sync and user-message actions are disabled unless Discord grants the needed access.",
  }),
  oauthShell("spotify", "Spotify", {
    importContent: true,
    developerDocsUrl: "https://developer.spotify.com/documentation/web-api",
    interactionSync: true,
    notes: "Imports authorized profile and playlist data. Playlist follows and user follows are written back through the official Web API when the account grants the needed scopes.",
  }),
  oauthShell("twitch", "Twitch", {
    importContent: true,
    developerDocsUrl: "https://dev.twitch.tv/docs/api/",
    notes: "Imports authorized profile, channel video, follower-count, and followed-channel records with Twitch OAuth scopes. Write actions are disabled.",
  }),
  oauthShell("tiktok", "TikTok", {
    importContent: true,
    developerDocsUrl: "https://developers.tiktok.com/doc/",
    developerPolicyUrl: "https://developers.tiktok.com/doc/our-guidelines-developer-guidelines",
    notes: "Imports authorized video/profile data when the connected app has the required TikTok permissions. Publishing remains disabled until Content Posting API approval is configured.",
  }),
  oauthShell("instagram", "Instagram", {
    portabilityImport: true,
    portabilityReason:
      "A user-supplied one-time export. Meta's \"Download your information\" gives you your Instagram posts, media and messages under GDPR Art. 20 / DMA Art. 6(9); the follower graph is not included.",
    developerDocsUrl: "https://developers.facebook.com/docs/instagram-platform/",
    developerPolicyUrl: "https://developers.facebook.com/policy/",
  }),
  oauthShell("facebook", "Facebook", {
    portabilityImport: true,
    portabilityReason:
      "A user-supplied one-time export. Meta's \"Download your information\" covers Facebook posts, media and messages; the friend graph is not included.",
    developerDocsUrl: "https://developers.facebook.com/docs/graph-api/",
    developerPolicyUrl: "https://developers.facebook.com/policy/",
  }),
  oauthShell("linkedin", "LinkedIn", {
    portabilityImport: true,
    portabilityReason:
      "A user-supplied one-time export. LinkedIn's \"Get a copy of your data\" returns your posts and profile; connections come only as names, not as a graph mesh.me can rebuild.",
    developerDocsUrl: "https://learn.microsoft.com/en-us/linkedin/",
  }),
  oauthShell("reddit", "Reddit", {
    importContent: true,
    developerDocsUrl: "https://www.reddit.com/dev/api/",
    interactionSync: true,
    crossPost: true,
    notes: "Imports authorized account identity, submitted posts, and post comment threads through Reddit OAuth scopes. Votes, comments, edits, deletes, posts, and subscriptions are written back only when the signed-in user takes the action.",
  }),
  oauthShell("pinterest", "Pinterest", {
    portabilityImport: true,
    portabilityReason:
      "A user-supplied one-time export. Pinterest's data-download request returns your pins and boards.",
    developerDocsUrl: "https://developers.pinterest.com/docs/api/v5/",
  }),
  oauthShell("snapchat", "Snapchat", {
    portabilityImport: true,
    portabilityReason:
      "A user-supplied one-time export. Snapchat's \"My Data\" download returns your memories and account history.",
    developerDocsUrl: "https://developers.snap.com/",
  }),
  oauthShell("threads", "Threads", {
    portabilityImport: true,
    portabilityReason:
      "A user-supplied one-time export, taken through the same Meta \"Download your information\" flow as Instagram; the follower graph is not included.",
    developerDocsUrl: "https://developers.facebook.com/docs/threads/",
    developerPolicyUrl: "https://developers.facebook.com/policy/",
  }),
  oauthShell("soundcloud", "SoundCloud", {
    developerDocsUrl: "https://developers.soundcloud.com/docs/api/explorer/open-api",
  }),
  oauthShell("patreon", "Patreon", {
    developerDocsUrl: "https://docs.patreon.com/",
  }),
  oauthShell("dribbble", "Dribbble", {
    developerDocsUrl: "https://developer.dribbble.com/",
  }),
  ...[
    ["bluesky", "Bluesky"],
    ["applemusic", "Apple Music"],
    ["mastodon", "Mastodon"],
    ["substack", "Substack"],
    ["medium", "Medium"],
    ["devto", "DEV"],
    ["behance", "Behance"],
    ["whatsapp", "WhatsApp"],
    ["telegram", "Telegram"],
    ["signal", "Signal"],
    ["line", "Line"],
    ["kakao", "KakaoTalk"],
    ["viber", "Viber"],
    ["wechat", "WeChat"],
    ["messenger", "Messenger"],
    ["tumblr", "Tumblr"],
  ].map(([id, name]) => manualSource(id, name)),
];

/**
 * What mesh.me actually offers: the raw declarations, restricted to the
 * allow-list, plus a conservative shell for any allowed platform that has no
 * declaration yet (today all twelve have one, so the fallback synthesizes
 * nothing — it stays because a missing declaration must mean "we claim
 * nothing", never "this platform is absent from the product").
 */
const PLATFORM_CAPABILITIES: PlatformCapability[] = [
  ...RAW_PLATFORM_CAPABILITIES.filter((entry) => isMeshPlatform(entry.id)),
  ...MESH_PLATFORMS.filter(
    (allowed) => !RAW_PLATFORM_CAPABILITIES.some((entry) => entry.id === allowed.id),
  ).map((allowed) => manualSource(allowed.id, allowed.name)),
];

const UNSUPPORTED_ACTIONS: Record<PlatformContentAction, PlatformActionCapability> = {
  "cross-post": {
    supported: false,
    reason: CROSS_POST_UNSUPPORTED_REASON,
    reviewRequired: true,
    userInitiatedOnly: true,
  },
  delete: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true },
  edit: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  like: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  unlike: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  share: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  pin: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  unpin: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  visibility: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  reply: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  "delete-comment": { supported: false, reason: COMMENT_DELETE_UNSUPPORTED_REASON, reviewRequired: true },
  follow: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
  unfollow: { supported: false, reason: DEFAULT_UNSUPPORTED_REASON, reviewRequired: true, userInitiatedOnly: true },
};

const supportedAction = (reason: string, requiredScopes: string[]): PlatformActionCapability => ({
  supported: true,
  reason,
  requiredScopes,
  userInitiatedOnly: true,
});

const PLATFORM_ACTION_CAPABILITIES: Record<string, Partial<Record<PlatformContentAction, PlatformActionCapability>>> = {
  reddit: {
    like: supportedAction("Upvotes the post on Reddit through the official API.", ["vote"]),
    unlike: supportedAction("Removes your vote on Reddit through the official API.", ["vote"]),
    reply: supportedAction("Posts your comment to the Reddit thread through the official API.", ["submit"]),
    edit: supportedAction("Edits your Reddit post through the official API.", ["edit"]),
    delete: supportedAction("Deletes your Reddit post through the official API.", ["edit"]),
    "delete-comment": supportedAction("Deletes your Reddit comment through the official API.", ["edit"]),
    follow: supportedAction("Follows the profile on Reddit through the official API.", ["subscribe"]),
    unfollow: supportedAction("Unfollows the profile on Reddit through the official API.", ["subscribe"]),
    "cross-post": supportedAction("Publishes to your Reddit profile through the official API.", ["submit"]),
  },
  youtube: {
    like: supportedAction("Likes the video on YouTube through the official API.", ["https://www.googleapis.com/auth/youtube.force-ssl"]),
    unlike: supportedAction("Removes your rating on YouTube through the official API.", ["https://www.googleapis.com/auth/youtube.force-ssl"]),
    reply: supportedAction("Posts your comment on the YouTube video through the official API.", ["https://www.googleapis.com/auth/youtube.force-ssl"]),
    delete: supportedAction("Deletes your YouTube video through the official API.", ["https://www.googleapis.com/auth/youtube.force-ssl"]),
    "delete-comment": supportedAction("Deletes your YouTube comment through the official API.", ["https://www.googleapis.com/auth/youtube.force-ssl"]),
    follow: supportedAction("Subscribes to the channel on YouTube through the official API.", ["https://www.googleapis.com/auth/youtube.force-ssl"]),
    unfollow: supportedAction("Unsubscribes from the channel on YouTube through the official API.", ["https://www.googleapis.com/auth/youtube.force-ssl"]),
  },
  twitter: {
    like: supportedAction("Likes the post on X through the official API.", ["like.write"]),
    unlike: supportedAction("Removes your like on X through the official API.", ["like.write"]),
    share: supportedAction("Reposts on X through the official API.", ["tweet.write"]),
    reply: supportedAction("Posts your reply on X through the official API.", ["tweet.write"]),
    delete: supportedAction("Deletes your post on X through the official API.", ["tweet.write"]),
    "delete-comment": supportedAction("Deletes your reply on X through the official API.", ["tweet.write"]),
    follow: supportedAction("Follows the account on X through the official API.", ["follows.write"]),
    unfollow: supportedAction("Unfollows the account on X through the official API.", ["follows.write"]),
    "cross-post": supportedAction("Publishes to X through the official API.", ["tweet.write"]),
  },
  github: {
    like: supportedAction("Stars the repository on GitHub through the official API.", ["public_repo"]),
    unlike: supportedAction("Removes your star on GitHub through the official API.", ["public_repo"]),
    follow: supportedAction("Follows the user on GitHub through the official API.", ["user:follow"]),
    unfollow: supportedAction("Unfollows the user on GitHub through the official API.", ["user:follow"]),
  },
  spotify: {
    like: supportedAction("Follows the playlist on Spotify through the official API.", ["playlist-modify-public", "playlist-modify-private"]),
    unlike: supportedAction("Unfollows the playlist on Spotify through the official API.", ["playlist-modify-public", "playlist-modify-private"]),
    follow: supportedAction("Follows the user on Spotify through the official API.", ["user-follow-modify"]),
    unfollow: supportedAction("Unfollows the user on Spotify through the official API.", ["user-follow-modify"]),
  },
};

const CAPABILITY_BY_ID = new Map(PLATFORM_CAPABILITIES.map((capability) => [capability.id, capability]));

/** Every name ever declared, INCLUDING retired platforms. See below. */
const NAME_BY_ID_INCLUDING_RETIRED = new Map(
  RAW_PLATFORM_CAPABILITIES.map((capability) => [capability.id, capability.name]),
);

/** The allow-list's names — what the PRODUCT calls each platform. */
const NAME_BY_ID_OFFERED = new Map(MESH_PLATFORMS.map((p) => [p.id, p.name]));

/**
 * THE ONE PLACE THAT TURNS A PLATFORM ID INTO A NAME A PERSON READS.
 *
 * There were five, and they disagreed. Three local `platformLabel` helpers
 * (MeChat, Search, the external-post page), one badge map (the feed card), and
 * four surfaces that applied a CSS `capitalize` to the raw storage key.
 * Measured against real ids, that produced:
 *
 *     tiktok    -> "Tiktok"   on Settings, Profile, Analytics, Privacy
 *     linkedin  -> "Linkedin"        "
 *     youtube   -> "Youtube"         "
 *     twitter   -> "Twitter"         "        but "X" in MeChat and Search
 *
 * The last line is the real damage: mesh.me called the same platform two
 * different names on two different pages, and one of them contradicted the
 * product's own list, where it is "X". `capitalize` cannot know that TikTok has
 * a capital T in the middle; only a table can.
 *
 * Resolution order, and why:
 *   1. lib/platforms.ts — what the product calls a platform it OFFERS. This
 *      outranks the capability table, which spells the same platform
 *      "X / Twitter" for a documentation audience.
 *   2. the raw capability declarations — retired platforms still have names,
 *      and retiring one does not delete anyone's ConnectedAccount rows.
 *   3. title-case — never the bare id.
 */
export function getDisplayNameForAnyPlatform(platform: string): string {
  const id = normalizePlatformId(platform);
  if (!id) return "";
  const known =
    NAME_BY_ID_OFFERED.get(id) ??
    CAPABILITY_BY_ID.get(id)?.name ??
    NAME_BY_ID_INCLUDING_RETIRED.get(id);
  if (known) return known;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function normalizePlatformId(platform?: string | null) {
  if (!platform) return "";
  const value = platform.toLowerCase().trim();
  if (value === "x") return "twitter";
  return value;
}

export function getPlatformCapability(platform?: string | null) {
  return CAPABILITY_BY_ID.get(normalizePlatformId(platform)) ?? null;
}

/**
 * Whether this platform has a documented consumer export the USER can download
 * and hand to mesh.me — the one route into the six platforms that grant no
 * content API at all.
 *
 * Returns the same shape as the other action capabilities so no caller has to
 * learn a second convention. `supported: false` is the honest default: absence
 * of a flag means nobody has verified an export exists, not that one does.
 */
export function getPlatformPortabilityCapability(platform: string | null | undefined): PlatformActionCapability {
  const capability = getPlatformCapability(platform);
  if (!capability?.portabilityImport) {
    return {
      supported: false,
      reason:
        "Mesh.me has not verified a consumer data export for this source, so there is nothing here to import from a file.",
      reviewRequired: false,
    };
  }
  return {
    supported: true,
    reason: capability.portabilityReason ?? "A user-supplied one-time export, handed over by you rather than fetched by Mesh.me.",
    reviewRequired: false,
  };
}

export function getPlatformActionCapability(
  platform: string | null | undefined,
  action: PlatformContentAction,
): PlatformActionCapability {
  const platformId = normalizePlatformId(platform);
  return PLATFORM_ACTION_CAPABILITIES[platformId]?.[action] ?? UNSUPPORTED_ACTIONS[action];
}


export function canImportFromPlatform(platform: string | null | undefined) {
  return Boolean(getPlatformCapability(platform)?.importContent);
}

export function getPlatformImportCapability(platform: string | null | undefined): PlatformActionCapability {
  const capability = getPlatformCapability(platform);
  if (capability?.importContent) {
    return {
      supported: true,
      reason: "Official read API sync is enabled for this source with the currently granted account scopes.",
    };
  }

  return {
    supported: false,
    reason: "Import is disabled for this source until Mesh.me has official API access, approved scopes, and provider review for the requested data.",
    reviewRequired: true,
  };
}

const PLATFORM_MESSAGING_CAPABILITIES: Record<string, PlatformActionCapability> = {
  twitter: supportedAction("Sends the reply to the X conversation through the official DM API.", ["dm.read", "dm.write"]),
  reddit: supportedAction("Sends the reply as a Reddit private message through the official API.", ["privatemessages"]),
};

export function getPlatformMessagingCapability(platform: string | null | undefined): PlatformActionCapability {
  const platformId = normalizePlatformId(platform);
  return (
    PLATFORM_MESSAGING_CAPABILITIES[platformId] ?? {
      supported: false,
      reason: "This source does not expose an official direct-message API to connected apps, so replies stay in Mesh.me only.",
      reviewRequired: true,
    }
  );
}

export function getPlatformCapabilitiesSnapshot() {
  return {
    defaultReason: DEFAULT_UNSUPPORTED_REASON,
    complianceModel: {
      officialApiOnly: true,
      noScraping: true,
      noCredentialCollection: true,
      writesRequireApprovedScopes: true,
      userInitiatedWritesOnly: true,
      providerReviewRequiredForRestrictedFeatures: true,
    },
    providers: PLATFORM_CAPABILITIES,
    platforms: PLATFORM_ACTION_CAPABILITIES,
    unsupportedActions: UNSUPPORTED_ACTIONS,
  };
}
