"use client";

/**
 * End-to-End Encryption Module
 *
 * Uses the Web Crypto API (SubtleCrypto) for client-side encryption.
 * Messages are encrypted before being sent to the server and decrypted
 * only on the recipient's device. The server never sees plaintext.
 *
 * Key exchange: ECDH (P-256) for shared secret derivation
 * Encryption: AES-GCM (256-bit) for message encryption
 * Key storage: IndexedDB via a thin wrapper
 */

const DB_NAME = "mesh-e2e";
const DB_VERSION = 1;
const KEY_STORE = "keys";

// ─── IndexedDB Key Storage ───────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeKey(id: string, key: CryptoKey, type: "public" | "private"): Promise<void> {
  const db = await openDB();
  const exported = type === "public"
    ? await crypto.subtle.exportKey("spki", key)
    : await crypto.subtle.exportKey("pkcs8", key);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readwrite");
    tx.objectStore(KEY_STORE).put({
      id,
      key: Array.from(new Uint8Array(exported)),
      type,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadKey(id: string): Promise<{ key: Uint8Array; type: "public" | "private" } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readonly");
    const req = tx.objectStore(KEY_STORE).get(id);
    req.onsuccess = () => {
      if (req.result) {
        resolve({ key: new Uint8Array(req.result.key), type: req.result.type });
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Key Generation ──────────────────────────────────────────

export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  return keyPair;
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binary = atob(base64Key);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    "spki",
    bytes.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

// ─── Key Derivation (ECDH shared secret → AES key) ──────────

async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Encryption / Decryption ─────────────────────────────────

export async function encryptMessage(
  plaintext: string,
  privateKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const sharedKey = await deriveSharedKey(privateKey, recipientPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encoded
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  privateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<string> {
  const sharedKey = await deriveSharedKey(privateKey, senderPublicKey);

  const cipherBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    sharedKey,
    cipherBytes
  );

  return new TextDecoder().decode(decrypted);
}

// ─── User Key Management ─────────────────────────────────────

const MY_PRIVATE_KEY_ID = "my-private-key";
const MY_PUBLIC_KEY_ID = "my-public-key";

export async function getOrCreateMyKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyBase64: string;
}> {
  // Try to load existing keys
  const storedPrivate = await loadKey(MY_PRIVATE_KEY_ID);
  const storedPublic = await loadKey(MY_PUBLIC_KEY_ID);

  if (storedPrivate && storedPublic) {
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      new Uint8Array(storedPrivate.key).buffer as ArrayBuffer,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    const publicKey = await crypto.subtle.importKey(
      "spki",
      new Uint8Array(storedPublic.key).buffer as ArrayBuffer,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );
    const publicKeyBase64 = await exportPublicKey(publicKey);
    return { publicKey, privateKey, publicKeyBase64 };
  }

  // Generate new key pair
  const { publicKey, privateKey } = await generateKeyPair();
  await storeKey(MY_PRIVATE_KEY_ID, privateKey, "private");
  await storeKey(MY_PUBLIC_KEY_ID, publicKey, "public");
  const publicKeyBase64 = await exportPublicKey(publicKey);

  return { publicKey, privateKey, publicKeyBase64 };
}

// ─── Encryption Status ───────────────────────────────────────

export interface EncryptionStatus {
  isEnabled: boolean;
  hasKeyPair: boolean;
  publicKeyFingerprint: string | null;
}

export async function getEncryptionStatus(): Promise<EncryptionStatus> {
  try {
    const storedPublic = await loadKey(MY_PUBLIC_KEY_ID);
    if (!storedPublic) {
      return { isEnabled: false, hasKeyPair: false, publicKeyFingerprint: null };
    }

    // Generate fingerprint from public key (first 8 hex chars of SHA-256)
    const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(storedPublic.key).buffer as ArrayBuffer);
    const fingerprint = Array.from(new Uint8Array(hash))
      .slice(0, 4)
      .map(b => b.toString(16).padStart(2, "0"))
      .join(":");

    return { isEnabled: true, hasKeyPair: true, publicKeyFingerprint: fingerprint };
  } catch {
    return { isEnabled: false, hasKeyPair: false, publicKeyFingerprint: null };
  }
}

// ─── Utility: Verify encryption is supported ─────────────────

export function isEncryptionSupported(): boolean {
  return typeof crypto !== "undefined"
    && typeof crypto.subtle !== "undefined"
    && typeof indexedDB !== "undefined";
}
