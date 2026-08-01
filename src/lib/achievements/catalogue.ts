// MILESTONES YOU CAN SEE COMING.
//
// The schema for this has existed for a long time: Achievement with slug, name,
// icon, category, title, threshold, isLimited and maxHolders; UserAchievement
// joining it to a person; User.activeTitle to wear one. A read query has been
// running against it and returning an empty list every single time, because no
// Achievement row has ever been created and no award logic has ever existed.
// `actions.ts` has a section header — "─── Achievement Actions ───" — with four
// blank lines under it.
//
// So the question is not "how do we fill this in" but "what should it be", and
// the honest answer starts with what it must NOT be.
//
// ── WHY THIS IS NOT A SLOT MACHINE ──────────────────────────────────────────
//
// The standard implementation of this feature is a compulsion loop: variable
// rewards, surprise drops, streaks that punish a missed day, and counters that
// go up when you feed the machine. It works, in the sense that it produces
// sessions. It works by making people feel slightly bad on purpose.
//
// Three rules keep this on the other side of that line, and `achievement:check`
// enforces all three:
//
//   1. FIXED, PUBLISHED THRESHOLDS. Every milestone and its exact requirement is
//      visible before you earn it. Nothing is random, nothing is a surprise, and
//      knowing the number is the point — a goal you can see is a goal you can
//      decide not to chase.
//
//   2. NOTHING IS AWARDED FOR OTHER PEOPLE'S ATTENTION. No follower counts, no
//      likes received, no views. Those measure how the crowd treated you, they
//      are largely outside your control, and turning them into a badge teaches
//      people to perform for strangers. Every metric here is something YOU did.
//
//   3. NO STREAKS, NO CONSECUTIVE-DAY REQUIREMENTS, NO SCARCITY. A streak is a
//      punishment for absence wearing a reward's clothes. `isLimited` and
//      `maxHolders` exist in the schema and are deliberately unused: "only the
//      first 500 people can ever have this" is manufactured urgency, and it is
//      the one thing on this list you could not earn by choosing to.
//
// What is left is quieter and, I think, better: a record of things you actually
// did, most of which are about getting your own life into one place. It gives a
// reason to come back that is not a reason to stay.

/** What a milestone counts. Every one is an action the person took themselves. */
type AchievementMetric =
  | "postsWritten"
  | "commentsWritten"
  | "platformsConnected"
  | "peopleFollowed"
  | "communitiesJoined"
  | "roomsShared";
// NO `historyImported` YET. A milestone reading "bring in your own archive" was
// drafted here and removed: there is no upload surface, so the count would be
// permanently zero and the card would be instructing people to do something the
// product cannot do. An unearnable milestone is not an aspiration, it is a
// broken promise with a progress bar. It comes back with the feature.

export type AchievementDefinition = {
  slug: string;
  name: string;
  /** Says exactly what to do. A milestone you cannot read is not a milestone. */
  description: string;
  icon: string;
  category: "beginning" | "gathering" | "together" | "making";
  /** Wearable next to your name, if you choose. Optional on purpose. */
  title?: string;
  metric: AchievementMetric;
  /** Fixed. Published. Never randomised, never personalised, never moved. */
  threshold: number;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ── BEGINNING — the first time you do each thing. Threshold 1, honestly. ──
  {
    slug: "first-post",
    name: "Said something",
    description: "Write your first post on Mesh.me.",
    icon: "pencil",
    category: "beginning",
    metric: "postsWritten",
    threshold: 1,
  },
  {
    slug: "first-comment",
    name: "Joined in",
    description: "Reply to someone for the first time.",
    icon: "message-circle",
    category: "beginning",
    metric: "commentsWritten",
    threshold: 1,
  },
  {
    slug: "first-connection",
    name: "Brought one over",
    description: "Connect your first account from another platform.",
    icon: "link",
    category: "beginning",
    metric: "platformsConnected",
    threshold: 1,
  },

  // ── GATHERING — the actual product: your life, in one place. ─────────────
  {
    slug: "three-platforms",
    name: "Three in one",
    description: "Connect three platforms to your one account.",
    icon: "layers",
    category: "gathering",
    metric: "platformsConnected",
    threshold: 3,
  },
  {
    slug: "six-platforms",
    name: "Most of it",
    description: "Connect six platforms. That is half the roster in one place.",
    icon: "boxes",
    category: "gathering",
    title: "Meshed",
    metric: "platformsConnected",
    threshold: 6,
  },
  // ── TOGETHER — two people, not an audience. ──────────────────────────────
  {
    slug: "first-room",
    name: "Watched together",
    description: "Share a room with someone and go through something side by side.",
    icon: "users",
    category: "together",
    metric: "roomsShared",
    threshold: 1,
  },
  {
    slug: "ten-rooms",
    name: "A standing invitation",
    description: "Share ten rooms. Somebody looks forward to these.",
    icon: "user-round-check",
    category: "together",
    title: "Good company",
    metric: "roomsShared",
    threshold: 10,
  },
  {
    slug: "five-follows",
    name: "Found your people",
    description: "Follow five people here.",
    icon: "user-plus",
    category: "together",
    metric: "peopleFollowed",
    threshold: 5,
  },
  {
    slug: "first-community",
    name: "Pulled up a chair",
    description: "Join your first community.",
    icon: "tent",
    category: "together",
    metric: "communitiesJoined",
    threshold: 1,
  },

  // ── MAKING — volume, but at humane numbers and never for applause. ───────
  {
    slug: "twenty-five-posts",
    name: "A body of work",
    description: "Write twenty-five posts.",
    icon: "notebook-pen",
    category: "making",
    metric: "postsWritten",
    threshold: 25,
  },
  {
    slug: "hundred-comments",
    name: "Actually present",
    description: "Leave a hundred replies. Most of being somewhere is showing up in other people's threads.",
    icon: "messages-square",
    category: "making",
    title: "Present",
    metric: "commentsWritten",
    threshold: 100,
  },
];

/** What a person has done, measured. The only input to earning anything. */
export type AchievementCounts = Record<AchievementMetric, number>;

/**
 * Which milestones these counts have earned. Pure, total, and deterministic:
 * the same counts always produce the same list, which is what "fixed threshold"
 * means in practice and what makes it testable.
 */
export function earnedSlugs(counts: AchievementCounts): string[] {
  return ACHIEVEMENTS.filter((a) => (counts[a.metric] ?? 0) >= a.threshold).map((a) => a.slug);
}

/**
 * Progress toward everything, earned or not — because the unearned ones are
 * half the point. A list that only shows what you already have tells you
 * nothing about what is worth doing next.
 */
export function achievementProgress(counts: AchievementCounts) {
  return ACHIEVEMENTS.map((a) => {
    const have = counts[a.metric] ?? 0;
    return {
      definition: a,
      have: Math.min(have, a.threshold),
      earned: have >= a.threshold,
    };
  });
}
