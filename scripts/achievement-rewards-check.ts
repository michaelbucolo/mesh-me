import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ACHIEVEMENT_MESHI_REWARDS, getAchievementRewardBadges } from "../src/lib/achievements/rewards";
import { ACHIEVEMENTS } from "../src/lib/achievements/catalogue";
import { buildOwnedMeshiSets, DEFAULT_MESHI_PREFERENCE, isGiftableMeshiItem, MESHI_OPTION_VALUES, resolveRecipeApplication } from "../src/lib/meshi-wardrobe";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "mesh-achievement-rewards-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.VERCEL_ENV = "preview";
  execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/prisma");
  const { awardAchievements, getAchievementBoard, getEarnedAchievementBadges } = await import("../src/lib/achievements/award");
  let checks = 0;
  const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks++; };
  try {
    const [owner, other] = await Promise.all(["owner", "other"].map((name) => prisma.user.create({ data: {
      username: `reward_${name}`, displayName: name, email: `reward-${name}@example.invalid`, passwordHash: "isolated-no-login",
    } })));
    check(await awardAchievements(owner.id), [], "No activity awards nothing");
    check(await getEarnedAchievementBadges(owner.id), [], "New account has no earned cosmetics");
    check(getAchievementRewardBadges(["invented", "FIRST-POST", "first-post "]), [], "Unknown or forged slugs confer nothing");
    check(getAchievementRewardBadges(["first-post", "first-post"]), ["first-light"], "One recorded achievement yields one entitlement");

    const receipt = await prisma.ownedMeshiItem.create({ data: {
      ownerId: owner.id, purchaserId: owner.id, category: "hats", value: "wizard", stripeSessionId: "cs_test_isolated_reward_fixture",
    } });
    await prisma.meshiPreference.create({ data: { userId: owner.id, hatStyle: "wizard", badgeStyle: "none" } });
    const post = await prisma.post.create({ data: { authorId: owner.id, content: "Local reward fixture" } });
    const community = await prisma.community.create({ data: { name: "Isolated reward community", slug: "isolated-reward-community" } });
    await prisma.communityMember.create({ data: { userId: owner.id, communityId: community.id } });
    await Promise.all([awardAchievements(owner.id), awardAchievements(owner.id)]);
    const firstRows = await prisma.userAchievement.findMany({ where: { userId: owner.id }, orderBy: { achievementId: "asc" } });
    check(firstRows.length, 2, "Concurrent saves record exactly the two earned milestones");
    check(await getEarnedAchievementBadges(owner.id), ["first-light", "kindred"], "Real post and community membership unlock their badges");
    check(await getEarnedAchievementBadges(other.id), [], "Another user's work grants no entitlement");
    check(await awardAchievements(owner.id), [], "A repeated award call reports no newly awarded milestones");
    check(await prisma.userAchievement.findMany({ where: { userId: owner.id }, orderBy: { achievementId: "asc" } }), firstRows, "Retries do not duplicate awards or reset earned dates");
    check(await prisma.ownedMeshiItem.findUnique({ where: { id: receipt.id } }), receipt, "Achievement recording preserves purchased receipts exactly");
    check((await prisma.meshiPreference.findUniqueOrThrow({ where: { userId: owner.id } })).badgeStyle, "none", "Rewards never auto-equip or replace the user's look");

    await prisma.post.delete({ where: { id: post.id } });
    await prisma.communityMember.deleteMany({ where: { userId: owner.id } });
    await awardAchievements(owner.id);
    check(await getEarnedAchievementBadges(owner.id), ["first-light", "kindred"], "Deleting a post or leaving a community never revokes earned cosmetics");
    const board = await getAchievementBoard(owner.id);
    for (const slug of ["first-post", "first-community"]) {
      const milestone = board.find((row) => row.slug === slug)!;
      check([milestone.earned, milestone.have, Boolean(milestone.unlockedAt), Boolean(milestone.reward)], [true, milestone.threshold, true, true], `Recorded ${slug} stays reached after counts fall`);
    }
    check(board.find((row) => row.slug === "twenty-five-posts")?.earned, false, "Unearned progress remains real");
    await prisma.post.createMany({ data: Array.from({ length: 24 }, (_, index) => ({ authorId: other.id, content: `Isolated threshold ${index}` })) });
    await awardAchievements(other.id);
    check(await getEarnedAchievementBadges(other.id), ["first-light"], "24 posts cannot unlock the 25-post reward");
    await prisma.post.create({ data: { authorId: other.id, content: "Isolated threshold 25" } });
    await awardAchievements(other.id);
    check(await getEarnedAchievementBadges(other.id), ["first-light", "maker"], "Exactly 25 posts unlock Maker");

    for (const reward of ACHIEVEMENT_MESHI_REWARDS) {
      check(ACHIEVEMENTS.some((achievement) => achievement.slug === reward.slug), true, `${reward.badge} has a real published requirement`);
      check(MESHI_OPTION_VALUES.badges.has(reward.badge), true, `${reward.badge} is canonical wardrobe vocabulary`);
      check(isGiftableMeshiItem("badges", reward.badge), false, `${reward.badge} cannot be bought or gifted`);
      const recipe = { ...DEFAULT_MESHI_PREFERENCE, badgeStyle: reward.badge };
      for (const isPro of [false, true]) {
        const ents = { isPro, hasCharterSeat: true, hasPatronRecord: true };
        check(resolveRecipeApplication(recipe, DEFAULT_MESHI_PREFERENCE, {}, ents).next.badgeStyle, "none", `Pro=${isPro} and other status records cannot bypass ${reward.badge}`);
        const owned = buildOwnedMeshiSets([{ category: "badges", value: reward.badge }]);
        check(resolveRecipeApplication(recipe, DEFAULT_MESHI_PREFERENCE, owned, ents).next.badgeStyle, reward.badge, `Recorded ${reward.badge} can be reapplied with Pro=${isPro}`);
      }
    }
    const actions = readFileSync("src/lib/actions.ts", "utf8");
    const gate = actions.slice(actions.indexOf("export async function updateMeshiPreference"), actions.indexOf("export async function getMeshiPreference"));
    check(gate.includes("getEarnedAchievementBadges(user.id)"), true, "The save gate uses authenticated account proof, never client claims");
    check(gate.indexOf("getEarnedAchievementBadges(user.id)") < gate.indexOf("if (!hasMeshPro(user))"), true, "The server enforces earned-only cosmetics before any Pro bypass");
    const clamp = actions.slice(actions.indexOf("function clampMeshiOptionsToFree"), actions.indexOf("export async function updateMeshiPreference"));
    check(clamp.indexOf("achievementRewardForBadge") < clamp.indexOf("if (isPro)"), true, "Onboarding cannot manufacture earned cosmetics for Pro accounts");
    console.log(`Achievement rewards: ${checks} assertions passed.`);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
