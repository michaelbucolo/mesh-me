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
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { clearMeshCache } from "./mesh-cache";
import { classifyContentSafety } from "./content-safety";
import { rateLimit, sanitizeForDisplay, validatePostContent, validateUrl } from "./security";
import { MAX_POST_MEDIA_FILES, detectPostMediaType, postMediaSelectionError } from "./post-media";
import { readVideoDuration } from "./video-duration";

export type PostAuthor = { id: string; username: string };

const POST_VISIBILITIES = new Set(["public", "friends", "private", "community"]);

type NativePostMediaInput = {
  url: string;
  type: "image" | "video" | "link";
  durationSeconds?: number | null;
  upload?: { data: string; mimeType: string; size: number };
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

  const files = formData
    .getAll("mediaFiles")
    .filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File);
  const selectionError = postMediaSelectionError(files);
  if (selectionError) return { error: selectionError };

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detected = detectPostMediaType(bytes);
    if (!detected) {
      return { error: "That file is not supported media. Use JPEG, PNG, WebP, GIF, AVIF, MP4, MOV, or WebM." };
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    mediaItems.push({
      type: detected.type,
      durationSeconds: detected.type === "video" ? readVideoDuration(bytes, detected.mime) : null,
      url: `data:${detected.mime};base64,${base64}`,
      upload: { data: base64, mimeType: detected.mime, size: bytes.byteLength },
    });
  }

  const remoteUrls = readStringArrayField(formData, "mediaUrls", MAX_POST_MEDIA_FILES + 1);
  for (const rawUrl of remoteUrls) {
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

  if (mediaItems.length > MAX_POST_MEDIA_FILES) return { error: "Attach up to 4 files or links in total." };
  return { mediaItems };
}

export async function createPostAsUser(user: PostAuthor, formData: FormData) {

  const rl = rateLimit(`post:${user.id}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return { error: "Posting too fast. Please slow down." };
  }

  const content = formData.get("content") as string;
  const communityId = formData.get("communityId") as string | null;
  const tags = formData.get("tags") as string;
  let visibility = normalizePostVisibility(formData.get("visibility"));
  if (visibility === "community" && !communityId) return { error: "Choose a community for a members-only post." };
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
  // Encoded file bytes are not words: scanning base64 for terms such as
  // "xxx" randomly labels ordinary photos as adult content.
  const safety = classifyContentSafety(sanitizedContent, tags, mediaItems.filter((item) => !item.upload).map((item) => item.url).join(" "));

  // Verify community membership if posting to a community
  if (communityId) {
    const membership = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: user.id, communityId } },
      include: { community: { select: { isPublic: true } } },
    });
    if (!membership) {
      return { error: "You must be a member of this community to post" };
    }
    if (!membership.community.isPublic && visibility === "public") visibility = "community";
  }

  const post = await prisma.post.create({
    data: {
      content: sanitizedContent,
      authorId: user.id,
      communityId: communityId || undefined,
      visibility,
      isNsfw: safety.isNsfw,
      contentRating: safety.contentRating,
      tags: tags ? { create: Array.from(new Set(tags.split(",").map(normalizePostTag).filter(Boolean))).slice(0, 12).map((tag) => ({ tag })) } : undefined,
      media: {
        create: mediaItems.map((item) => {
          const id = randomUUID();
          return {
            id,
            type: item.type,
            durationSeconds: item.durationSeconds,
            url: item.upload ? `/api/post-media/${id}` : item.url,
            ...(item.upload ? { file: { create: item.upload } } : {}),
          };
        }),
      },
    },
  });

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
      const audience = visibility === "friends" ? "Friends" : visibility === "community" ? "Community members" : "Only me";
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
