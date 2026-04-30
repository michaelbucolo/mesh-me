import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizeUsState, type AdultVerificationStatus } from "@/lib/content-safety";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set<AdultVerificationStatus>(["verified", "rejected", "expired", "pending"]);

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/i, "");

  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: NextRequest) {
  const secret = process.env.ADULT_VERIFICATION_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Adult verification webhook is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-mesh-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid payload");
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(payload.client_reference_id ?? payload.userId ?? "").trim();
  const status = String(payload.status ?? "").trim().toLowerCase() as AdultVerificationStatus;
  if (!userId || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Missing user or unsupported verification status" }, { status: 400 });
  }

  const expiresAt = parseDate(payload.expires_at ?? payload.expiresAt);
  const region = normalizeUsState(String(payload.region ?? ""));
  const provider = String(payload.provider ?? "external-provider").slice(0, 80);
  const reference = String(payload.verification_reference ?? payload.reference ?? "").slice(0, 160);
  const verified = status === "verified";

  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: {
      adultVerificationStatus: status,
      adultVerifiedAt: verified ? new Date() : null,
      adultVerificationExpiresAt: verified ? expiresAt : null,
      adultVerificationProvider: provider,
      adultVerificationRegion: region || null,
      adultVerificationReference: reference || null,
      nsfwEnabled: false,
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, status });
}
