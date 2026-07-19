// Verification for Meta's `signed_request` payload.
//
// Meta (Facebook, Instagram, Threads) POSTs a `signed_request` to the app's
// Deauthorize and Data Deletion callback URLs. The value has the shape
// `<base64url signature>.<base64url payload>` where the signature is
// HMAC-SHA256 of the *encoded* payload string, keyed by the app secret.
//
// Meta apps for these three products may be provisioned separately, so we
// verify against every Meta app secret that is configured and report which
// one matched.

import { createHmac, timingSafeEqual } from "crypto";
import { resolveEnvValue } from "./oauth";

interface MetaSignedRequestPayload {
  algorithm?: string;
  issued_at?: number;
  user_id?: string;
  [key: string]: unknown;
}

export interface VerifiedMetaSignedRequest {
  payload: MetaSignedRequestPayload;
  userId: string;
}

// Env vars that may hold a Meta app secret, keyed by the products they cover.
// Threads falls back to the Facebook app secret via its aliases, matching the
// OAuth config in `oauth.ts`.
const META_SECRET_ENV: Array<{ primary: string; aliases: string[] }> = [
  { primary: "FACEBOOK_APP_SECRET", aliases: ["FACEBOOK_CLIENT_SECRET"] },
  { primary: "INSTAGRAM_APP_SECRET", aliases: ["INSTAGRAM_CLIENT_SECRET"] },
  { primary: "THREADS_CLIENT_SECRET", aliases: ["THREADS_APP_SECRET"] },
];

export function getConfiguredMetaAppSecrets(): string[] {
  const secrets = new Set<string>();
  for (const { primary, aliases } of META_SECRET_ENV) {
    const value = resolveEnvValue(primary, aliases);
    if (value) secrets.add(value);
  }
  return [...secrets];
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function signatureMatches(encodedPayload: string, expectedSig: Buffer, secret: string): boolean {
  const actual = createHmac("sha256", secret).update(encodedPayload).digest();
  return actual.length === expectedSig.length && timingSafeEqual(actual, expectedSig);
}

// Parse and cryptographically verify a Meta `signed_request`. Returns null when
// the format is malformed, no configured secret validates the signature, or the
// payload does not identify a user.
export function verifyMetaSignedRequest(
  signedRequest: string | null | undefined,
  secrets: string[] = getConfiguredMetaAppSecrets(),
): VerifiedMetaSignedRequest | null {
  if (!signedRequest || typeof signedRequest !== "string" || secrets.length === 0) {
    return null;
  }

  const dot = signedRequest.indexOf(".");
  if (dot <= 0 || dot === signedRequest.length - 1) return null;

  const encodedSig = signedRequest.slice(0, dot);
  const encodedPayload = signedRequest.slice(dot + 1);

  let expectedSig: Buffer;
  let payload: MetaSignedRequestPayload;
  try {
    expectedSig = base64UrlDecode(encodedSig);
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }

  if (expectedSig.length === 0) return null;
  if (payload.algorithm && payload.algorithm.toUpperCase().replace("-", "") !== "HMACSHA256") {
    return null;
  }

  const verified = secrets.some((secret) => signatureMatches(encodedPayload, expectedSig, secret));
  if (!verified) return null;

  const userId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
  if (!userId) return null;

  return { payload, userId };
}
