import "server-only";

// THE POST CORE — every law a post obeys, in one place.
//
// This is createPost's body, extracted so the scheduled-publish fire path can
// create a post AS its owner under the exact rules a live post follows:
// the `post:` rate limit, content validation, sanitizeForDisplay, the safety
// classification, community membership, media collection — one definition.
//
// DELIBERATELY NOT a "use server" module: an exported server action taking a
// `user` argument would let any client post as anyone. This is server-only
// library code; the two callers are `createPost` (which derives the user from
// the session) and the scheduler's deliverers (which derive it from the
// ScheduledPost row's owner).

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { clearMeshCache } from "./mesh-cache";
import { classifyContentSafety } from "./content-safety";
import { rateLimit, sanitizeForDisplay, validatePostContent, validateUrl } from "./security";

export type PostAuthor = { id: string; username: string };

const POST_VISIBILITIES = new Set(["public", "friends", "private"]);
const MAX_POST_MEDIA_FILES = 4;
const MAX_POST_MEDIA_FILE_SIZE = 4 * 1024 * 1024;
const MAX_POST_MEDIA_TOTAL_SIZE = 10 * 1024 * 1024;

type NativePostMediaInput = {
  url: string;
  type: "image" | "video" | "link";
};

function normalizePostVisibility(value: FormDataEntryValue | null) {
  const visibility = typeof value === "string" ? value.trim().toLowerCase() : "";
  return POST_VISIBILITIES.has(visibility) ? visibility : "public";
}

function normalizePostTag(value: string) {
  return sanitizeForDisplay(value)
    .replace(/^#+/, "")
    .replace(/[^\w-]/g, "")
    .trim()
    .toLowerCase()
    .slice(0, 32);
}

function inferMediaTypeFromUrl(url: string): NativePostMediaInput["type"] {
  const clean = url.split("?")[0]?.toLowerCase() || "";
  if (/\.(png|jpe?g|gif|webp|avif)$/.test(clean)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "video";
  return "link";
}

function detectUploadedPostMediaType(bytes: Uint8Array, fileType: string): { type: "image" | "video"; mime: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image", mime: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: "image", mime: "image/png" };
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { type: "image", mime: "image/webp" };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { type: "image", mime: "image/gif" };
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return { type: "video", mime: fileType === "video/quicktime" ? "video/quicktime" : "video/mp4" };
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { type: "video", mime: "video/webm" };
  return null;
}

function readStringArrayField(formData: FormData, key: string, maxItems: number) {
  const values = formData.getAll(key).flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const trimmed = entry.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      // Treat as comma/newline separated text below.
    }
    return trimmed.split(/[,\n]/);
  });

  return values.map((value) => value.trim()).filter(Boolean).slice(0, maxItems);
}

async function collectNativePostMedia(formData: FormData) {
  const mediaItems: NativePostMediaInput[] = [];
  let totalBytes = 0;

  const files = formData
    .getAll("mediaFiles")
    .filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File && entry.size > 0)
    .slice(0, MAX_POST_MEDIA_FILES);

  for (const file of files) {
    if (file.size > MAX_POST_MEDIA_FILE_SIZE) {
      return { error: "Each image or video must be 4MB or smaller." };
    }
    totalBytes += file.size;
    if (totalBytes > MAX_POST_MEDIA_TOTAL_SIZE) {
      return { error: "Post media is too large. Keep uploads under 10MB total." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detected = detectUploadedPostMediaType(bytes, file.type);
    if (!detected) {
      return { error: "Use JPEG, PNG, WebP, GIF, MP4, MOV, or WebM media." };
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    mediaItems.push({
      type: detected.type,
      url: `data:${detected.mime};base64,${base64}`,
    });
  }

  const remoteUrls = readStringArrayField(formData, "mediaUrls", MAX_POST_MEDIA_FILES);
  for (const rawUrl of remoteUrls) {
    if (mediaItems.length >= MAX_POST_MEDIA_FILES) break;
    if (!validateUrl(rawUrl)) return { error: "Media URLs must start with http:// or https://." };
    mediaItems.push({ url: rawUrl, type: inferMediaTypeFromUrl(rawUrl) });
  }

  const linkUrl = String(formData.get("linkUrl") || "").trim();
  if (linkUrl) {
    if (!validateUrl(linkUrl)) return { error: "Link URL must start with http:// or https://." };
    if (!mediaItems.some((item) => item.url === linkUrl)) {
      mediaItems.push({ url: linkUrl, type: "link" });
    }
  }

  return { mediaItems: mediaItems.slice(0, MAX_POST_MEDIA_FILES) };
}

export async function createPostAsUser(user: PostAuthor, formData: FormData) {

  const rl = rateLimit(`post:${user.id}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return { error: "Posting too fast. Please slow down." };
  }

  const content = formData.get("content") as string;
  const communityId = formData.get("communityId") as string | null;
  const tags = formData.get("tags") as string;
  const visibility = normalizePostVisibility(formData.get("visibility"));
  const crossPostTo = formData.get("crossPostTo") as string | null;
  const crossPostAccountIds = formData.get("crossPostAccountIds") as string | null;
  const mediaResult = await collectNativePostMedia(formData);
  if ("error" in mediaResult) return { error: mediaResult.error };
  const mediaItems = mediaResult.mediaItems;

  // Validate and sanitize post content
  const contentText = content || "";
  if (contentText.trim()) {
    const validation = validatePostContent(contentText);
    if (!validation.valid) {
      return { error: validation.error };
    }
  } else if (mediaItems.length === 0) {
    return { error: "Add text, media, or a link before posting." };
  }

  const sanitizedContent = sanitizeForDisplay(contentText.trim());
  const safety = classifyContentSafety(sanitizedContent, tags, mediaItems.map((item) => item.url).join(" "));

  // Verify community membership if posting to a community
  if (communityId) {
    const membership = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: user.id, communityId } },
    });
    if (!membership) {
      return { error: "You must be a member of this community to post" };
    }
  }

  const post = await prisma.post.create({
    data: {
      content: sanitizedContent,
      authorId: user.id,
      communityId: communityId || undefined,
      visibility,
      isNsfw: safety.isNsfw,
      contentRating: safety.contentRating,
    },
  });

  if (tags) {
    const tagList = Array.from(new Set(tags.split(",").map(normalizePostTag).filter(Boolean))).slice(0, 12);
    if (tagList.length > 0) {
      await prisma.postTag.createMany({
        data: tagList.map((tag) => ({ postId: post.id, tag })),
      });
    }
  }

  if (mediaItems.length > 0) {
    await prisma.postMedia.createMany({
      data: mediaItems.map((item) => ({
        postId: post.id,
        url: item.url,
        type: item.type,
      })),
    });
  }

  let crossPostResults: Record<string, { success: boolean; error?: string; url?: string; note?: string }> | undefined;
  const parseStringArray = (value: string | null) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
    }
  };
  const targetPlatforms = parseStringArray(crossPostTo);
  const targetAccountIds = parseStringArray(crossPostAccountIds);
  if (targetPlatforms.length > 0 || targetAccountIds.length > 0) {
    if (visibility !== "public") {
      // A cross-post is public EVERYWHERE it lands — a Friends or Only-me
      // post must never leak to X/Reddit because a checkbox was left on.
      const audience = visibility === "friends" ? "Friends" : "Only me";
      const gated = {
        success: false,
        error: `Not sent: this post's audience is ${audience} on mesh.me, and a cross-post is public everywhere. Make the post Public to send it.`,
      };
      crossPostResults = Object.fromEntries(
        [...targetPlatforms, ...targetAccountIds].map((target) => [target, gated]),
      );
    } else {
      const { crossPostContent } = await import("./platform-sync");
      const result = await crossPostContent(sanitizedContent, targetPlatforms, mediaItems.filter((item) => item.type !== "link").map((item) => item.url), targetAccountIds);
      if ("results" in result && result.results && typeof result.results === "object") {
        crossPostResults = result.results;
      }
    }
  }

  const createdPost = await prisma.post.findUnique({
    where: { id: post.id },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isVerified: true,
        },
      },
      community: {
        select: { id: true, name: true, slug: true },
      },
      media: true,
      tags: true,
      _count: {
        select: { comments: true, reactions: true, reposts: true },
      },
      reactions: {
        where: { userId: user.id },
        select: { id: true },
      },
      savedBy: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
  });

  revalidatePath("/feed");
  revalidatePath(`/feed/${post.id}`);
  revalidatePath(`/profile/${user.username}`);
  if (communityId) {
    const community = await prisma.community.findUnique({ where: { id: communityId }, select: { slug: true } });
    if (community) revalidatePath(`/communities/${community.slug}`);
  }
  clearMeshCache(user.id);

  return {
    success: true,
    postId: post.id,
    post: createdPost ? { ...createdPost, platform: "meshme" } : undefined,
    crossPostResults,
  };
}
