import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { emailClaimHeldBy } from "@/lib/email-claim";

const MAX_EMAILS_PER_ACCOUNT = 10;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const emails = await prisma.userEmail.findMany({
    where: { userId: session.userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ emails });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Unverified additions reserve the global UserEmail.email namespace, so cap
  // the rate and count to blunt namespace-squatting from a single account.
  const limit = rateLimit(`account-email-add:${session.userId}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many email additions. Please try again later." }, { status: 429 });
  }

  const body = await readJsonObject(req);
  const { email } = body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();

  const emailCount = await prisma.userEmail.count({ where: { userId: session.userId } });
  if (emailCount >= MAX_EMAILS_PER_ACCOUNT) {
    return NextResponse.json({ error: "You've reached the maximum number of emails on this account." }, { status: 409 });
  }

  // Refuses on ANY existing row, including an unverified one — deliberately the
  // read-only half of the claim rule, not the clearing half.
  //
  // Signup and federated sign-in DO clear an unverified reservation, because
  // there the person is establishing an account or has had the address asserted
  // by Google/Apple, and a bare secondary row must not outrank that. Here nobody
  // is proving anything either: this endpoint writes `isVerified: false` with no
  // token. Letting it displace someone else's pending row would only make the
  // squatting mutual, so it keeps its 409 and the address is settled by whoever
  // completes verification.
  if (await emailClaimHeldBy(normalized, session.userId)) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  let userEmail;
  try {
    userEmail = await prisma.userEmail.create({
      data: {
        userId: session.userId,
        email: normalized,
        isPrimary: false,
        isVerified: false,
      },
    });
  } catch (error) {
    // Lost the race between the pre-check and the insert: return a clean 409
    // instead of letting the raw unique-constraint error escape as a 500.
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ email: userEmail });
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const deleteBody = await readJsonObject(req);
  const { emailId } = deleteBody;
  if (!emailId || typeof emailId !== "string") return NextResponse.json({ error: "emailId required" }, { status: 400 });

  // Don't allow deleting primary email
  const emailRecord = await prisma.userEmail.findUnique({ where: { id: emailId } });
  if (!emailRecord || emailRecord.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (emailRecord.isPrimary) {
    return NextResponse.json({ error: "Cannot remove primary email" }, { status: 400 });
  }

  await prisma.userEmail.delete({ where: { id: emailId } });
  return NextResponse.json({ success: true });
}
