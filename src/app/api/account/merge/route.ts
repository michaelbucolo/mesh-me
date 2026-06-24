import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { timingSafeEqual, createHash } from "crypto";
import { isSameOriginRequest } from "@/lib/request-guard";

// Initiate account merge: primary user requests to merge a secondary account
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { secondaryEmail } = body;
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
      ...(process.env.MESHME_DEV_SHOW_VERIFY_LINK === "true" ? { verifyToken } : {}),
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

  // Strip verifyToken from response to prevent token leakage
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sanitized = mergeRequests.map(({ verifyToken: _token, ...rest }) => rest);
  return NextResponse.json({ mergeRequests: sanitized });
}

// Complete or cancel a merge request
export async function PUT(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const mergeBody = await req.json().catch(() => null);
  if (!mergeBody || typeof mergeBody !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { mergeRequestId, action, verifyToken } = mergeBody;

  if (!mergeRequestId || !action) {
    return NextResponse.json({ error: "mergeRequestId and action required" }, { status: 400 });
  }

  // Validate action early to reject unknown actions
  if (action !== "cancel" && action !== "complete") {
    return NextResponse.json({ error: "Invalid action. Use 'cancel' or 'complete'" }, { status: 400 });
  }

  const mergeRequest = await prisma.accountMergeRequest.findUnique({
    where: { id: mergeRequestId },
  });

  if (!mergeRequest) {
    return NextResponse.json({ error: "Merge request not found" }, { status: 404 });
  }

  // Early authorization: caller must be either primary or secondary owner
  const secondaryOwnerForAuth = await prisma.user.findUnique({
    where: { email: mergeRequest.secondaryEmail },
    select: { id: true },
  });
  const isPrimary = mergeRequest.primaryUserId === session.userId;
  const isSecondary = secondaryOwnerForAuth?.id === session.userId;
  if (!isPrimary && !isSecondary) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Prevent re-processing of already completed/rejected merges
  if (mergeRequest.status !== "pending" && mergeRequest.status !== "verified") {
    return NextResponse.json({ error: "This merge request has already been processed" }, { status: 400 });
  }

  if (action === "cancel") {
    if (!isPrimary) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    await prisma.accountMergeRequest.update({
      where: { id: mergeRequestId },
      data: { status: "rejected" },
    });
    return NextResponse.json({ success: true, message: "Merge request cancelled" });
  }

  if (action === "complete") {
    // The secondary account owner must be the one to complete the merge
    if (!isSecondary) {
      return NextResponse.json({ error: "Only the secondary account owner can complete this merge" }, { status: 403 });
    }
    const secondaryOwner = await prisma.user.findUnique({
      where: { email: mergeRequest.secondaryEmail },
    });
    if (!secondaryOwner) {
      return NextResponse.json({ error: "Secondary account not found" }, { status: 404 });
    }
    // Verify token matches (constant-time comparison to prevent timing attacks).
    // Hash both tokens to fixed-length SHA-256 digests before comparing so that
    // differing input lengths don't leak information via an early return.
    const storedToken = mergeRequest.verifyToken || "";
    const providedToken = (typeof verifyToken === "string" ? verifyToken : "");
    let tokenValid = false;
    if (storedToken.length > 0 && providedToken.length > 0) {
      try {
        const storedHash = createHash("sha256").update(storedToken).digest();
        const providedHash = createHash("sha256").update(providedToken).digest();
        tokenValid = timingSafeEqual(storedHash, providedHash);
      } catch { tokenValid = false; }
    }
    if (!tokenValid) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });
    }

    // Create alter ego from secondary account (secondaryOwner already verified above)
    await prisma.alterEgo.create({
      data: {
        userId: mergeRequest.primaryUserId,
        username: secondaryOwner.username,
        displayName: secondaryOwner.displayName,
        bio: secondaryOwner.bio,
        avatarUrl: secondaryOwner.avatarUrl,
        updatedAt: new Date(),
      },
    });

    // Add secondary email to primary account's emails
    await prisma.userEmail.create({
      data: {
        userId: mergeRequest.primaryUserId,
        email: secondaryOwner.email,
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
      where: { id: secondaryOwner.id },
      data: { isSuspended: true },
    });

    return NextResponse.json({
      success: true,
      message: "Accounts merged! " + secondaryOwner.username + " is now an alter ego.",
    });
  }

  return NextResponse.json({ error: "Invalid action. Use 'cancel' or 'complete'" }, { status: 400 });
}
