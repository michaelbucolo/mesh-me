import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { canUserInteractWithPost } from "@/lib/privacy-policy";
import { hasMeshiConsent, profileDiscoveryConsentWhere } from "@/lib/consent";
import { classifyContentSafety } from "@/lib/content-safety";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import { clearMeshCache } from "@/lib/mesh-cache";
import { findOrCreateDirectThread } from "@/lib/direct-thread";
import { rateLimit, sanitizeForDisplay } from "@/lib/security";

// Meshi Vessel Actions — Meshi can act on behalf of the user
// These are explicit user-triggered actions through the Meshi interface

type MeshiAction = "post" | "message" | "follow" | "unfollow" | "react" | "comment" | "suggest";

interface MeshiActionRequest {
  action: MeshiAction;
  // For "post"
  content?: string;
  communityId?: string;
  tags?: string[];
  // For "message"
  recipientId?: string;
  messageContent?: string;
  // For "follow" / "unfollow"
  targetUserId?: string;
  // For "react" / "comment"
  postId?: string;
  reactionType?: string;
  commentContent?: string;
  // For "suggest"
  suggestionType?: "people" | "communities" | "content";
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await readJsonObject(req)) as Partial<MeshiActionRequest>;
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    // Throttle privileged writes (post / follow / message / react) so this
    // action path can't be scripted into mass-follow, mass-DM, or post floods.
    //
    // BOTH limiters, matching /api/meshi/chat:533. `rateLimit` is an in-memory
    // Map and resets on every cold start, so on serverless it cannot bound
    // anything — and this route WRITES. The durable one is the real ceiling;
    // the in-memory one just answers faster on the common path.
    if (action !== "suggest") {
      const rl = rateLimit(`meshi-actions:${user.id}`, 30, 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json({ error: "Meshi is acting too fast. Please slow down." }, { status: 429 });
      }
      const durableRl = await durableRateLimit(`meshi-actions:${user.id}`, 30, 60 * 1000);
      if (!durableRl.allowed) {
        return NextResponse.json({ error: "Meshi is acting too fast. Please slow down." }, { status: 429 });
      }
    }

    // THE MESHI MEMORY RULE, on the route that ACTS.
    //
    // Two Meshi endpoints, one taught the rule. /api/meshi/chat consults
    // hasMeshiConsent (chat/route.ts:565) and meshiQuery repeats it at the
    // engine door (meshi-engine.ts:1261) "so a client cannot skip the route's
    // check". This route — the one that posts, follows, unfollows, reacts and
    // sends DMs as the user — consulted it nowhere. So a user who switched
    // Meshi memory OFF was told "Your privacy rules say I should not use your
    // Mesh, so I am not reading it" by the assistant, while this endpoint would
    // still read their communities, their follow graph and their threads, and
    // write to all three on their behalf.
    //
    // Refusal, not degradation. The chat route can drop grounding and still
    // answer the question that was typed; there is no reduced version of
    // following someone. Every one of these actions reads the user's mesh to
    // find its target and writes back into it, which is precisely what the rule
    // governs. "suggest" is exempt because it is the one branch that neither
    // reads a target nor writes.
    if (action !== "suggest" && !(await hasMeshiConsent(user.id))) {
      return NextResponse.json({
        error: "Your privacy rules say I should not use your Mesh, so I am not acting on it. You can switch Meshi memory back on in your privacy controls.",
      }, { status: 403 });
    }

    switch (action) {
      case "post": {
        if (!body.content || typeof body.content !== "string" || body.content.trim().length === 0) {
          return NextResponse.json({ error: "Post content is required" }, { status: 400 });
        }
        if (body.content.length > 500) {
          return NextResponse.json({ error: "Post content too long (max 500 chars)" }, { status: 400 });
        }

        // Community posting requires membership — mirror createPost so this
        // path can't inject posts into communities (including private ones)
        // the user never joined.
        if (body.communityId) {
          const membership = await prisma.communityMember.findUnique({
            where: { userId_communityId: { userId: user.id, communityId: body.communityId } },
            select: { userId: true },
          });
          if (!membership) {
            return NextResponse.json({ error: "You must be a member of this community to post" }, { status: 403 });
          }
        }

        const sanitizedContent = sanitizeForDisplay(body.content.trim());
        const normalizedTags = (body.tags ?? [])
          .map((tag) => tag.toLowerCase().trim())
          .filter(Boolean);
        const safety = classifyContentSafety(sanitizedContent, normalizedTags.join(","), "");

        const post = await prisma.post.create({
          data: {
            content: sanitizedContent,
            authorId: user.id,
            communityId: body.communityId || null,
            isNsfw: safety.isNsfw,
            contentRating: safety.contentRating,
            tags: normalizedTags.length > 0
              ? { create: normalizedTags.map((tag) => ({ tag })) }
              : undefined,
          },
          include: {
            author: { select: { username: true, displayName: true } },
            tags: true,
          },
        });

        revalidatePath("/feed");
        return NextResponse.json({
          success: true,
          message: `Posted successfully! Your new post is live on your feed.`,
          data: { postId: post.id, content: post.content },
          mood: "excited",
        });
      }

      case "message": {
        if (!body.recipientId) {
          return NextResponse.json({ error: "Recipient is required" }, { status: 400 });
        }
        if (!body.messageContent || body.messageContent.trim().length === 0) {
          return NextResponse.json({ error: "Message content is required" }, { status: 400 });
        }
        // Mirror the per-thread send cap so a Meshi message can't bypass the
        // app's message-length contract and bloat the thread/storage.
        if (body.messageContent.trim().length > 4000) {
          return NextResponse.json({ error: "Message is too long (max 4000 chars)" }, { status: 400 });
        }
        if (body.recipientId === user.id) {
          return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
        }

        // Check if recipient exists
        const recipient = await prisma.user.findUnique({
          where: { id: body.recipientId },
          select: { id: true, displayName: true, username: true, isSuspended: true },
        });
        if (!recipient || recipient.isSuspended) {
          return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
        }

        // Find or create the 1:1 DM thread, blocks included — src/lib/direct-thread.ts.
        // This used to carry its own copy of both rules, with a comment saying it
        // "mirrors the messages route". Mirrors drift; the rule now has one home.
        const opened = await findOrCreateDirectThread(user.id, body.recipientId);
        if (opened.reason === "blocked") {
          return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });
        }
        if (!opened.threadId) {
          return NextResponse.json({ error: "Cannot message this user" }, { status: 400 });
        }
        const threadId = opened.threadId;

        await prisma.message.create({
          data: {
            // sanitizeForDisplay, matching the post branch above. This branch
            // wrote the raw string, so the one Meshi write that lands in another
            // person's inbox was the one that did not sanitize.
            content: sanitizeForDisplay(body.messageContent.trim()),
            senderId: user.id,
            threadId,
          },
        });

        // Update thread timestamp and notify the recipient, matching every other
        // message-send path (a Meshi DM should ring the bell like any other).
        await prisma.messageThread.update({
          where: { id: threadId },
          data: { updatedAt: new Date() },
        });
        await prisma.notification.create({
          data: {
            type: "message",
            recipientId: body.recipientId,
            actorId: user.id,
            message: `${user.displayName} sent you a message`,
          },
        });

        revalidatePath("/messages");
        return NextResponse.json({
          success: true,
          message: `Message sent to ${recipient.displayName}!`,
          data: { threadId, recipientName: recipient.displayName },
          mood: "love",
        });
      }

      case "follow": {
        if (!body.targetUserId) {
          return NextResponse.json({ error: "Target user is required" }, { status: 400 });
        }
        if (body.targetUserId === user.id) {
          return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
        }

        const target = await prisma.user.findUnique({
          where: { id: body.targetUserId },
          select: { id: true, displayName: true, username: true, isSuspended: true },
        });
        if (!target || target.isSuspended) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Check for existing follow
        const existingFollow = await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: user.id, followingId: body.targetUserId } },
        });
        if (existingFollow) {
          return NextResponse.json({
            success: true,
            message: `You already follow ${target.displayName}!`,
            mood: "happy",
          });
        }

        // Check for blocks
        const followBlockExists = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: user.id, blockedId: body.targetUserId },
              { blockerId: body.targetUserId, blockedId: user.id },
            ],
          },
        });
        if (followBlockExists) {
          return NextResponse.json({ error: "Cannot follow this user" }, { status: 403 });
        }

        await prisma.follow.create({
          data: { followerId: user.id, followingId: body.targetUserId },
        });

        // Create notification
        await prisma.notification.create({
          data: {
            type: "follow",
            recipientId: body.targetUserId,
            actorId: user.id,
          },
        });

        revalidatePath(`/profile/${target.username}`);
        return NextResponse.json({
          success: true,
          message: `Now following ${target.displayName}! They'll appear closer on your mesh.`,
          data: { targetName: target.displayName, targetUsername: target.username },
          mood: "excited",
        });
      }

      case "unfollow": {
        if (!body.targetUserId) {
          return NextResponse.json({ error: "Target user is required" }, { status: 400 });
        }

        const unfollowTarget = await prisma.user.findUnique({
          where: { id: body.targetUserId },
          select: { id: true, displayName: true, username: true },
        });
        if (!unfollowTarget) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const existingFollowToRemove = await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: user.id, followingId: body.targetUserId } },
        });
        if (!existingFollowToRemove) {
          return NextResponse.json({
            success: true,
            message: `You weren't following ${unfollowTarget.displayName}.`,
            mood: "thinking",
          });
        }

        await prisma.follow.delete({
          where: { followerId_followingId: { followerId: user.id, followingId: body.targetUserId } },
        });

        revalidatePath(`/profile/${unfollowTarget.username}`);
        return NextResponse.json({
          success: true,
          message: `Unfollowed ${unfollowTarget.displayName}. They'll drift further on your mesh.`,
          data: { targetName: unfollowTarget.displayName },
          mood: "thinking",
        });
      }

      case "comment": {
        // Meshi could like a post but not say anything about one. The action
        // existed nowhere — no MeshiAction member, no branch, no intent — so
        // "comment on this" was the one obvious thing it could not do on a
        // surface built for reacting to what you are watching.
        //
        // Every guard the react branch carries applies here and one more: a
        // comment is CONTENT, so it is sanitized and classified exactly as
        // createPost does. An unsanitized string authored by an assistant and
        // published under the user's name is the worst shape this route could
        // take.
        if (!body.postId) {
          return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
        }
        const text = (body.commentContent ?? "").trim();
        if (!text) {
          return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
        }
        if (text.length > 1200) {
          return NextResponse.json({ error: "Comment is too long (max 1200 chars)" }, { status: 400 });
        }

        const target = await prisma.post.findUnique({
          where: { id: body.postId },
          select: { id: true, authorId: true, content: true, visibility: true, communityId: true },
        });
        if (!target || !(await canUserInteractWithPost(user.id, target))) {
          return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const comment = await prisma.comment.create({
          data: {
            postId: target.id,
            authorId: user.id,
            content: sanitizeForDisplay(text).slice(0, 1200),
          },
          select: { id: true },
        });

        if (target.authorId !== user.id) {
          await prisma.notification.create({
            data: { type: "comment", recipientId: target.authorId, actorId: user.id, postId: target.id },
          });
        }

        // Same reason as the react branch: the comment count is part of what
        // the mesh draws, and it reads a cached payload.
        clearMeshCache(user.id);
        revalidatePath("/feed");
        revalidatePath("/mesh");

        return NextResponse.json({
          success: true,
          message: "Commented for you.",
          data: { commentId: comment.id, postId: target.id },
          mood: "happy",
        });
      }

      case "react": {
        if (!body.postId) {
          return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
        }

        const post = await prisma.post.findUnique({
          where: { id: body.postId },
          select: { id: true, authorId: true, content: true, visibility: true, communityId: true },
        });
        if (!post) {
          return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }
        if (!(await canUserInteractWithPost(user.id, post))) {
          return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const existingReaction = await prisma.reaction.findFirst({
          where: { postId: body.postId, userId: user.id },
        });

        if (existingReaction) {
          await prisma.reaction.delete({ where: { id: existingReaction.id } });
          // The mesh reads a cached payload; without this the un-like is
          // invisible there for up to 45s. Same call every other reaction path
          // in the product already makes.
          clearMeshCache(user.id);
          revalidatePath("/feed");
          revalidatePath("/mesh");
          return NextResponse.json({
            success: true,
            message: "Reaction removed.",
            mood: "happy",
          });
        }

        await prisma.reaction.create({
          data: {
            postId: body.postId,
            userId: user.id,
            type: body.reactionType || "like",
          },
        });

        // THE FLOW IS THE MESH IN A DIFFERENT FORM FACTOR.
        //
        // A like has to be true on both surfaces at once, and this branch wrote
        // the Reaction row and stopped. The mesh does not read that row live —
        // it serves a per-process cached payload (mesh-cache.ts) refreshed by a
        // 25s poll — so a like Meshi placed in the Flow stayed invisible on the
        // mesh until the cache aged out. Clearing it here is what makes the two
        // views one thing rather than two copies that agree eventually.
        clearMeshCache(user.id);
        revalidatePath("/feed");
        revalidatePath("/mesh");

        // Notification if not self-react
        if (post.authorId !== user.id) {
          await prisma.notification.create({
            data: {
              type: "reaction",
              recipientId: post.authorId,
              actorId: user.id,
              postId: body.postId,
            },
          });
        }

        return NextResponse.json({
          success: true,
          message: "Liked the post!",
          mood: "love",
        });
      }

      case "suggest": {
        const suggestionType = body.suggestionType || "people";

        if (suggestionType === "people") {
          // Suggest people the user might want to follow. Discovery only ever
          // surfaces accounts that opted into being found (showInDiscovery),
          // mirroring getDiscoverUsers / searchAll / lookupPerson — otherwise
          // Meshi becomes a back door to users who hid from discovery.
          const suggestions = await prisma.user.findMany({
            where: {
              id: { not: user.id },
              isSuspended: false,
              showInDiscovery: true,
              ...profileDiscoveryConsentWhere(),
              NOT: {
                followers: { some: { followerId: user.id } },
              },
            },
            select: {
              id: true,
              username: true,
              displayName: true,
              bio: true,
              _count: { select: { followers: true, posts: true } },
            },
            orderBy: { followers: { _count: "desc" } },
            take: 5,
          });

          return NextResponse.json({
            success: true,
            message: suggestions.length > 0
              ? `Here are some people you might want to follow: ${suggestions.map((s) => `${s.displayName} (@${s.username})`).join(", ")}. Want me to follow any of them for you?`
              : "I couldn't find any new suggestions right now. Try exploring different communities!",
            data: { suggestions },
            mood: suggestions.length > 0 ? "excited" : "thinking",
          });
        }

        if (suggestionType === "communities") {
          const commSuggestions = await prisma.community.findMany({
            where: {
              // Only ever suggest PUBLIC communities — a private (invite-only)
              // community's existence, name, description and size must not leak
              // to a non-member, matching getTrendingCommunities / searchAll and
              // the sibling "suggest people" discovery gate above.
              isPublic: true,
              NOT: {
                members: { some: { userId: user.id } },
              },
            },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              _count: { select: { members: true } },
            },
            orderBy: { members: { _count: "desc" } },
            take: 5,
          });

          return NextResponse.json({
            success: true,
            message: commSuggestions.length > 0
              ? `Check out these communities: ${commSuggestions.map((c) => `${c.name} (${c._count.members} members)`).join(", ")}. Want to join any?`
              : "No new communities to suggest right now. Maybe create your own?",
            data: { suggestions: commSuggestions },
            mood: commSuggestions.length > 0 ? "excited" : "thinking",
          });
        }

        return NextResponse.json({
          success: true,
          message: "What kind of suggestions would you like? I can suggest people to follow, communities to join, or content to explore!",
          mood: "happy",
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Meshi action error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
