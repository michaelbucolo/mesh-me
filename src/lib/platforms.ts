/**
 * THE PLATFORMS MESH.ME IS FOR. ONE LIST.
 *
 * Until now there were two: `PLATFORM_CAPABILITIES` in platform-capabilities.ts
 * (17 entries) and `CATEGORY_BY_PLATFORM` in platform-adapters.ts (36). They
 * disagreed, and which one a surface happened to read decided what a user saw.
 * That is the failure this codebase keeps producing — two places state one
 * fact, and only one of them is ever taught the rule.
 *
 * This is the fact. Both of those read from here now, and a gate
 * (scripts/platform-allowlist-check.ts) fails the build if anything offers a
 * platform that is not on it.
 *
 * ── WHY THESE AND NOT OTHERS ────────────────────────────────────────────────
 *
 * This is a product decision, not a technical one. mesh.me is for the places
 * people actually live: the big social and music networks, and the messengers
 * they talk in. Everything else — GitHub, Reddit, LinkedIn, Pinterest, Tumblr,
 * Behance, Dribbble, Medium, Substack, dev.to, SoundCloud, Patreon, Vimeo,
 * Bluesky, Mastodon, TikTok — is gone. A connect page listing thirty logos is
 * not more useful than one listing the nine that matter; it is a longer page.
 *
 * ── THE COST, STATED PLAINLY ────────────────────────────────────────────────
 *
 * Bluesky and Mastodon were the ONLY public-supply lanes that ran without
 * credentials. Removing them means the Flow has no supply at all until
 * YOUTUBE_API_KEY (or TWITCH_CLIENT_ID/SECRET) is configured, because every
 * other platform on this list either has no public content API for a
 * third-party reader (Instagram, Snapchat, Threads) or charges per read (X).
 *
 * That is a real regression in what a signed-in user sees, and it is the direct
 * consequence of the list. It is written here rather than discovered later.
 */

type MeshPlatformCategory = "social" | "video" | "music" | "messaging";

export type MeshPlatform = {
  id: string;
  name: string;
  category: MeshPlatformCategory;
};

/**
 * The nine content platforms, and every major messenger.
 *
 * `id` is the storage key and must not change casually: ConnectedAccount.platform,
 * PlatformPost.platform and PublicPost.platform all hold it, so renaming one
 * orphans real rows.
 */
export const MESH_PLATFORMS: MeshPlatform[] = [
  // ── The nine ──
  { id: "instagram", name: "Instagram", category: "social" },
  { id: "snapchat", name: "Snapchat", category: "social" },
  { id: "threads", name: "Threads", category: "social" },
  // Stored as "twitter" because that is what every existing row says. The
  // NAME is X, which is the only part a person reads.
  { id: "twitter", name: "X", category: "social" },
  { id: "youtube", name: "YouTube", category: "video" },
  { id: "twitch", name: "Twitch", category: "video" },
  { id: "kick", name: "Kick", category: "video" },
  { id: "applemusic", name: "Apple Music", category: "music" },
  { id: "spotify", name: "Spotify", category: "music" },

  // ── Every major messenger ──
  { id: "whatsapp", name: "WhatsApp", category: "messaging" },
  { id: "messenger", name: "Messenger", category: "messaging" },
  { id: "telegram", name: "Telegram", category: "messaging" },
  { id: "signal", name: "Signal", category: "messaging" },
  { id: "discord", name: "Discord", category: "messaging" },
  { id: "wechat", name: "WeChat", category: "messaging" },
  { id: "line", name: "LINE", category: "messaging" },
  { id: "viber", name: "Viber", category: "messaging" },
  { id: "kakao", name: "KakaoTalk", category: "messaging" },
];

const BY_ID = new Map(MESH_PLATFORMS.map((p) => [p.id, p]));

/** Every id mesh.me will accept, for gates and validation. */
export const MESH_PLATFORM_IDS: string[] = MESH_PLATFORMS.map((p) => p.id);

export function isMeshPlatform(platform: string | null | undefined): boolean {
  return typeof platform === "string" && BY_ID.has(platform.trim().toLowerCase());
}




