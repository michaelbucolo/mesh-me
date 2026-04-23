import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1";

function getKey(): Buffer | null {
  const raw =
    process.env.APP_DATA_ENCRYPTION_KEY ||
    process.env.MESHME_TOKEN_ENCRYPTION_KEY ||
    process.env.MESHME_SECRET_KEY;

  if (!raw || raw === "change-me-please") return null;

  try {
    const base64Buffer = Buffer.from(raw, "base64");
    if (base64Buffer.length === 32) return base64Buffer;
  } catch {
    // ignore invalid base64 input and try other formats
  }

  const utf8Buffer = Buffer.from(raw, "utf8");
  if (utf8Buffer.length === 32) return utf8Buffer;

  return createHash("sha256").update(raw).digest();
}

export function hasSecretEncryptionKey(): boolean {
  return getKey() !== null;
}

export function encryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;

  const key = getKey();
  if (!key) return value;
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
