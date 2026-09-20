"use client";

export const PRESENCE_ACCOUNT_EVENT = "meshPresenceAccountChanged";
let accountId: string | null = null;
let activityHidden = true;

export function readPresenceAccount() { return accountId; }
export function readActivityHidden() { return activityHidden; }

/** Account policy only; this store never contains browsing or message data. */
export function initializePresenceAccount(userId: string, hideActivityStatus: boolean) {
  const changed = accountId !== userId || activityHidden !== hideActivityStatus;
  accountId = userId;
  activityHidden = hideActivityStatus;
  if (changed && typeof window !== "undefined") {
    queueMicrotask(() => window.dispatchEvent(new Event(PRESENCE_ACCOUNT_EVENT)));
  }
}
