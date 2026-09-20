import "server-only";

import { hasMeshiConsent } from "./consent";
import { getFeedPostById, type FeedCurrentUser } from "./feed-data";
import { readMeshiMeshContext } from "./meshi-context";
import { prisma } from "./prisma";
import type { MeshiContext, MeshiHistoryMessage } from "./meshi-shared";

const PAGES = new Set(["mesh", "feed", "flow", "explore", "profile", "messages", "settings", "communities", "search", "notifications", "meshpro"]);

function pageCategory(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 512) return undefined;
  const page = value.split(/[/?#]/)[1];
  return PAGES.has(page) ? `/${page}` : undefined;
}

/** Prior assistant replies can quote people who have since withdrawn consent.
 * Only bounded user-authored turns survive; they remain untrusted input. */
export function normalizeMeshiHistory(value: unknown): MeshiHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((item) => {
    if (!item || typeof item !== "object" || item.role !== "user" || typeof item.content !== "string") return [];
    return [{ role: "user" as const, content: item.content.slice(0, 2000) }];
  });
}

/** The browser supplies only a location hint and an item identifier. Every
 * fact sent upstream is resolved again with current consent and visibility. */
export async function buildMeshiChatContext(user: FeedCurrentUser, value: unknown): Promise<MeshiContext> {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const context: MeshiContext = { currentPage: pageCategory(input.currentPage) };
  if (!(await hasMeshiConsent(user.id))) return context;

  const mesh = await readMeshiMeshContext(user);
  if (mesh.access !== "allowed") return context;
  context.meshData = mesh.stats;
  context.meshEntities = mesh.entities.slice(0, 40).map((entity) => ({
    id: entity.id,
    type: entity.type,
    label: entity.label.slice(0, 100),
    sublabel: entity.sublabel?.slice(0, 160),
    isMutual: entity.isMutual,
    followerCount: entity.followerCount,
    memberCount: entity.memberCount,
  }));

  const focused = input.focusedContent;
  const id = focused && typeof focused === "object" ? (focused as Record<string, unknown>).id : undefined;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return context;
  const post = await getFeedPostById(user, id);
  if (!post) return context;

  // Shared imported posts also belong to a Mesh member. A spoofed platform
  // label cannot turn their content into an external, consent-free record.
  if (!post.externalAuthor && post.author.id !== user.id) {
    if (!(await hasMeshiConsent(post.author.id))) return context;
    const blocked = await prisma.block.findFirst({
      where: { OR: [{ blockerId: user.id, blockedId: post.author.id }, { blockerId: post.author.id, blockedId: user.id }] },
      select: { id: true },
    });
    if (blocked) return context;
  }

  context.focusedContent = {
    id: post.id,
    platform: post.platform || "meshme",
    author: (post.externalAuthor?.username || post.author.username).slice(0, 100),
    text: post.content.slice(0, 900),
    mediaTypes: [...new Set(post.media.map((media) => media.type))].slice(0, 8),
    contentRating: post.contentRating || "general",
    // URLs, pixels and heuristic cues from client DOM are not authoritative.
    // No remote URL is fetched and no client-supplied media claim is forwarded.
  };
  return context;
}
