import "server-only";
import { createDecipheriv } from "node:crypto";

const KEY_SOURCES = ["APP_DATA_ENCRYPTION_KEY", "MESHME_TOKEN_ENCRYPTION_KEY", "MESHME_SECRET_KEY"] as const;
type KeySource = (typeof KEY_SOURCES)[number];
const PLACEHOLDERS = new Set(["change-me-please", "change-me-to-a-long-random-secret", "replace-me-with-a-long-random-secret"]);
type Transformation = "Configured value" | "One surrounding quote pair removed" | "Trailing literal newline removed" | "Quote pair and trailing literal newline removed";
type AuthenticationCounts = { authenticated: number; failed: number };

export type CredentialRecoveryDiagnostic = {
  status: "not_scanned";
  reason: string;
} | {
  status: "complete";
  ciphertexts: number;
  structurallyValid: number;
  malformed: number;
  currentKey: AuthenticationCounts & { source: KeySource | null; usable: boolean };
  candidates: Array<AuthenticationCounts & { source: KeySource; transformation: Transformation }>;
};

// Match secret-store's production parser, including existing permissive
// base64 behavior. Diagnostics never derive keys from passphrases.
function currentProductionKey(raw: string): Buffer | null {
  const value = raw.trim();
  if (!value || PLACEHOLDERS.has(value)) return null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  const base64 = Buffer.from(value, "base64");
  if (base64.length === 32) return base64;
  base64.fill(0);
  const text = Buffer.from(value, "utf8");
  if (text.length === 32) return text;
  text.fill(0);
  return null;
}

function canonicalCandidateKey(raw: string): Buffer | null {
  const value = raw.trim();
  if (!value || PLACEHOLDERS.has(value)) return null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  if (/^[A-Za-z0-9+/_-]{43}=?$/.test(value)) {
    const key = Buffer.from(value, "base64");
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=$/, "");
    if (key.length === 32 && key.toString("base64").replace(/=$/, "") === normalized) return key;
    key.fill(0);
  }
  const text = Buffer.from(value, "utf8");
  if (text.length === 32) return text;
  text.fill(0);
  return null;
}

function removeQuotePair(value: string): string | null {
  return value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ? value.slice(1, -1) : null;
}

function removeLiteralNewline(value: string): string | null {
  const result = value.replace(/(?:\\r\\n|\\n|\\r)$/, "");
  return result === value ? null : result;
}

function formattingCandidates(raw: string): Array<{ value: string; transformation: Transformation }> {
  const value = raw.trim();
  const unquoted = removeQuotePair(value);
  const withoutNewline = removeLiteralNewline(value);
  const combined = (unquoted === null ? null : removeLiteralNewline(unquoted))
    ?? (withoutNewline === null ? null : removeQuotePair(withoutNewline));
  return [
    { value, transformation: "Configured value" as const },
    ...(unquoted === null ? [] : [{ value: unquoted, transformation: "One surrounding quote pair removed" as const }]),
    ...(withoutNewline === null ? [] : [{ value: withoutNewline, transformation: "Trailing literal newline removed" as const }]),
    ...(combined === null ? [] : [{ value: combined, transformation: "Quote pair and trailing literal newline removed" as const }]),
  ];
}

function parseEnvelope(value: string) {
  const parts = value.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") return null;
  const [, , ivRaw, tagRaw, ciphertextRaw] = parts;
  if (ivRaw.length !== 16 || tagRaw.length !== 22 || !ciphertextRaw) return null;
  if (![ivRaw, tagRaw, ciphertextRaw].every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const iv = Buffer.from(ivRaw, "base64url");
  const tag = Buffer.from(tagRaw, "base64url");
  const ciphertext = Buffer.from(ciphertextRaw, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0 ||
      iv.toString("base64url") !== ivRaw || tag.toString("base64url") !== tagRaw || ciphertext.toString("base64url") !== ciphertextRaw) return null;
  return { iv, tag, ciphertext };
}

function authenticates(envelope: NonNullable<ReturnType<typeof parseEnvelope>>, key: Buffer): boolean {
  let plaintext: Buffer | undefined;
  let final: Buffer | undefined;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, envelope.iv);
    decipher.setAuthTag(envelope.tag);
    plaintext = decipher.update(envelope.ciphertext);
    final = decipher.final();
    return true;
  } catch {
    return false;
  } finally {
    plaintext?.fill(0);
    final?.fill(0);
  }
}

// Called only after the audit enforces scan limits. No key or plaintext leaves
// this helper. At most four candidates per configured variable are considered;
// equivalent keys are deduplicated. Runtime configuration remains unchanged.
export function diagnoseCredentialCiphertexts(payloads: readonly string[]): CredentialRecoveryDiagnostic {
  const configured = KEY_SOURCES.map((source) => ({ source, raw: process.env[source] ?? "" }));
  if (configured.some(({ raw }) => raw.length > 512)) {
    return { status: "not_scanned", reason: "Configured key values exceed diagnostic limits. No key candidates were tested." };
  }
  const effective = configured.find(({ raw }) => Boolean(raw));
  const currentKey = effective ? currentProductionKey(effective.raw) : null;
  const candidates: Array<{ source: KeySource; transformation: Transformation; key: Buffer; authenticated: number; failed: number }> = [];
  try {
    for (const { source, raw } of configured) {
      if (!raw) continue;
      for (const candidate of formattingCandidates(raw)) {
        const key = canonicalCandidateKey(candidate.value);
        if (!key) continue;
        if (currentKey?.equals(key) || candidates.some((existing) => existing.key.equals(key))) { key.fill(0); continue; }
        candidates.push({ source, transformation: candidate.transformation, key, authenticated: 0, failed: 0 });
      }
    }
    const current = { source: effective?.source ?? null, usable: currentKey !== null, authenticated: 0, failed: 0 };
    let structurallyValid = 0;
    let malformed = 0;
    for (const payload of payloads) {
      const envelope = parseEnvelope(payload);
      if (!envelope) { malformed++; continue; }
      structurallyValid++;
      if (currentKey) current[authenticates(envelope, currentKey) ? "authenticated" : "failed"]++;
      for (const candidate of candidates) candidate[authenticates(envelope, candidate.key) ? "authenticated" : "failed"]++;
    }
    return {
      status: "complete", ciphertexts: payloads.length, structurallyValid, malformed, currentKey: current,
      candidates: candidates.map(({ source, transformation, authenticated, failed }) => ({ source, transformation, authenticated, failed })),
    };
  } finally {
    currentKey?.fill(0);
    for (const candidate of candidates) candidate.key.fill(0);
  }
}
