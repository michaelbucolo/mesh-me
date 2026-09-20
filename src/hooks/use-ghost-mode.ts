"use client";

import { useSyncExternalStore } from "react";
import { setGhostMode } from "@/lib/actions";
import { broadcastGhostMode, GHOST_EVENT, GHOST_STORAGE_KEY, initializeGhostMode, readGhostMode } from "@/lib/ghost-mode";
import { PRESENCE_ACCOUNT_EVENT, readActivityHidden } from "@/lib/presence-account";
import { readWhereShare, WHERE_SHARE_EVENT } from "@/lib/where-share";
import { createGhostModeWriter } from "@/lib/ghost-mode-writer";

const SAVE_EVENT = "meshGhostSaveChanged";
const writer = createGhostModeWriter({
  publish: broadcastGhostMode,
  persist: setGhostMode,
  seed: (next) => {
    initializeGhostMode(next);
    queueMicrotask(() => window.dispatchEvent(new Event(GHOST_EVENT)));
  },
  onChange: () => window.dispatchEvent(new Event(SAVE_EVENT)),
});

export function reconcileGhostAccount(accountId: string, serverGhost: boolean) {
  writer.reconcile(accountId, serverGhost);
}

function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === GHOST_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(GHOST_EVENT, listener);
  window.addEventListener(SAVE_EVENT, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(GHOST_EVENT, listener);
    window.removeEventListener(SAVE_EVENT, listener);
    window.removeEventListener("storage", storage);
  };
}

export function useGhostMode(initialGhost = true) {
  const ghost = useSyncExternalStore(subscribe, readGhostMode, () => initialGhost);
  const pending = useSyncExternalStore(subscribe, writer.isPending, () => false);
  const error = useSyncExternalStore(subscribe, writer.getError, () => null);
  return { ghost, pending, error, update: writer.update };
}

function subscribePrivacy(listener: () => void) {
  window.addEventListener(PRESENCE_ACCOUNT_EVENT, listener);
  window.addEventListener(WHERE_SHARE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(PRESENCE_ACCOUNT_EVENT, listener);
    window.removeEventListener(WHERE_SHARE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function usePresencePrivacy() {
  const hideActivityStatus = useSyncExternalStore(subscribePrivacy, readActivityHidden, () => true);
  const shareWhere = useSyncExternalStore(subscribePrivacy, readWhereShare, () => false);
  return { hideActivityStatus, shareWhere };
}
