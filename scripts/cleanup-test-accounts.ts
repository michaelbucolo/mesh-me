import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

// Review is the default. Deletion requires a reviewed immutable ID and the
// matching username. Never infer a fixture from a word such as "test" alone.
const fixtures = [
  ["meshmetester1", "Mesh Tester One", null],
  ["meshmetester2", "Mesh Tester Two", null],
  ["alexcreates", "Alex Rivera", "alex@mesh.me"],
  ["mayamusic", "Maya Chen", "maya@mesh.me"],
  ["jordandev", "Jordan Park", "jordan@mesh.me"],
  ["lunawrites", "Luna Torres", "luna@mesh.me"],
  ["samfilms", "Sam Okafor", "sam@mesh.me"],
  ["rileydesign", "Riley Kim", "riley@mesh.me"],
  ["kaigames", "Kai Nakamura", "kai@mesh.me"],
  ["novaphoto", "Nova Williams", "nova@mesh.me"],
  ["ashcooks", "Ash Patel", "ash@mesh.me"],
  ["demouser", "Demo User", "demo@mesh.me"],
] as const;

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Set DATABASE_URL explicitly. No default database is used for cleanup.");
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const deleteId = process.argv.find((arg) => arg.startsWith("--delete-id="))?.slice(12);
  const confirmation = process.argv.find((arg) => arg.startsWith("--confirm-username="))?.slice(19);
  try {
    const users = await prisma.user.findMany({
      where: { username: { in: fixtures.map(([username]) => username) } },
      include: { _count: { select: { posts: true, comments: true, connectedAccounts: true, authIdentities: true, patronStints: true, meshProGiftsReceived: true, meshProGiftsSent: true, ownedMeshiItems: true, purchasedMeshiItems: true } } },
    });
    const reviewed = await Promise.all(users.map(async (user) => {
      const fixture = fixtures.find(([username]) => username === user.username)!;
      let evidence = false;
      if (user.displayName === fixture[1]) {
        if (fixture[2]) evidence = user.email === fixture[2] && await bcrypt.compare("password123", user.passwordHash);
        else if (user.username === "meshmetester1") evidence = Boolean(await prisma.post.findFirst({ where: { authorId: user.id, content: "Hello from tester one! Testing the mesh." } }));
        else evidence = Boolean(await prisma.comment.findFirst({ where: { authorId: user.id, content: "Nice post! From tester two." } }));
      }
      const protectedAccount = user.isAdmin || user.isMeshPro || user.stripeCustomerId || user.stripeSubscriptionId || user.charterNumber || user.patronSince || user.meshProGiftUntil ||
        user._count.connectedAccounts || user._count.authIdentities || user._count.patronStints || user._count.meshProGiftsReceived || user._count.meshProGiftsSent || user._count.ownedMeshiItems || user._count.purchasedMeshiItems;
      return { user, eligible: evidence && !protectedAccount, reason: !evidence ? "Fixture evidence does not match" : protectedAccount ? "Protected: administrator, connected identity or payment history" : "Verified fixture; no protected relationships" };
    }));
    if (!deleteId) {
      console.log(JSON.stringify({ mode: "review", accounts: reviewed.map(({ user, eligible, reason }) => ({ id: user.id, username: user.username, posts: user._count.posts, comments: user._count.comments, eligible, reason })) }, null, 2));
      return;
    }
    const target = reviewed.find(({ user }) => user.id === deleteId);
    if (!target?.eligible || confirmation !== target.user.username) throw new Error("Deletion refused: review the exact fixture ID, resolve protections, and confirm its username.");
    await prisma.$transaction(async (tx) => {
      await tx.accountMergeRequest.deleteMany({ where: { OR: [{ primaryUserId: deleteId }, { secondaryUserId: deleteId }, { secondaryEmail: target.user.email }] } });
      const deleted = await tx.user.deleteMany({ where: {
        id: deleteId, username: confirmation, updatedAt: target.user.updatedAt,
        isAdmin: false, isMeshPro: false, stripeCustomerId: null, stripeSubscriptionId: null,
        connectedAccounts: { none: {} }, authIdentities: { none: {} }, patronStints: { none: {} },
        meshProGiftsReceived: { none: {} }, meshProGiftsSent: { none: {} }, ownedMeshiItems: { none: {} }, purchasedMeshiItems: { none: {} },
      } });
      if (deleted.count !== 1) throw new Error("Account changed after review; nothing was deleted. Review again.");
    });
    console.log(`Deleted verified fixture @${confirmation} and its cascading content.`);
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Cleanup failed"); process.exitCode = 1; });
