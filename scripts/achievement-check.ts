// THE DIFFERENCE BETWEEN A MILESTONE AND A SLOT MACHINE IS ENFORCEABLE.
//
// The Achievement schema has existed unused for a long time: slug, name, icon,
// category, title, threshold, isLimited, maxHolders, plus User.activeTitle and a
// read query that returned an empty list every time it ran, because nothing ever
// created a row. Filling it in is easy. Filling it in without building a
// compulsion loop is the part that needs holding in place.
//
// The standard version of this feature uses variable rewards, surprise drops,
// streaks that punish a missed day, and counters that rise when you feed the
// machine. It produces sessions. It produces them by making people feel slightly
// bad on purpose. Three rules keep this on the other side of that line, and the
// schema still has the fields to break all three, so they are checked rather
// than merely intended:
//
//   1. Fixed, published thresholds — nothing random, nothing personalised.
//   2. Nothing awarded for other people's attention — no followers, no likes,
//      no views. Every metric is something you did.
//   3. No streaks, no consecutive-day requirements, no scarcity.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ACHIEVEMENTS, achievementProgress, earnedSlugs, type AchievementCounts } from "../src/lib/achievements/catalogue";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
let checks = 0;

/**
 * Comments are not code, and a gate that reads them fails the file that
 * explains the rule. This is the THIRD gate in this codebase to need it: the
 * OAuth precondition check once matched its own comment and passed a mutation
 * that deleted the branch, and the inventory-claim check failed a card for the
 * phrase "every platform" inside the paragraph justifying the ban. A comment
 * saying "no streaks" is evidence of the rule, not a violation of it.
 */
function stripComments(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => " ".repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

const ZERO: AchievementCounts = {
  postsWritten: 0,
  commentsWritten: 0,
  platformsConnected: 0,
  peopleFollowed: 0,
  communitiesJoined: 0,
  roomsShared: 0,
};

// ── 1. FIXED AND PUBLISHED ──────────────────────────────────────────────────
{
  assert.ok(ACHIEVEMENTS.length >= 8, `only ${ACHIEVEMENTS.length} milestones; a near-empty catalogue passes everything below.`);
  checks += 1;

  const slugs = ACHIEVEMENTS.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length, "two milestones share a slug, which is the unique key rows are joined on.");
  checks += 1;

  for (const a of ACHIEVEMENTS) {
    assert.ok(Number.isInteger(a.threshold) && a.threshold >= 1, `${a.slug} has a threshold of ${a.threshold}; it must be a whole number you can reach.`);
    // A description that does not state the task is a threshold you cannot see.
    assert.ok(a.description.length > 15, `${a.slug} does not say what to do in words.`);
    checks += 2;
  }

  // Deterministic: the same counts must always produce the same result. Any
  // randomness, time-dependence or personalisation would break this, which is
  // exactly what "fixed" is supposed to rule out.
  const counts: AchievementCounts = { ...ZERO, postsWritten: 30, platformsConnected: 3 };
  const first = earnedSlugs(counts).join(",");
  for (let i = 0; i < 5; i += 1) {
    assert.equal(earnedSlugs(counts).join(","), first, "earnedSlugs is not deterministic — a fixed threshold cannot depend on chance or the clock.");
    checks += 1;
  }

  // Monotonic: doing more never takes a milestone away.
  const more: AchievementCounts = { ...counts, postsWritten: 31 };
  const before = new Set(earnedSlugs(counts));
  for (const slug of before) {
    assert.ok(earnedSlugs(more).includes(slug), `${slug} disappeared when a count went UP.`);
    checks += 1;
  }

  // Nothing is earned at zero. A milestone handed over for existing is not one.
  assert.deepEqual(earnedSlugs(ZERO), [], "something is awarded for having done nothing at all.");
  checks += 1;

  // Every milestone is listed whether or not it is earned — hiding a
  // requirement until you meet it turns a published threshold into a surprise.
  assert.equal(achievementProgress(ZERO).length, ACHIEVEMENTS.length, "the board hides unearned milestones; the numbers must be visible from the start.");
  checks += 1;
}

// ── 2. NOTHING FOR OTHER PEOPLE'S ATTENTION ─────────────────────────────────
//
// The sharpest rule of the three. A badge for follower count teaches people to
// perform for strangers and measures something largely outside their control.
{
  const source = stripComments(read("src/lib/achievements/catalogue.ts"));
  const ATTENTION = [
    "followersGained",
    "likesReceived",
    "viewsReceived",
    "reactionsReceived",
    "impressions",
    "followerCount",
  ];
  for (const metric of ATTENTION) {
    assert.ok(
      !source.includes(metric),
      `the catalogue references ${metric}. Nothing may be awarded for how the crowd treated you —\n` +
        "  it is not yours to control, and turning it into a badge is how a product starts asking people\n" +
        "  to perform. Every metric must be something the person did.",
    );
    checks += 1;
  }

  // And the measurement side must not read the tables that count attention.
  const award = stripComments(read("src/lib/achievements/award.ts"));
  for (const table of ["prisma.reaction", "prisma.flowImpression", "followingId: userId"]) {
    assert.ok(
      !award.includes(table),
      `award.ts reads ${table} — that counts what OTHER people did to you, not what you did.`,
    );
    checks += 1;
  }

  // `peopleFollowed` is the deliberate mirror image: who YOU chose to follow.
  assert.ok(
    award.includes("followerId: userId"),
    "peopleFollowed must count follows you made (followerId), never follows you received.",
  );
  checks += 1;
}

// ── 3. NO STREAKS, NO SCARCITY ──────────────────────────────────────────────
{
  const source = stripComments(read("src/lib/achievements/catalogue.ts"));
  for (const word of ["streak", "consecutive", "dailyLogin", "loginStreak", "daysInARow"]) {
    assert.ok(
      !new RegExp(`\\b${word}\\b`, "i").test(source),
      `the catalogue mentions ${word}. A streak is a punishment for absence wearing a reward's clothes.`,
    );
    checks += 1;
  }

  // isLimited and maxHolders exist in the schema and are deliberately unused.
  // "Only the first N people can ever have this" is the one thing on the list
  // you could not earn by choosing to.
  for (const field of ["isLimited", "maxHolders"]) {
    assert.ok(
      !source.includes(field) && !stripComments(read("src/lib/achievements/award.ts")).includes(field),
      `${field} is in use. Capping how many people may ever hold a milestone is manufactured urgency —\n` +
        "  the schema offers it; that is not the same as it being a good idea.",
    );
    checks += 1;
  }
}

// ── 4. THE BOARD IS PRIVATE; ONLY A CHOSEN TITLE IS PUBLIC ──────────────────
//
// "Connected six platforms" is a fact about somebody's other accounts.
{
  const view = read("src/app/(app)/profile/profile-view.tsx");
  assert.ok(
    /isOwnProfile\s*\?\s*\[[^\]]*"milestones"/.test(view) || /isOwnProfile\s*&&[\s\S]{0,400}?MilestonesBoard/.test(view),
    "the milestones board is not gated to the profile's owner. The board reveals how much of someone's\n" +
      "  life is wired up here; only the title they chose to wear may travel.",
  );
  checks += 1;

  const actions = read("src/lib/achievements/actions.ts");
  // A title renders to other people, so the client's claim about what it earned
  // cannot be the deciding opinion.
  assert.ok(
    actions.includes("earnedSlugs") && actions.includes("measureAchievementCounts"),
    "setActiveTitle does not re-derive the earned set on the server. A title is public; a client that\n" +
      "  says it earned one must be checked, not believed.",
  );
  checks += 1;
}

// ── 5. IT IS ACTUALLY MOUNTED ───────────────────────────────────────────────
//
// This repo has shipped correct, gated, invisible code more than once. An
// import is evidence of intent; only an element is evidence of a rendered board.
{
  const view = read("src/app/(app)/profile/profile-view.tsx");
  assert.ok(/<MilestonesBoard\b/.test(view), "the profile imports MilestonesBoard but never RENDERS it.");
  assert.ok(/getAchievementBoard\s*\(/.test(view), "the profile never calls getAchievementBoard, so the board has no data.");
  assert.ok(view.includes('label="Milestones"'), "there is no Milestones tab, so nothing can navigate to the board.");
  checks += 3;

  const board = read("src/components/profile/milestones-board.tsx");
  assert.ok(board.includes("recordAchievements"), "the board never records a crossing, so unlockedAt is never written.");
  checks += 1;
}

console.log(
  `achievement OK — ${checks} assertions over ${ACHIEVEMENTS.length} milestones.\n` +
    "  Thresholds are whole numbers, published in words, deterministic across repeated evaluation, and\n" +
    "  monotonic — doing more never takes one away, and nothing is earned for having done nothing.\n" +
    "  NOTHING is awarded for other people's attention: no follower, like, view or impression metric\n" +
    "  exists, and peopleFollowed counts follows you MADE. No streaks, no consecutive-day requirements,\n" +
    "  and isLimited/maxHolders stay unused because capped scarcity is the one thing here you could not\n" +
    "  earn by choosing to. The board is owner-only; the title is re-checked server-side because it is\n" +
    "  the one part other people see. And it is mounted, with a tab that reaches it.\n" +
    "  Does NOT cover: whether the thresholds are set at humane NUMBERS. That is a judgement call.",
);
