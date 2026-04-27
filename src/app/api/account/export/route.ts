import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [posts, comments, connectedAccounts, emails, phones, twoFactorMethods] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.comment.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        postId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        platform: true,
        platformUsername: true,
        isActive: true,
        lastSyncAt: true,
        syncStatus: true,
        createdAt: true,
      },
    }),
    prisma.userEmail.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        isPrimary: true,
        isVerified: true,
        createdAt: true,
      },
    }),
    prisma.userPhone.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        phone: true,
        isPrimary: true,
        isVerified: true,
        createdAt: true,
      },
    }),
    prisma.twoFactorMethod.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        method: true,
        label: true,
        isEnabled: true,
        lastUsedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const exportPayload = {
    generatedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      location: user.location,
      website: user.website,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      privacy: {
        isPublic: user.isPublic,
        showInDiscovery: user.showInDiscovery,
        hideActivityStatus: user.hideActivityStatus,
        readReceipts: user.readReceipts,
      },
      meshPro: {
        isMeshPro: user.isMeshPro,
        meshProSince: user.meshProSince,
      },
    },
    security: {
      emails,
      phones,
      twoFactorMethods,
    },
    content: {
      posts,
      comments,
    },
    connectedAccounts,
    summary: {
      postCount: posts.length,
      commentCount: comments.length,
      connectedAccountCount: connectedAccounts.length,
      recoveryEmailCount: emails.length,
      recoveryPhoneCount: phones.length,
      twoFactorMethodCount: twoFactorMethods.length,
    },
  };

  const filename = `meshme-export-${user.username}-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
