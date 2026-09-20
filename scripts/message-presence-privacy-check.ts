import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Exercise the real relational privacy query against an isolated local database.
// Override environment before importing Prisma; this never touches user data.
async function main() {
  const directory = mkdtempSync(join(tmpdir(), "mesh-message-presence-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.VERCEL_ENV = "preview";
  let checks = 0;
  const check = (actual: unknown, expected: unknown, label: string) => {
    assert.deepEqual(actual, expected, label);
    checks++;
  };

  try {
    execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
    const { prisma } = await import("../src/lib/prisma");
    const { clearMeChatTyping, getMeChatActivityUserIds, getMeChatTypingUsers, setMeChatTyping } = await import("../src/lib/mechat-presence");
    const { getCachedMeshiFor } = await import("../src/lib/mechat-meshi-cache");
    const threadId = randomUUID();
    const userIds: string[] = [];
    try {
      const users = await Promise.all(["viewer", "subject", "outsider"].map((name) => prisma.user.create({
        data: {
          id: randomUUID(), username: name, displayName: name, email: `${name}@example.invalid`,
          passwordHash: "isolated-no-login", readReceipts: true, hideActivityStatus: false,
          ghostMode: false, isSuspended: false, isMeshPro: true,
        },
      })));
      const [viewer, subject, outsider] = users;
      userIds.push(...users.map((user) => user.id));
      await prisma.messageThread.create({ data: {
        id: threadId,
        members: { create: [viewer, subject].map((user) => ({ userId: user.id })) },
      } });
      const preference = {
        colorTheme: "violet", hatStyle: "beanie", faceStyle: "sleepy", hairStyle: "waves",
        hairColor: "silver", accessoryStyle: "glasses", eyeStyle: "round", badgeStyle: "star",
      };
      await prisma.meshiPreference.create({ data: { userId: subject.id, ...preference } });
      const meshi = await getCachedMeshiFor(subject.id);
      check(meshi, {
        color: preference.colorTheme, hat: preference.hatStyle, face: preference.faceStyle,
        hair: preference.hairStyle, hairColor: preference.hairColor,
        accessory: preference.accessoryStyle, eyeStyle: preference.eyeStyle,
        badge: preference.badgeStyle, isPro: true,
      }, "Every saved cosmetic reaches the server-derived MeChat identity");
      setMeChatTyping(threadId, { ...subject, meshi }, 60_000, "typing");
      setMeChatTyping(threadId, viewer, 60_000, "viewing");
      setMeChatTyping(threadId, outsider, 60_000, "typing");
      const visible = await getMeChatTypingUsers(threadId, viewer.id);
      check(visible.map((entry) => entry.userId), [subject.id], "Only another current member is visible");
      check(visible[0].meshi, meshi, "Typing retains all eight saved cosmetics");
      check(visible[0].mode, "typing", "Typing mode survives the privacy fence");
      check((await getMeChatActivityUserIds(threadId, viewer.id)).has(subject.id), true, "Read-receipt activity shares the live privacy gate");

      // Change current server state after caching a heartbeat; stale identity
      // data must never carry permission to publish the old activity signal.
      for (const [flag, hiddenValue] of [
        ["ghostMode", true], ["hideActivityStatus", true],
        ["readReceipts", false], ["isSuspended", true],
      ] as const) {
        await prisma.user.update({ where: { id: subject.id }, data: { [flag]: hiddenValue } });
        check(await getMeChatTypingUsers(threadId, viewer.id), [], `Cached typing disappears when ${flag} changes`);
        check((await getMeChatActivityUserIds(threadId, viewer.id)).has(subject.id), false, `Read-receipt activity disappears when ${flag} changes`);
        await prisma.user.update({ where: { id: subject.id }, data: { [flag]: !hiddenValue } });
      }

      setMeChatTyping(threadId, { ...subject, meshi }, 60_000, "viewing");
      check((await getMeChatTypingUsers(threadId, viewer.id))[0].mode, "viewing", "Viewing retains its distinct mode");
      for (const [blockerId, blockedId] of [[viewer.id, subject.id], [subject.id, viewer.id]]) {
        const block = await prisma.block.create({ data: { blockerId, blockedId } });
        check(await getMeChatTypingUsers(threadId, viewer.id), [], "Either block direction removes cached viewing presence");
        check((await getMeChatActivityUserIds(threadId, viewer.id)).has(subject.id), false, "Either block direction removes read-receipt visibility");
        await prisma.block.delete({ where: { id: block.id } });
      }

      await prisma.threadMember.delete({ where: { userId_threadId: { userId: subject.id, threadId } } });
      check(await getMeChatTypingUsers(threadId, viewer.id), [], "A departed member leaves no cached presence");
      await prisma.threadMember.create({ data: { userId: subject.id, threadId } });
      await prisma.threadMember.delete({ where: { userId_threadId: { userId: viewer.id, threadId } } });
      check(await getMeChatTypingUsers(threadId, viewer.id), [], "A departed viewer cannot read cached presence");
      check((await getMeChatActivityUserIds(threadId, viewer.id)).size, 0, "A departed viewer cannot read receipts");
      await prisma.threadMember.create({ data: { userId: viewer.id, threadId } });
      await prisma.user.update({ where: { id: viewer.id }, data: { isSuspended: true } });
      check(await getMeChatTypingUsers(threadId, viewer.id), [], "A suspended viewer cannot read cached presence");
      await prisma.user.update({ where: { id: viewer.id }, data: { isSuspended: false } });
      check(await getMeChatTypingUsers(threadId, outsider.id), [], "A nonmember cannot query thread presence");
      check(await getMeChatTypingUsers(randomUUID(), viewer.id), [], "Another thread does not inherit cached activity");

      setMeChatTyping(threadId, { ...subject, meshi }, -1, "viewing");
      check(await getMeChatTypingUsers(threadId, viewer.id), [], "Expired viewing presence is pruned");
      setMeChatTyping(threadId, { ...subject, meshi }, 60_000, "typing");
      clearMeChatTyping(threadId, subject.id);
      check(await getMeChatTypingUsers(threadId, viewer.id), [], "Explicit stop clears presence");

      setMeChatTyping(threadId, { ...subject, meshi }, 60_000, "typing");
      // Deliberately break only this disposable database. A privacy-read outage
      // must return no cached activity instead of falling back to old claims.
      await prisma.$executeRawUnsafe('DROP TABLE "ThreadMember"');
      check((await getMeChatActivityUserIds(threadId, viewer.id)).size, 0, "A failed privacy lookup closes read-receipt visibility");
      check(await getMeChatTypingUsers(threadId, viewer.id), [], "A failed privacy lookup cannot expose cached typing");
    } finally {
      for (const userId of userIds) clearMeChatTyping(threadId, userId);
      await prisma.$disconnect();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log(`message-presence-privacy: ${checks} isolated database assertions passed.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
