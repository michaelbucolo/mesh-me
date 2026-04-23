export const PRESENCE_STATUSES = ["online", "dnd", "busy", "offline"] as const;

export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export function isPresenceStatus(value: unknown): value is PresenceStatus {
  return typeof value === "string" && PRESENCE_STATUSES.includes(value as PresenceStatus);
}
