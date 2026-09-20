"use client";

import { useSyncExternalStore } from "react";
import { PRESENCE_ACCOUNT_EVENT, readPresenceAccount } from "@/lib/presence-account";

const EVENT = "meshRoomGesturesChanged";
const PREFIX = "meshRoomGestures:";
// A failed write must not let readable old storage undo an explicit opt-out.
const memoryOverrides = new Map<string, boolean>();

/** Account- and device-scoped opt-in; an unidentified account is always off. */
export function readRoomGestures() {
  const account = readPresenceAccount();
  if (!account || typeof window === "undefined") return false;
  const override = memoryOverrides.get(account);
  if (override !== undefined) return override;
  try { return window.localStorage.getItem(`${PREFIX}${account}`) === "true"; }
  catch { return false; }
}

export function updateRoomGestures(enabled: boolean) {
  const account = readPresenceAccount();
  if (!account || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}${account}`, String(enabled));
    memoryOverrides.delete(account);
  } catch {
    memoryOverrides.set(account, enabled);
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === `${PREFIX}${readPresenceAccount()}`) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener(PRESENCE_ACCOUNT_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener(PRESENCE_ACCOUNT_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useRoomGestures() {
  const enabled = useSyncExternalStore(subscribe, readRoomGestures, () => false);
  return { enabled, update: updateRoomGestures };
}
