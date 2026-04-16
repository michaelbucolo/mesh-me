import crypto from "crypto";

const SECRET_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer | null {
  const rawKey = process.env.APP_DATA_ENCRYPTION_KEY;
  if (!rawKey) return null;

  try {
    const keyBuffer = Buffer.from(rawKey, "base64");
    if (keyBuffer.length === 32) return keyBuffer;
  } catch {}

  const utf8Buffer = Buffer.from(rawKey, "utf8");
  if (utf8Buffer.length === 32) return utf8Buffer;

  return null;
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX);
}

export function encryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (isEncryptedSecret(value)) return value;

  const key = getEncryptionKey();
  if (!key) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${SECRET_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncryptedSecret(value)) return value;

  const key = getEncryptionKey();
  if (!key) return null;

  const payload = value.slice(SECRET_PREFIX.length);
  const [ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) return null;

  try {
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

export function hasSecretEncryptionKey(): boolean {
  return getEncryptionKey() !== null;
}
