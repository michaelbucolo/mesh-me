import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

// Initiate account merge: primary user requests to merge a secondary account
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { secondaryEmail } = await req.json();
  if (!secondaryEmail || typeof secondaryEmail !== "string" || !secondaryEmail.includes("@")) {
    return NextResponse.json({ error: "Valid email of the account to merge is required" }, { status: 400 });
  }

  const normalized = secondaryEmail.toLowerCase().trim();

  // Verify the secondary account exists
  const secondaryUser = await prisma.user.findUnique({ where: { email: normalized } });
  if (!secondaryUser) {
    return NextResponse.json({ error: "No account found with that email" }, { status: 404 });
  }

  // Can't merge with yourself
  if (secondaryUser.id === session.userId) {
    return NextResponse.json({ error: "Cannot merge your own account with itself" }, { status: 400 });
  }

  // Check for existing pending merge request
  const existingRequest = await prisma.accountMergeRequest.findFirst({
    where: {
      primaryUserId: session.userId,
      secondaryEmail: normalized,
      status: "pending",
    },
  });
  if (existingRequest) {
    return NextResponse.json({ error: "A merge request is already pending for this account" }, { status: 409 });
  }

  const verifyToken = uuidv4();

  const mergeRequest = await prisma.accountMergeRequest.create({
    data: {
      primaryUserId: session.userId,
      secondaryEmail: normalized,
      status: "pending",
      verifyToken,
    },
  });

  // In production: send verification email to secondaryEmail with the token
  // For now, return the merge request ID (verification will be manual)

  return NextResponse.json({
    mergeRequest: {
      id: mergeRequest.id,
      secondaryEmail: normalized,
      status: "pending",
      message: "Verification email sent to " + normalized + ". The account owner must verify to complete the merge.",
    },
  });
}

// Get merge requests for current user
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const mergeRequests = await prisma.accountMergeRequest.findMany({
    where: { primaryUserId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ mergeRequests });
}

// Complete or cancel a merge request
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { mergeRequestId, action, verifyToken } = await req.json();

  if (!mergeRequestId || !action) {
    return NextResponse.json({ error: "mergeRequestId and action required" }, { status: 400 });
  }

  const mergeRequest = await prisma.accountMergeRequest.findUnique({
    where: { id: mergeRequestId },
  });

  if (!mergeRequest) {
    return NextResponse.json({ error: "Merge request not found" }, { status: 404 });
  }

  if (action === "cancel") {
    if (mergeRequest.primaryUserId !== session.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    await prisma.accountMergeRequest.update({
      where: { id: mergeRequestId },
      data: { status: "rejected" },
    });
    return NextResponse.json({ success: true, message: "Merge request cancelled" });
  }

  if (action === "complete") {
    // Verify the requesting user owns this merge request
    if (mergeRequest.primaryUserId !== session.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    // Verify token matches
    if (mergeRequest.verifyToken !== verifyToken) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });
    }

    // Find the secondary user
    const secondaryUser = await prisma.user.findUnique({
      where: { email: mergeRequest.secondaryEmail },
    });
    if (!secondaryUser) {
      return NextResponse.json({ error: "Secondary account no longer exists" }, { status: 404 });
    }

    // Create alter ego from secondary account
    await prisma.alterEgo.create({
      data: {
        userId: mergeRequest.primaryUserId,
        username: secondaryUser.username,
        displayName: secondaryUser.displayName,
        bio: secondaryUser.bio,
        avatarUrl: secondaryUser.avatarUrl,
        updatedAt: new Date(),
      },
    });

    // Add secondary email to primary account's emails
    await prisma.userEmail.create({
      data: {
        userId: mergeRequest.primaryUserId,
        email: secondaryUser.email,
        isPrimary: false,
        isVerified: true,
      },
    }).catch(() => {
      // Email might already be in the emails table
    });

    // Mark merge as completed
    await prisma.accountMergeRequest.update({
      where: { id: mergeRequestId },
      data: { status: "completed", completedAt: new Date() },
    });

    // Suspend the secondary account (don't delete — preserve data)
    await prisma.user.update({
      where: { id: secondaryUser.id },
      data: { isSuspended: true },
    });

    return NextResponse.json({
      success: true,
      message: "Accounts merged! " + secondaryUser.username + " is now an alter ego.",
    });
  }

  return NextResponse.json({ error: "Invalid action. Use 'cancel' or 'complete'" }, { status: 400 });
}
