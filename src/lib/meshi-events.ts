export const MESHI_OPEN_EVENT = "meshi:open";

export type MeshiOpenMode = "actions" | "speech" | "chat";

export function openMeshi(mode: MeshiOpenMode = "actions") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MeshiOpenMode>(MESHI_OPEN_EVENT, { detail: mode }));
}
