import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1";

// Placeholder values shipped in .env.example / docs. If any of these is left in
// place they are publicly known, so they must never be accepted as a real key.
const SHIPPED_PLACEHOLDER_KEYS = new Set([
  "change-me-please",
  "change-me-to-a-long-random-secret",
  "replace-me-with-a-long-random-secret",
]);

function getKey(): Buffer | null {
  const raw =
    process.env.APP_DATA_ENCRYPTION_KEY ||
    process.env.MESHME_TOKEN_ENCRYPTION_KEY ||
    process.env.MESHME_SECRET_KEY;

  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || SHIPPED_PLACEHOLDER_KEYS.has(trimmed)) return null;

  // DECIDE THE ENCODING BY SHAPE, NOT BY DECODE-AND-HOPE.
  //
  // A 64-character hex key — what `openssl rand -hex 32` prints, which is the
  // command LAUNCH-GUIDE.md tells an operator to run — used to be rejected
  // here, and rejected SILENTLY. It is not 32 bytes as base64 (Buffer.from
  // strips the non-base64 characters and yields 48) and not 32 bytes as utf8
  // (it is 64). Both checks missed, and in production the SHA-256 passphrase
  // fallback below is deliberately disabled, so getKey() returned null for a
  // key that was correctly configured and perfectly strong.
  //
  // The cost of that landed at the worst possible moment: the OAuth callback
  // checks hasSecretEncryptionKey() AFTER a successful token exchange, so a
  // person authorized their account at the provider and was then told
  // "Server encryption key is not configured" — a message that is the opposite
  // of the truth. Every platform failed this way, for one missing branch.
  //
  // Hex is checked first and by regex: exactly 64 characters, all hex digits,
  // is unambiguous. (The old try/catch was dead code besides —
  // Buffer.from(x, "base64") does not throw on invalid input.)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");

  const base64Buffer = Buffer.from(trimmed, "base64");
  if (base64Buffer.length === 32) return base64Buffer;

  const utf8Buffer = Buffer.from(trimmed, "utf8");
  if (utf8Buffer.length === 32) return utf8Buffer;

  // Fallback: stretch a passphrase with SHA-256. In production we refuse this —
  // a proper 32-byte key must be configured — so a short/low-entropy or public
  // example passphrase can never silently stand in for a real key (getKey()
  // returning null makes encryptSecret fail closed and the OAuth callback
  // refuse to store plaintext tokens). Allowed outside production for local dev.
  if (process.env.NODE_ENV === "production") return null;

  return createHash("sha256").update(trimmed).digest();
}

export function hasSecretEncryptionKey(): boolean {
  return getKey() !== null;
}

export function encryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;

  const key = getKey();
  if (!key) {
    // Fail closed in production: silently persisting OAuth access/refresh
    // tokens in cleartext is worse than not persisting them. In dev (no key
    // configured) we still allow it so local flows work.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Refusing to store a secret without APP_DATA_ENCRYPTION_KEY configured (would be plaintext).",
      );
    }
    return value;
  }
  if (value.startsWith(`${PREFIX}:`)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(`${PREFIX}:`)) return value;

  const key = getKey();
  if (!key) {
    return null;
  }

  const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted secret format");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
