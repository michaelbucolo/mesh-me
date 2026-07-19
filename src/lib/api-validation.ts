const VALID_SYNC_TYPES = ["full", "posts", "comments", "followers", "analytics"] as const;
export type PlatformSyncType = (typeof VALID_SYNC_TYPES)[number];

export const VALID_PLATFORM_CONTENT_ACTIONS = [
  "cross-post",
  "delete",
  "edit",
  "like",
  "unlike",
  "share",
  "pin",
  "unpin",
  "visibility",
  "reply",
  "delete-comment",
  "follow",
  "unfollow",
] as const;
export type PlatformContentAction = (typeof VALID_PLATFORM_CONTENT_ACTIONS)[number];

const VALID_VISIBILITY_VALUES = ["public", "private", "unlisted", "friends"] as const;
export type PlatformVisibility = (typeof VALID_VISIBILITY_VALUES)[number];

export function isSyncType(value: unknown): value is PlatformSyncType {
  return typeof value === "string" && VALID_SYNC_TYPES.includes(value as PlatformSyncType);
}

export function isPlatformContentAction(value: unknown): value is PlatformContentAction {
  return typeof value === "string" && VALID_PLATFORM_CONTENT_ACTIONS.includes(value as PlatformContentAction);
}

export function isVisibilityValue(value: unknown): value is PlatformVisibility {
  return typeof value === "string" && VALID_VISIBILITY_VALUES.includes(value as PlatformVisibility);
}

// JSON mutation payloads are small; bound the body (including chunked bodies
// without a Content-Length header) before buffering it into memory.
const MAX_JSON_BODY_BYTES = 512 * 1024;

export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  const header = req.headers.get("content-length");
  if (header) {
    const length = Number.parseInt(header, 10);
    if (Number.isFinite(length) && length > MAX_JSON_BODY_BYTES) return null;
  }

  let text: string;
  const body = req.body;
  if (!body) {
    text = await req.text().catch(() => "");
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) return null;
  } else {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_JSON_BODY_BYTES) {
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
    text = new TextDecoder().decode(merged);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

export function readRequiredString(
  payload: Record<string, unknown>,
  key: string,
  {
    maxLength = 2048,
  }: {
    maxLength?: number;
  } = {},
) {
  const value = payload[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function readOptionalString(payload: Record<string, unknown>, key: string, maxLength = 2048) {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

export function readOptionalStringArray(payload: Record<string, unknown>, key: string, maxLength = 20) {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > maxLength) return null;

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  if (normalized.length !== value.length) return null;
  return Array.from(new Set(normalized));
}

export function parsePaginationParams(searchParams: URLSearchParams, defaults = { page: 1, limit: 20, maxLimit: 50 }) {
  const rawPage = Number.parseInt(searchParams.get("page") || String(defaults.page), 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") || String(defaults.limit), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : defaults.page;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, defaults.maxLimit) : defaults.limit;
  return { page, limit };
}
