import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

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

async function reviewRows(id?: string) {
  const users = await prisma.user.findMany({
    where: { ...(id ? { id } : {}), username: { in: fixtures.map(([username]) => username) } },
    include: { _count: { select: { posts: true, comments: true, connectedAccounts: true, authIdentities: true, patronStints: true, meshProGiftsReceived: true, meshProGiftsSent: true, ownedMeshiItems: true, purchasedMeshiItems: true } } },
  });
  return Promise.all(users.map(async (user) => {
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
}

export async function reviewTestAccounts() {
  const rows = await reviewRows();
  return rows.map(({ user, eligible, reason }) => ({ id: user.id, username: user.username, posts: user._count.posts, comments: user._count.comments, eligible, reason }))
    .sort((a, b) => Number(b.username === "meshmetester2") - Number(a.username === "meshmetester2") || a.username.localeCompare(b.username));
}

export async function deleteVerifiedTestAccount(id: string, username: string, adminId?: string) {
  const [target] = await reviewRows(id);
  if (!target?.eligible || username !== target.user.username || id === adminId) return { error: "Deletion refused: review the exact fixture and confirm its username. Protected accounts cannot be removed here." };
  return prisma.$transaction(async (tx) => {
    await tx.accountMergeRequest.deleteMany({ where: { OR: [{ primaryUserId: id }, { secondaryUserId: id }, { secondaryEmail: target.user.email }] } });
    const deleted = await tx.user.deleteMany({ where: {
      id, username, updatedAt: target.user.updatedAt,
      isAdmin: false, isMeshPro: false, stripeCustomerId: null, stripeSubscriptionId: null,
      connectedAccounts: { none: {} }, authIdentities: { none: {} }, patronStints: { none: {} },
      meshProGiftsReceived: { none: {} }, meshProGiftsSent: { none: {} }, ownedMeshiItems: { none: {} }, purchasedMeshiItems: { none: {} },
    } });
    if (deleted.count !== 1) throw new Error("Account changed after review; nothing was deleted. Review again.");
    if (adminId) await tx.adminLog.create({ data: { adminId, action: "delete_verified_fixture", details: `@${username}; ${target.user._count.posts} posts, ${target.user._count.comments} comments` } });
    return { success: true };
  });
}
