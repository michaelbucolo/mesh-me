// MEASURING WHAT SOMEBODY ACTUALLY DID, AND WRITING DOWN THE ONES THEY PASSED.
//
// The catalogue decides what counts as a milestone; this measures the counts and
// records the crossings. Two properties matter more than anything else here:
//
//   IDEMPOTENT. Running this twice awards nothing twice, and the guarantee is
//   the @@unique([userId, achievementId]) constraint rather than the read that
//   precedes the write — two requests racing through a read-then-write both see
//   "not yet awarded" and both insert.
//
//   NEVER REVOKES. Counts can go down — you can delete a post, disconnect a
//   platform, leave a community. A milestone records that you DID the thing,
//   not that you are still doing it, so nothing here ever deletes a
//   UserAchievement row. Taking a badge away because someone tidied up would be
//   a punishment for using the product's own delete button.
//
// The Achievement rows themselves are upserted from the catalogue rather than
// seeded, because a seed script does not run against production on deploy and a
// milestone whose row does not exist is a milestone nobody can ever be given.
// The catalogue in code is the source of truth; the table is the join target.

import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS, achievementProgress, earnedSlugs, type AchievementCounts } from "./catalogue";

/** Count everything the catalogue can measure, for one person. */
export async function measureAchievementCounts(userId: string): Promise<AchievementCounts> {
  const [postsWritten, commentsWritten, platformsConnected, peopleFollowed, communitiesJoined, roomsShared] =
    await Promise.all([
      prisma.post.count({ where: { authorId: userId } }),
      prisma.comment.count({ where: { authorId: userId } }),
      // Distinct PLATFORMS, not accounts: connecting three X accounts is one
      // platform in one place, and counting it as three would reward busywork.
      prisma.connectedAccount
        .findMany({ where: { userId, isActive: true }, select: { platform: true }, distinct: ["platform"] })
        .then((rows) => rows.length),
      prisma.follow.count({ where: { followerId: userId } }),
      prisma.communityMember.count({ where: { userId } }),
      prisma.meChatSessionParticipant.count({ where: { userId } }),
    ]);

  return { postsWritten, commentsWritten, platformsConnected, peopleFollowed, communitiesJoined, roomsShared };
}

/**
 * Award every milestone these counts have earned and not yet been given.
 * Returns the slugs newly awarded — empty on the overwhelming majority of calls,
 * which is why the caller must treat this as fire-and-forget and never block a
 * user action on it.
 */
export async function awardAchievements(userId: string): Promise<string[]> {
  const counts = await measureAchievementCounts(userId);
  const earned = earnedSlugs(counts);
  if (earned.length === 0) return [];

  // Definitions first: the join target has to exist before anyone can be joined
  // to it. Upsert rather than create so this is safe to run forever, and so an
  // edited name or description in the catalogue reaches the database without a
  // migration.
  const definitions = ACHIEVEMENTS.filter((a) => earned.includes(a.slug));
  await Promise.all(
    definitions.map((a) =>
      prisma.achievement.upsert({
        where: { slug: a.slug },
        update: { name: a.name, description: a.description, icon: a.icon, category: a.category, title: a.title ?? null, threshold: a.threshold },
        create: {
          slug: a.slug,
          name: a.name,
          description: a.description,
          icon: a.icon,
          category: a.category,
          title: a.title ?? null,
          threshold: a.threshold,
        },
      }),
    ),
  );

  const rows = await prisma.achievement.findMany({
    where: { slug: { in: earned } },
    select: { id: true, slug: true },
  });
  const already = await prisma.userAchievement.findMany({
    where: { userId, achievementId: { in: rows.map((r) => r.id) } },
    select: { achievementId: true },
  });
  const has = new Set(already.map((a) => a.achievementId));
  const fresh = rows.filter((r) => !has.has(r.id));
  if (fresh.length === 0) return [];

  // Upsert per row rather than createMany, and NOT because it reads nicer:
  // `skipDuplicates` is unavailable on SQLite/libSQL, which is what this app
  // runs on, so the compound unique key has to do the deduplicating itself.
  // The read above is an optimisation, not the safety property — two requests
  // racing would both see "not awarded" and both try to insert, and
  // @@unique([userId, achievementId]) is the thing that actually decides.
  await Promise.all(
    fresh.map((r) =>
      prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: r.id } },
        update: {},
        create: { userId, achievementId: r.id },
      }),
    ),
  );

  return fresh.map((r) => r.slug);
}

export type AchievementView = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  title: string | null;
  threshold: number;
  have: number;
  earned: boolean;
  unlockedAt: string | null;
};

/**
 * Everything, earned and not, with real progress against each. The unearned
 * entries are half the value: a list showing only what you already have cannot
 * tell you what is worth doing next, and hiding the requirements would turn a
 * published threshold back into a surprise.
 */
export async function getAchievementBoard(userId: string): Promise<AchievementView[]> {
  const [counts, unlocked] = await Promise.all([
    measureAchievementCounts(userId),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { unlockedAt: true, achievement: { select: { slug: true } } },
    }),
  ]);

  const unlockedAt = new Map(unlocked.map((u) => [u.achievement.slug, u.unlockedAt]));

  return achievementProgress(counts).map(({ definition, have, earned }) => ({
    slug: definition.slug,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    category: definition.category,
    title: definition.title ?? null,
    threshold: definition.threshold,
    have,
    earned,
    // Awarding is fire-and-forget, so a milestone can be earned by the counts
    // before its row exists. Showing it as earned with no date is truthful;
    // showing it as unearned because the write has not landed would not be.
    unlockedAt: unlockedAt.get(definition.slug)?.toISOString() ?? null,
  }));
}
