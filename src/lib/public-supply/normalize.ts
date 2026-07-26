import type { FeedCardPost } from "@/lib/feed-data";
import type { PublicSupplyRow } from "./store";

/**
 * ONE PLACE WHERE PUBLIC SUPPLY BECOMES A MESH.ME CARD.
 *
 * Lanes speak in their platform's vocabulary. Everything downstream — ranking,
 * dedup, the Flow's shorts-only rule, muting, the card itself — speaks
 * FeedCardPost. This is the single translation, so a new platform lands looking
 * exactly like the existing ones and cannot invent its own shape.
 *
 * ── THE ID PREFIX IS LORE-BEARING ───────────────────────────────────────────
 *
 * `public-<cuid>`. The existing prefixes are `feeditem-` (a connected
 * account's for-you items) and bare ids (native posts), and the permalink
 * resolver in feed-data keys off them. A distinct prefix means a public item
 * can never be mistaken for something a mesh.me user posted, and an interaction
 * attempt resolves to "this lives on YouTube" rather than a 404.
 *
 * ── AUTHORSHIP IS NOT LAUNDERED ─────────────────────────────────────────────
 *
 * `author` is synthesised only because FeedCardPost requires one; the truth is
 * in `externalAuthor`, which the card renders and links to. A public item is
 * never attributed to a mesh.me account, never given a mesh profile link, and
 * always carries `externalUrl` back to the original. mesh.me is showing you
 * someone else's work and saying so.
 */

/** The prefix that marks a card as platform-owned. */
const PUBLIC_POST_ID_PREFIX = "public-";



function toFeedCardPost(row: PublicSupplyRow): FeedCardPost {
  const authorName = row.authorName || row.authorUsername || row.platform;
  const handle = row.authorUsername || authorName;

  // Title and body are separate fields on most platforms and one field on a
  // card. Joined only when both exist and differ, so a video whose description
  // repeats its title does not render the same sentence twice.
  const body = row.content?.trim() ?? "";
  const title = row.title?.trim() ?? "";
  const content = title && body && !body.startsWith(title) ? `${title}\n\n${body}` : title || body || `${row.platform} post`;

  const media: FeedCardPost["media"] = [];
  if (row.mediaUrl) {
    media.push({
      id: `${row.id}-media`,
      url: row.mediaUrl,
      type: row.postType === "image" ? "image" : "video",
      ...(row.thumbnailUrl ? { posterUrl: row.thumbnailUrl } : {}),
    });
  } else if (row.thumbnailUrl) {
    // No playable file, but a real thumbnail. The card renders the still and
    // the link out — better than a blank tile, and honest about what it is.
    media.push({ id: `${row.id}-thumb`, url: row.thumbnailUrl, type: "image" });
  }

  return {
    id: `${PUBLIC_POST_ID_PREFIX}${row.id}`,
    content,
    createdAt: row.publishedAt ?? row.fetchedAt,
    author: {
      // Not a mesh.me id. Prefixed so nothing can join it to a real user row.
      id: `external-${row.platform}-${row.platformPostId}`,
      username: handle,
      displayName: authorName,
      avatarUrl: row.authorAvatarUrl,
      isVerified: false,
    },
    community: null,
    media,
    tags: [],
    _count: { comments: row.commentCount, reactions: row.likeCount, reposts: 0 },
    reactions: [],
    platform: row.platform,
    // Deliberately NOT `sourceId`: that names a PlatformPost row, and the mute
    // resolver looks account mutes up by it. A public item has no connected
    // account to mute, so leaving it unset keeps that query correct.
    externalUrl: row.url,
    platformPostId: row.platformPostId,
    externalAuthor: {
      name: authorName,
      username: row.authorUsername,
      avatarUrl: row.authorAvatarUrl,
      profileUrl: row.authorUrl,
    },
    isNsfw: row.isNsfw,
    contentRating: row.contentRating,
    visibility: "public",
    // The Flow is shorts-only and EXCLUDES what it cannot classify. Carrying
    // the real duration through is what lets a genuine short play here at all.
    durationSeconds: row.durationSeconds,
    postType: row.postType,
    // `row.lang` is deliberately NOT forwarded. Ranking derives language with
    // guessLanguage(post.content) (flow-ranking.ts), so a `lang` field on the
    // card would be read by nothing — a dead property that looks load-bearing.
    // The column is still populated: a language the platform actually declares
    // beats a guess from a caption, and swapping the ranker onto it is a real
    // improvement that should be made deliberately, not smuggled in here.
  };
}

export function toFeedCardPosts(rows: PublicSupplyRow[]): FeedCardPost[] {
  return rows.map(toFeedCardPost);
}
