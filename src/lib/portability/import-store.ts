// WRITING AN IMPORT WITHOUT EVER DESTROYING ANYTHING.
//
// to-rows decided what identity an imported post has. This decides what happens
// when rows carrying that identity meet a database that may already hold them.
//
// The store is injected rather than imported. That is not ceremony: the `check`
// chain runs before the database is seeded in CI, so a gate that reached for
// Prisma could not run there at all. Injecting it means the behaviour that
// actually matters — what the SECOND import does — is proved against a fake in
// milliseconds, and the real adapter is left with nothing to get wrong beyond
// four one-line queries.
//
// ── THERE IS NO DELETE, AND THAT IS THE POINT ───────────────────────────────
//
// The obvious way to make an import idempotent is to clear what was there and
// write it again. It is also wrong here, and quietly so.
//
// SyncedContent cascades to SyncedInteraction. Once a person has liked,
// commented on or otherwise touched a post that came out of their archive, a
// delete-then-recreate import destroys that and hands back a fresh row that
// looks identical. They would have no way to notice, because the post is still
// there — only everything that happened to it is gone.
//
// So ImportStore has no delete method. Not "we choose not to call it": there
// isn't one, and an implementation cannot offer a shortcut this module might
// later be tempted to take.
//
// ── THE HALF-WRITTEN IMPORT, WHICH IS WORSE THAN A FAILED ONE ───────────────
//
// A post becomes two rows: a ContentSource that carries its identity, and a
// SyncedContent that carries what it says. If an import dies between those two
// writes — a closed tab, a dropped connection, a transaction that rolled back
// only partway — the source survives alone.
//
// Now the post is permanently lost. Not visibly: the unique key says it has
// already been imported, so every later attempt skips it, while no content row
// exists for it to show. The person re-imports, is told it worked, and that post
// never appears again no matter how many times they try.
//
// So an existing source with no content is treated as REPAIRABLE rather than as
// already-done, and repairs are counted separately so the outcome can say
// plainly that something was recovered rather than added.

import { toRows } from "./to-rows";
import type { ParseResult } from "./parse-export";

/** What the store needs to do. Note what is absent: any way to remove a row. */
export type ImportStore = {
  /**
   * Create or find the ContentSource for this identity.
   *
   * `created` must reflect what actually happened in the database, not what the
   * caller expected — it is how this module tells a new post from a known one,
   * and a store that always reports `true` turns every re-import into a
   * duplicate.
   */
  upsertSource(input: {
    userId: string;
    sourceType: string;
    sourceId: string;
    sourceCreatedAt: Date;
  }): Promise<{ id: string; created: boolean }>;

  /** The content row for a source, or null if this import never finished. */
  findContent(contentSourceId: string): Promise<{ id: string } | null>;

  createContent(input: {
    userId: string;
    contentSourceId: string;
    canonicalType: string;
    textContent: string;
    mediaJson: string;
  }): Promise<void>;
};

export type SaveOutcome = {
  /** Posts that were not in the database before. */
  added: number;
  /** Posts already fully present. Nothing was written for these. */
  alreadyPresent: number;
  /**
   * Posts whose identity existed but whose content did not — a previous import
   * that stopped between the two writes. Counted apart from `added` because
   * "we recovered 3 posts a failed import left behind" is a different and more
   * useful sentence than "we added 3 posts".
   */
  repaired: number;
  /** Posts that could not be written, each with a reason. Never silent. */
  failed: { sourceId: string; reason: string }[];
};

/**
 * Write an import.
 *
 * Every post offered is accounted for in exactly one of the four counts, and
 * that is asserted rather than assumed — a post that fell out of the totals is
 * a post nobody would go looking for.
 */
export async function saveImportedPosts(
  store: ImportStore,
  userId: string,
  platform: string,
  posts: ParseResult["posts"],
): Promise<SaveOutcome> {
  const rows = toRows(platform, posts);
  const outcome: SaveOutcome = { added: 0, alreadyPresent: 0, repaired: 0, failed: [] };

  for (const row of rows) {
    try {
      const source = await store.upsertSource({
        userId,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        sourceCreatedAt: row.sourceCreatedAt,
      });

      // A known source is not automatically a finished import. Ask.
      if (!source.created) {
        const existing = await store.findContent(source.id);
        if (existing) {
          outcome.alreadyPresent += 1;
          continue;
        }
      }

      await store.createContent({
        userId,
        contentSourceId: source.id,
        canonicalType: row.canonicalType,
        textContent: row.textContent,
        mediaJson: row.mediaJson,
      });

      if (source.created) outcome.added += 1;
      else outcome.repaired += 1;
    } catch (error) {
      // One post failing costs that post and nothing else. An import that gives
      // up on the first bad row is an import that loses a history to a single
      // malformed entry.
      const reason = error instanceof Error && error.message ? error.message.slice(0, 160) : "This post could not be saved.";
      outcome.failed.push({ sourceId: row.sourceId, reason });
    }
  }

  return outcome;
}
