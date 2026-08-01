"use server";

// THE ONE PUBLIC PART, AND THE ONLY PLACE THAT DECIDES WHETHER YOU EARNED IT.
//
// The milestones board is private. A title is not: it renders next to your name
// for anyone who can see your profile. So the client's belief about what it
// earned is not the deciding opinion — this re-derives the earned set from the
// database and refuses anything that is not in it. A client that sends
// "Meshed" without having connected six platforms gets a refusal, not a title.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS, earnedSlugs } from "./catalogue";
import { awardAchievements, measureAchievementCounts } from "./award";

/**
 * Record any milestone the counts have passed. Called when the board is opened,
 * because that is the moment a person would look — and because writing during a
 * server component's render to award a badge nobody is looking at is a worse
 * trade than a single action on mount.
 *
 * The display does not depend on this having run: getAchievementBoard derives
 * `earned` from live counts, so a milestone shows as reached the instant it is
 * true. This only records WHEN, which is why it can fail quietly.
 */
export async function recordAchievements() {
  const user = await getCurrentUser();
  if (!user) return { awarded: [] as string[] };
  try {
    return { awarded: await awardAchievements(user.id) };
  } catch {
    return { awarded: [] as string[] };
  }
}

export async function setActiveTitle(title: string | null) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  // Taking a title off never needs proof of anything.
  if (title === null) {
    await prisma.user.update({ where: { id: user.id }, data: { activeTitle: null } });
    revalidatePath(`/profile/${user.username}`);
    return { success: true as const };
  }

  if (typeof title !== "string" || title.length > 40) {
    return { error: "That is not a title." };
  }

  const counts = await measureAchievementCounts(user.id);
  const earned = new Set(earnedSlugs(counts));
  const allowed = ACHIEVEMENTS.some((a) => a.title === title && earned.has(a.slug));
  if (!allowed) {
    // Deliberately not "you have not earned this yet" with a progress hint —
    // this path is only reachable by a client sending something the board did
    // not offer, so the useful audience for a detailed message is not a person.
    return { error: "You have not reached that milestone." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { activeTitle: title } });
  revalidatePath(`/profile/${user.username}`);
  return { success: true as const };
}
