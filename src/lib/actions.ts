"use server";

import { prisma } from "./prisma";
import { getCurrentUser, hashPassword, createSession, destroySession, verifyPassword } from "./auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { slugify } from "./utils";

// ─── Auth Actions ────────────────────────────────────────────

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;
  const displayName = formData.get("displayName") as string;

  if (!email || !password || !username || !displayName) {
    return { error: "All fields are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: "Username can only contain letters, numbers, and underscores" };
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    return { error: existing.email === email ? "Email already in use" : "Username already taken" };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      username: username.toLowerCase(),
      displayName,
      passwordHash,
    },
  });

  await createSession(user.id);
  redirect("/onboarding");
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return { error: "Invalid email or password" };
  }

  if (user.isSuspended) {
    return { error: "Your account has been suspended" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);

  if (!user.onboarded) {
    redirect("/onboarding");
  }

  redirect("/feed");
}

export async function signOut() {
  await destroySession();
  redirect("/");
}

// ─── Onboarding Actions ──────────────────────────────────────

export async function completeOnboarding(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bio = formData.get("bio") as string;
  const location = formData.get("location") as string;
  const interests = formData.getAll("interests") as string[];

  await prisma.user.update({
    where: { id: user.id },
    data: {
      bio: bio || undefined,
      location: location || undefined,
      onboarded: true,
    },
  });

  if (interests.length > 0) {
    await prisma.userInterest.createMany({
      data: interests.map((tag) => ({ userId: user.id, tag })),
    });
  }

  redirect("/feed");
}

// ─── Post Actions ────────────────────────────────────────────

export async function createPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const content = formData.get("content") as string;
  const communityId = formData.get("communityId") as string | null;
  const tags = formData.get("tags") as string;

  if (!content?.trim()) {
    return { error: "Post content is required" };
  }

  const post = await prisma.post.create({
    data: {
      content: content.trim(),
      authorId: user.id,
      communityId: communityId || undefined,
    },
  });

  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 0) {
      await prisma.postTag.createMany({
        data: tagList.map((tag) => ({ postId: post.id, tag })),
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/profile/${user.username}`);
  if (communityId) revalidatePath(`/communities/${communityId}`);

  return { success: true, postId: post.id };
}

export async function deletePost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found" };
  if (post.authorId !== user.id && !user.isAdmin) return { error: "Unauthorized" };

  await prisma.post.delete({ where: { id: postId } });
  revalidatePath("/feed");
  return { success: true };
}

// ─── Reaction Actions ────────────────────────────────────────

export async function toggleReaction(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const existing = await prisma.reaction.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({
      data: { userId: user.id, postId, type: "like" },
    });

    // Create notification
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (post && post.authorId !== user.id) {
      await prisma.notification.create({
        data: {
          type: "like",
          recipientId: post.authorId,
          actorId: user.id,
          postId,
          message: `${user.displayName} liked your post`,
        },
      });
    }
  }

  revalidatePath("/feed");
  return { success: true, liked: !existing };
}

// ─── Comment Actions ─────────────────────────────────────────

export async function createComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const content = formData.get("content") as string;
  const postId = formData.get("postId") as string;
  const parentId = formData.get("parentId") as string | null;

  if (!content?.trim() || !postId) {
    return { error: "Comment content is required" };
  }

  await prisma.comment.create({
    data: {
      content: content.trim(),
      authorId: user.id,
      postId,
      parentId: parentId || undefined,
    },
  });

  // Create notification
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (post && post.authorId !== user.id) {
    await prisma.notification.create({
      data: {
        type: "comment",
        recipientId: post.authorId,
        actorId: user.id,
        postId,
        message: `${user.displayName} commented on your post`,
      },
    });
  }

  revalidatePath("/feed");
  return { success: true };
}

// ─── Follow Actions ──────────────────────────────────────────

export async function toggleFollow(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === targetUserId) return { error: "Cannot follow yourself" };

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({
      data: { followerId: user.id, followingId: targetUserId },
    });

    await prisma.notification.create({
      data: {
        type: "follow",
        recipientId: targetUserId,
        actorId: user.id,
        message: `${user.displayName} started following you`,
      },
    });
  }

  revalidatePath("/feed");
  return { success: true, following: !existing };
}

// ─── Profile Actions ─────────────────────────────────────────

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const displayName = formData.get("displayName") as string;
  const bio = formData.get("bio") as string;
  const location = formData.get("location") as string;
  const website = formData.get("website") as string;
  const accentColor = formData.get("accentColor") as string;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: displayName || user.displayName,
      bio: bio ?? user.bio,
      location: location ?? user.location,
      website: website ?? user.website,
      accentColor: accentColor || user.accentColor,
    },
  });

  revalidatePath(`/profile/${user.username}`);
  revalidatePath("/settings");
  return { success: true };
}

// ─── Community Actions ───────────────────────────────────────

export async function createCommunity(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const rules = formData.get("rules") as string;

  if (!name?.trim()) {
    return { error: "Community name is required" };
  }

  const slug = slugify(name);

  const existing = await prisma.community.findFirst({
    where: { OR: [{ name }, { slug }] },
  });

  if (existing) {
    return { error: "A community with that name already exists" };
  }

  const community = await prisma.community.create({
    data: {
      name: name.trim(),
      slug,
      description: description || undefined,
      category: category || undefined,
      rules: rules || undefined,
    },
  });

  // Creator becomes admin
  await prisma.communityMember.create({
    data: {
      userId: user.id,
      communityId: community.id,
      role: "admin",
    },
  });

  revalidatePath("/communities");
  return { success: true, communityId: community.id };
}

export async function toggleCommunityMembership(communityId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const existing = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (existing) {
    if (existing.role === "admin") {
      return { error: "Admins cannot leave their community" };
    }
    await prisma.communityMember.delete({ where: { id: existing.id } });
  } else {
    await prisma.communityMember.create({
      data: { userId: user.id, communityId },
    });
  }

  revalidatePath("/communities");
  revalidatePath(`/communities/${communityId}`);
  return { success: true, joined: !existing };
}

// ─── Message Actions ─────────────────────────────────────────

export async function sendMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const content = formData.get("content") as string;
  const threadId = formData.get("threadId") as string;
  const recipientId = formData.get("recipientId") as string;

  if (!content?.trim()) return { error: "Message is required" };

  let finalThreadId = threadId;

  if (!finalThreadId && recipientId) {
    // Find or create thread
    const existingThread = await prisma.messageThread.findFirst({
      where: {
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: recipientId } } },
        ],
      },
    });

    if (existingThread) {
      finalThreadId = existingThread.id;
    } else {
      const thread = await prisma.messageThread.create({
        data: {
          members: {
            create: [
              { userId: user.id },
              { userId: recipientId },
            ],
          },
        },
      });
      finalThreadId = thread.id;
    }
  }

  if (!finalThreadId) return { error: "No thread specified" };

  await prisma.message.create({
    data: {
      content: content.trim(),
      senderId: user.id,
      threadId: finalThreadId,
    },
  });

  await prisma.messageThread.update({
    where: { id: finalThreadId },
    data: { updatedAt: new Date() },
  });

  // Create notification for recipient
  const threadMembers = await prisma.threadMember.findMany({
    where: { threadId: finalThreadId, userId: { not: user.id } },
  });

  for (const member of threadMembers) {
    await prisma.notification.create({
      data: {
        type: "message",
        recipientId: member.userId,
        actorId: user.id,
        message: `${user.displayName} sent you a message`,
      },
    });
  }

  revalidatePath("/messages");
  return { success: true, threadId: finalThreadId };
}

// ─── Notification Actions ────────────────────────────────────

export async function markNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  await prisma.notification.updateMany({
    where: { recipientId: user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/notifications");
  return { success: true };
}

// ─── Report Actions ──────────────────────────────────────────

export async function createReport(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const reason = formData.get("reason") as string;
  const reportedUserId = formData.get("reportedUserId") as string | null;
  const reportedPostId = formData.get("reportedPostId") as string | null;

  if (!reason?.trim()) return { error: "Reason is required" };

  await prisma.report.create({
    data: {
      reason: reason.trim(),
      reporterId: user.id,
      reportedUserId: reportedUserId || undefined,
      reportedPostId: reportedPostId || undefined,
    },
  });

  return { success: true };
}

// ─── Block/Mute Actions ─────────────────────────────────────

export async function toggleBlock(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId } },
  });

  if (existing) {
    await prisma.block.delete({ where: { id: existing.id } });
  } else {
    await prisma.block.create({
      data: { blockerId: user.id, blockedId: targetUserId },
    });
    // Also unfollow
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: user.id, followingId: targetUserId },
          { followerId: targetUserId, followingId: user.id },
        ],
      },
    });
  }

  revalidatePath("/settings");
  return { success: true, blocked: !existing };
}

// ─── Save Post Actions ───────────────────────────────────────

export async function toggleSavePost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const existing = await prisma.savedPost.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing) {
    await prisma.savedPost.delete({ where: { id: existing.id } });
  } else {
    await prisma.savedPost.create({
      data: { userId: user.id, postId },
    });
  }

  revalidatePath("/feed");
  return { success: true, saved: !existing };
}

// ─── Admin Actions ───────────────────────────────────────────

export async function adminSuspendUser(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Unauthorized" };

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return { error: "User not found" };

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isSuspended: !target.isSuspended },
  });

  await prisma.adminLog.create({
    data: {
      action: target.isSuspended ? "unsuspend_user" : "suspend_user",
      details: `User: ${target.username}`,
      adminId: user.id,
    },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function adminResolveReport(reportId: string, status: string) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Unauthorized" };

  await prisma.report.update({
    where: { id: reportId },
    data: { status },
  });

  await prisma.adminLog.create({
    data: {
      action: `resolve_report_${status}`,
      details: `Report: ${reportId}`,
      adminId: user.id,
    },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function adminDeletePost(postId: string) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Unauthorized" };

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found" };

  await prisma.post.delete({ where: { id: postId } });

  await prisma.adminLog.create({
    data: {
      action: "delete_post",
      details: `Post: ${postId}`,
      adminId: user.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/feed");
  return { success: true };
}

// ─── Mute Actions ───────────────────────────────────────────

export async function toggleMute(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const existing = await prisma.mute.findUnique({
    where: { muterId_mutedId: { muterId: user.id, mutedId: targetUserId } },
  });

  if (existing) {
    await prisma.mute.delete({ where: { id: existing.id } });
  } else {
    await prisma.mute.create({
      data: { muterId: user.id, mutedId: targetUserId },
    });
  }

  revalidatePath("/settings");
  return { success: true, muted: !existing };
}

// ─── Repost Actions ─────────────────────────────────────────

export async function repost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const original = await prisma.post.findUnique({ where: { id: postId } });
  if (!original) return { error: "Post not found" };

  // Check if already reposted
  const existing = await prisma.post.findFirst({
    where: { authorId: user.id, repostId: postId, isRepost: true },
  });

  if (existing) {
    await prisma.post.delete({ where: { id: existing.id } });
    revalidatePath("/feed");
    return { success: true, reposted: false };
  }

  await prisma.post.create({
    data: {
      content: original.content,
      authorId: user.id,
      isRepost: true,
      repostId: postId,
      communityId: original.communityId,
    },
  });

  if (original.authorId !== user.id) {
    await prisma.notification.create({
      data: {
        type: "repost",
        recipientId: original.authorId,
        actorId: user.id,
        postId,
        message: `${user.displayName} reposted your post`,
      },
    });
  }

  revalidatePath("/feed");
  return { success: true, reposted: true };
}

// ─── Pin Post Actions ───────────────────────────────────────

export async function togglePinPost(postId: string, communityId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (!membership || (membership.role !== "admin" && membership.role !== "moderator")) {
    return { error: "Only moderators can pin posts" };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found" };

  await prisma.post.update({
    where: { id: postId },
    data: { isPinned: !post.isPinned },
  });

  revalidatePath(`/communities/${communityId}`);
  return { success: true, pinned: !post.isPinned };
}

// ─── Password Actions ───────────────────────────────────────

export async function changePassword(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required" };
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect" };
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return { success: true };
}

// ─── Account Actions ────────────────────────────────────────

export async function deleteAccount() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/");
}

// ─── Privacy Actions ────────────────────────────────────────

export async function updatePrivacy(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const isPublic = formData.get("isPublic") === "true";

  await prisma.user.update({
    where: { id: user.id },
    data: { isPublic },
  });

  revalidatePath("/settings");
  return { success: true };
}

// ─── Community Moderation ───────────────────────────────────

export async function updateCommunity(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const communityId = formData.get("communityId") as string;
  const description = formData.get("description") as string;
  const rules = formData.get("rules") as string;
  const category = formData.get("category") as string;

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (!membership || membership.role !== "admin") {
    return { error: "Only admins can edit community settings" };
  }

  await prisma.community.update({
    where: { id: communityId },
    data: {
      description: description ?? undefined,
      rules: rules ?? undefined,
      category: category ?? undefined,
    },
  });

  revalidatePath("/communities");
  return { success: true };
}

export async function promoteMember(userId: string, communityId: string, role: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (!membership || membership.role !== "admin") {
    return { error: "Only admins can change roles" };
  }

  await prisma.communityMember.update({
    where: { userId_communityId: { userId, communityId } },
    data: { role },
  });

  revalidatePath(`/communities/${communityId}`);
  return { success: true };
}

export async function removeMember(userId: string, communityId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (!membership || (membership.role !== "admin" && membership.role !== "moderator")) {
    return { error: "Only moderators can remove members" };
  }

  const target = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId } },
  });

  if (target?.role === "admin") {
    return { error: "Cannot remove admins" };
  }

  await prisma.communityMember.delete({
    where: { userId_communityId: { userId, communityId } },
  });

  revalidatePath(`/communities/${communityId}`);
  return { success: true };
}

// ─── Delete Comment ─────────────────────────────────────────

export async function deleteComment(commentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return { error: "Comment not found" };
  if (comment.authorId !== user.id && !user.isAdmin) return { error: "Unauthorized" };

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath("/feed");
  return { success: true };
}

// ─── User Links Actions ─────────────────────────────────────

export async function updateUserLinks(links: { label: string; url: string }[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  // Remove existing links
  await prisma.userLink.deleteMany({ where: { userId: user.id } });

  // Create new links
  if (links.length > 0) {
    await prisma.userLink.createMany({
      data: links.map((link) => ({
        userId: user.id,
        label: link.label,
        url: link.url,
      })),
    });
  }

  revalidatePath(`/profile/${user.username}`);
  revalidatePath("/settings");
  return { success: true };
}

// ─── User Interests Actions ─────────────────────────────────

export async function updateUserInterests(interests: string[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  await prisma.userInterest.deleteMany({ where: { userId: user.id } });

  if (interests.length > 0) {
    await prisma.userInterest.createMany({
      data: interests.map((tag) => ({ userId: user.id, tag })),
    });
  }

  revalidatePath(`/profile/${user.username}`);
  revalidatePath("/settings");
  return { success: true };
}
