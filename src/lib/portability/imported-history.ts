// THE FOUR QUERIES BEHIND ImportStore, AND THE ONE THAT READS THEM BACK.
//
// import-store.ts holds the decisions and is gated against a fake. This holds
// the SQL, and it is deliberately thin: everything that could be reasoned about
// was reasoned about there, so what is left here should be boring enough that
// reading it is enough.
//
// It is not covered by that gate, and pretending otherwise would be the
// dangerous move. The `check` chain runs before the database is seeded in CI, so
// nothing here can be exercised there. What follows is the part a reviewer has
// to actually look at.
//
// ── THE ONE THING THIS FILE CAN GET WRONG ───────────────────────────────────
//
// `created`. It is how saveImportedPosts tells a new post from one already
// imported, and an adapter that always reports `true` turns every re-import into
// a duplicate — the exact failure the whole identity design exists to prevent,
// reintroduced at the last step.
//
// Prisma's `upsert` does not say whether it inserted or updated, so asking it
// would mean guessing. Instead: look first, and create only if nothing was
// found. The unique key is still what guarantees correctness under a race — two
// concurrent imports of the same archive can both see nothing, and the second
// create then fails on the constraint rather than writing a duplicate. That
// failure is caught by saveImportedPosts and reported against that one post,
// which is the right outcome: the row exists, and it was not written twice.

import "server-only";
import { prisma } from "@/lib/prisma";
import type { ImportStore } from "./import-store";

/** The real store. Four queries, no decisions. */
export const prismaImportStore: ImportStore = {
  async upsertSource(input) {
    const existing = await prisma.contentSource.findUnique({
      where: {
        userId_sourceType_sourceId: {
          userId: input.userId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    const created = await prisma.contentSource.create({
      data: {
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceCreatedAt: input.sourceCreatedAt,
        ingestState: "active",
      },
      select: { id: true },
    });
    return { id: created.id, created: true };
  },

  async findContent(contentSourceId) {
    return prisma.syncedContent.findFirst({
      where: { contentSourceId },
      select: { id: true },
    });
  },

  async createContent(input) {
    await prisma.syncedContent.create({
      data: {
        userId: input.userId,
        contentSourceId: input.contentSourceId,
        canonicalType: input.canonicalType,
        textContent: input.textContent,
        mediaJson: input.mediaJson,
        // The person's own history from another platform. Not something we
        // fetched on their behalf, which is what "external" means elsewhere.
        ownership: "owned",
        syncStatus: "synced",
      },
    });
  },
};

/** One post as it comes back out. */
type ImportedPostRow = {
  id: string;
  platform: string;
  canonicalType: string;
  textContent: string;
  mediaPaths: string[];
  postedAt: Date | null;
};

export type ImportedHistory = {
  posts: ImportedPostRow[];
  /** Total held, which may exceed what was returned. */
  total: number;
  /** Platforms this history was imported from, for a caption that names them. */
  platforms: string[];
};

/**
 * Read back what was imported.
 *
 * Nothing read SyncedContent before this — the models existed with no writer and
 * no reader. An ingest that lands without one is an ingest nobody can verify
 * worked, so this ships alongside the writer rather than after it.
 */
export async function getImportedHistory(userId: string, limit = 60): Promise<ImportedHistory> {
  const [rows, total] = await Promise.all([
    prisma.syncedContent.findMany({
      where: { userId, contentSource: { sourceType: { startsWith: "archive:" } } },
      include: { contentSource: { select: { sourceType: true, sourceCreatedAt: true } } },
      orderBy: { contentSource: { sourceCreatedAt: "desc" } },
      take: Math.min(Math.max(limit, 1), 200),
    }),
    prisma.syncedContent.count({
      where: { userId, contentSource: { sourceType: { startsWith: "archive:" } } },
    }),
  ]);

  const posts: ImportedPostRow[] = rows.map((row) => ({
    id: row.id,
    platform: row.contentSource.sourceType.replace(/^archive:/, ""),
    canonicalType: row.canonicalType,
    textContent: row.textContent ?? "",
    // Stored by us as JSON, but a malformed row must not take the page down —
    // showing a post with no media beats showing nothing at all.
    mediaPaths: safeMediaPaths(row.mediaJson),
    postedAt: row.contentSource.sourceCreatedAt,
  }));

  return {
    posts,
    total,
    platforms: Array.from(new Set(posts.map((p) => p.platform))).sort(),
  };
}

function safeMediaPaths(mediaJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(mediaJson);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
