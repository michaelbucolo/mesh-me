import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewNsfw, nsfwHiddenWhere } from "@/lib/content-safety";
import { compactImageUrl, compactUserAvatar } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { rateLimit, sanitizeForDisplay, validateUrl } from "@/lib/security";

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return sanitizeForDisplay(value.trim()).slice(0, maxLength);
}

function cleanUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return validateUrl(trimmed) ? trimmed.slice(0, 600) : "";
}

function buildVaultContent({ title, note, sourceUrl, sourcePlatform }: {
  title: string;
  note: string;
  sourceUrl: string;
  sourcePlatform: string;
}) {
  return [
    title ? `Saved: ${title}` : "Saved to Mesh Vault",
    sourcePlatform ? `Source: ${sourcePlatform}` : "",
    sourceUrl,
    note,
  ].filter(Boolean).join("\n");
}

function serializeSavedPost(savedPost: Awaited<ReturnType<typeof getVaultPayload>>["savedPosts"][number]) {
  return {
    ...savedPost,
    post: {
      ...savedPost.post,
      author: compactUserAvatar(savedPost.post.author),
      media: savedPost.post.media
        .map((media) => {
          const url = compactImageUrl(media.url);
          return url ? { ...media, url } : null;
        })
        .filter((media): media is typeof savedPost.post.media[number] => Boolean(media)),
    },
  };
}

function serializePlatformPost(post: Awaited<ReturnType<typeof getVaultPayload>>["platformPosts"][number]) {
  return {
    ...post,
    thumbnailUrl: compactImageUrl(post.thumbnailUrl),
    media: post.media
      .map((media) => {
        const url = compactImageUrl(media.url);
        const thumbnailUrl = compactImageUrl(media.thumbnailUrl);
        return url || thumbnailUrl ? {
          ...media,
          url: url ?? thumbnailUrl,
          thumbnailUrl,
        } : null;
      })
      .filter((media): media is typeof post.media[number] => Boolean(media)),
  };
}

async function getVaultPayload(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const [savedPosts, platformPosts] = await Promise.all([
    prisma.savedPost.findMany({
      where: { userId: user.id, post: nsfwHiddenWhere(user) },
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            community: { select: { id: true, name: true, slug: true } },
            media: true,
            tags: true,
            _count: { select: { comments: true, reactions: true, reposts: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.platformPost.findMany({
      where: {
        ...nsfwHiddenWhere(user),
        connectedAccount: { userId: user.id, isActive: true },
      },
      include: {
        connectedAccount: {
          select: {
            id: true,
            platform: true,
            platformUsername: true,
          },
        },
        media: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            mediaType: true,
          },
          take: 1,
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 16,
    }),
  ]);

  return { savedPosts, platformPosts };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { savedPosts, platformPosts } = await getVaultPayload(user);

  return NextResponse.json({
    savedPosts: savedPosts.map(serializeSavedPost),
    platformPosts: platformPosts.map(serializePlatformPost),
    counts: {
      savedPosts: savedPosts.length,
      platformCandidates: platformPosts.length,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`vault:${user.id}`, 35, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Saving too quickly. Please slow down." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const postId = cleanText(body.postId, 120);
  const platformPostId = cleanText(body.platformPostId, 120);

  if (postId) {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        ...nsfwHiddenWhere(user),
        OR: [
          { authorId: user.id },
          { savedBy: { some: { userId: user.id } } },
          {
            visibility: "public",
            author: {
              isSuspended: false,
              isPublic: true,
              showInDiscovery: true,
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "That post cannot be saved to your Vault." }, { status: 404 });
    }

    const saved = await prisma.savedPost.upsert({
      where: { userId_postId: { userId: user.id, postId: post.id } },
      update: {},
      create: { userId: user.id, postId: post.id },
    });

    return NextResponse.json({ saved, savedPostId: saved.id }, { status: 201 });
  }

  if (platformPostId) {
    const platformPost = await prisma.platformPost.findFirst({
      where: {
        id: platformPostId,
        OR: [
          { connectedAccount: { userId: user.id } },
          {
            visibility: { not: "private" },
            connectedAccount: {
              user: {
                isSuspended: false,
                isPublic: true,
                showInDiscovery: true,
              },
            },
          },
        ],
      },
      include: {
        connectedAccount: {
          select: {
            platform: true,
            platformUsername: true,
          },
        },
        media: {
          select: { url: true, thumbnailUrl: true, mediaType: true },
          take: 1,
        },
      },
    });

    if (!platformPost || (platformPost.isNsfw && !canViewNsfw(user))) {
      return NextResponse.json({ error: "That source item cannot be saved to your Vault." }, { status: 404 });
    }

    const title = cleanText(body.title, 140) || platformPost.title || "Source-linked memory";
    const note = cleanText(body.note, 500) || platformPost.content || "";
    const sourceUrl = cleanUrl(body.sourceUrl) || platformPost.url || "";
    const sourcePlatform = platformPost.connectedAccount.platform || cleanText(body.sourcePlatform, 40) || "source";
    const mediaUrl = platformPost.thumbnailUrl || platformPost.media[0]?.thumbnailUrl || platformPost.media[0]?.url || "";

    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        content: buildVaultContent({ title, note, sourceUrl, sourcePlatform }),
        visibility: "private",
        isNsfw: platformPost.isNsfw,
        contentRating: platformPost.contentRating,
        tags: { create: [{ tag: "vault" }, { tag: sourcePlatform.toLowerCase() }] },
        media: mediaUrl ? {
          create: [{
            url: mediaUrl,
            type: platformPost.postType === "video" ? "video" : "image",
          }],
        } : undefined,
      },
    });

    const saved = await prisma.savedPost.create({
      data: { userId: user.id, postId: post.id },
    });

    return NextResponse.json({ postId: post.id, savedPostId: saved.id }, { status: 201 });
  }

  const title = cleanText(body.title, 140);
  const note = cleanText(body.note, 900);
  const sourceUrl = cleanUrl(body.sourceUrl);
  const sourcePlatform = cleanText(body.sourcePlatform, 40) || "web";
  if (!title && !note && !sourceUrl) {
    return NextResponse.json({ error: "Add a title, note, or source link." }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      authorId: user.id,
      content: buildVaultContent({ title, note, sourceUrl, sourcePlatform }),
      visibility: "private",
      isNsfw: false,
      contentRating: "general",
      tags: {
        create: [
          { tag: "vault" },
          ...(sourcePlatform ? [{ tag: sourcePlatform.toLowerCase() }] : []),
        ],
      },
    },
  });

  const saved = await prisma.savedPost.create({
    data: { userId: user.id, postId: post.id },
  });

  return NextResponse.json({ postId: post.id, savedPostId: saved.id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const postId = cleanText(body.postId, 120);
  const savedPostId = cleanText(body.savedPostId, 120);

  if (!postId && !savedPostId) {
    return NextResponse.json({ error: "Choose a Vault item to remove." }, { status: 400 });
  }

  const savedPost = await prisma.savedPost.findFirst({
    where: {
      userId: user.id,
      ...(savedPostId ? { id: savedPostId } : { postId }),
    },
    include: {
      post: {
        include: {
          tags: true,
        },
      },
    },
  });

  if (!savedPost) {
    return NextResponse.json({ error: "Vault item not found." }, { status: 404 });
  }

  const isOwnedPrivateVaultPost = savedPost.post.authorId === user.id &&
    savedPost.post.visibility === "private" &&
    savedPost.post.tags.some((tag) => tag.tag === "vault");

  if (isOwnedPrivateVaultPost) {
    await prisma.post.delete({ where: { id: savedPost.postId } });
  } else {
    await prisma.savedPost.delete({ where: { id: savedPost.id } });
  }

  return NextResponse.json({ success: true });
}
