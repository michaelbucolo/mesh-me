import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizeUsState, type AdultVerificationStatus } from "@/lib/content-safety";
import { prisma } from "@/lib/prisma";

const allowedStatuses = new Set<AdultVerificationStatus>(["verified", "rejected", "expired", "pending"]);

// Webhook payloads are tiny JSON documents; bound the raw read (even when
// Content-Length is absent) so an unauthenticated caller can't stream an
// arbitrarily large body into memory before signature verification runs.
const MAX_WEBHOOK_BODY_BYTES = 32 * 1024;

async function readBoundedBody(request: NextRequest): Promise<string | null> {
  const header = request.headers.get("content-length");
  if (header) {
    const length = Number.parseInt(header, 10);
    if (Number.isFinite(length) && length > MAX_WEBHOOK_BODY_BYTES) return null;
  }

  const body = request.body;
  if (!body) {
    const text = await request.text();
    return new TextEncoder().encode(text).byteLength > MAX_WEBHOOK_BODY_BYTES ? null : text;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

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

  const rawBody = await readBoundedBody(request);
  if (rawBody === null) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }
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
