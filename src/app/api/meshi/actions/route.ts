import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { canUserInteractWithPost } from "@/lib/privacy-policy";
import { classifyContentSafety } from "@/lib/content-safety";
import { rateLimit, sanitizeForDisplay } from "@/lib/security";

// Meshi Vessel Actions — Meshi can act on behalf of the user
// These are explicit user-triggered actions through the Meshi interface

type MeshiAction = "post" | "message" | "follow" | "unfollow" | "react" | "suggest";

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
  // For "react"
  postId?: string;
  reactionType?: string;
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
    if (action !== "suggest") {
      const rl = rateLimit(`meshi-actions:${user.id}`, 30, 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json({ error: "Meshi is acting too fast. Please slow down." }, { status: 429 });
      }
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

        // Check for blocks
        const blockExists = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: user.id, blockedId: body.recipientId },
              { blockerId: body.recipientId, blockedId: user.id },
            ],
          },
        });
        if (blockExists) {
          return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });
        }

        // Find or create thread
        let thread = await prisma.messageThread.findFirst({
          where: {
            AND: [
              { members: { some: { userId: user.id } } },
              { members: { some: { userId: body.recipientId } } },
            ],
          },
          include: { members: true },
        });

        if (!thread) {
          thread = await prisma.messageThread.create({
            data: {
              members: {
                create: [
                  { userId: user.id },
                  { userId: body.recipientId },
                ],
              },
            },
            include: { members: true },
          });
        }

        await prisma.message.create({
          data: {
            content: body.messageContent.trim(),
            senderId: user.id,
            threadId: thread.id,
          },
        });

        // Update thread timestamp
        await prisma.messageThread.update({
          where: { id: thread.id },
          data: { updatedAt: new Date() },
        });

        revalidatePath("/messages");
        return NextResponse.json({
          success: true,
          message: `Message sent to ${recipient.displayName}!`,
          data: { threadId: thread.id, recipientName: recipient.displayName },
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
