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
 * This is a product decision, not a technical one, and the current decision is
 * the owner's, verbatim: "only have the most popular social media apps in the
 * US. I don't need a bunch of random bullshit accounts connected to mesh.me."
 * So the list is the twelve social platforms Americans actually use. The
 * previous brief ("the nine content platforms plus every major messenger") is
 * retired: Spotify, Apple Music and Kick were not social networks, and
 * WhatsApp/WeChat/LINE/Viber/KakaoTalk earned their seats on global reach, not
 * US reach. GitHub, SoundCloud, Patreon, Dribbble and the rest stay gone.
 *
 * ── THE COST, STATED PLAINLY ────────────────────────────────────────────────
 *
 * Retiring a platform never deletes rows — ConnectedAccount/PlatformPost/
 * PublicPost rows for a retired id simply stop being offered for connection.
 * The Flow's public supply still runs on YouTube and Twitch only, and still
 * needs YOUTUBE_API_KEY or TWITCH_CLIENT_ID/SECRET configured; nothing on this
 * list has a credential-free public content API.
 */

type MeshPlatformCategory = "social" | "video" | "messaging";

export type MeshPlatform = {
  id: string;
  name: string;
  category: MeshPlatformCategory;
};

/**
 * The twelve most popular social platforms in the US.
 *
 * `id` is the storage key and must not change casually: ConnectedAccount.platform,
 * PlatformPost.platform and PublicPost.platform all hold it, so renaming one
 * orphans real rows.
 */
export const MESH_PLATFORMS: MeshPlatform[] = [
  { id: "instagram", name: "Instagram", category: "social" },
  { id: "facebook", name: "Facebook", category: "social" },
  // Stored as "twitter" because that is what every existing row says. The
  // NAME is X, which is the only part a person reads.
  { id: "twitter", name: "X", category: "social" },
  { id: "threads", name: "Threads", category: "social" },
  { id: "snapchat", name: "Snapchat", category: "social" },
  { id: "reddit", name: "Reddit", category: "social" },
  { id: "linkedin", name: "LinkedIn", category: "social" },
  { id: "pinterest", name: "Pinterest", category: "social" },
  { id: "tiktok", name: "TikTok", category: "video" },
  { id: "youtube", name: "YouTube", category: "video" },
  { id: "twitch", name: "Twitch", category: "video" },
  { id: "discord", name: "Discord", category: "messaging" },
];

const BY_ID = new Map(MESH_PLATFORMS.map((p) => [p.id, p]));

/** Every id mesh.me will accept, for gates and validation. */
export const MESH_PLATFORM_IDS: string[] = MESH_PLATFORMS.map((p) => p.id);

export function isMeshPlatform(platform: string | null | undefined): boolean {
  return typeof platform === "string" && BY_ID.has(platform.trim().toLowerCase());
}
