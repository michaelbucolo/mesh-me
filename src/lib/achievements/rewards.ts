/** Earned cosmetics are records of milestones, never purchased receipts.
 * Existing purchased pieces keep their original ownership and refund rules. */
export const ACHIEVEMENT_MESHI_REWARDS = [
  { slug: "first-post", badge: "first-light", label: "First light badge" },
  { slug: "first-community", badge: "kindred", label: "Kindred badge" },
  { slug: "twenty-five-posts", badge: "maker", label: "Maker badge" },
] as const;

export function achievementRewardForBadge(value: string | null | undefined) {
  return ACHIEVEMENT_MESHI_REWARDS.find((reward) => reward.badge === value);
}

export function getAchievementRewardBadges(slugs: Iterable<string>): string[] {
  const earned = new Set(slugs);
  return ACHIEVEMENT_MESHI_REWARDS.filter((reward) => earned.has(reward.slug)).map((reward) => reward.badge);
}
