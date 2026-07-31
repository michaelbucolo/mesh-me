import type { FocusedContent } from "@/lib/meshi-content";

export const MESHI_OPEN_EVENT = "meshi:open";

export type MeshiOpenMode = "actions" | "speech" | "chat";

export function openMeshi(mode: MeshiOpenMode = "actions") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MeshiOpenMode>(MESHI_OPEN_EVENT, { detail: mode }));
}

// A surface handing Meshi a specific piece of content to talk about — the post
// ⋯ menu's "Summarize / Fact-check / Verify media". Carrying the content in the
// event (rather than letting the float guess from scroll position) means the
// answer is always about the post whose menu was opened.
export const MESHI_PROMPT_EVENT = "meshi:prompt";

export type MeshiPromptDetail = { prompt: string; content?: FocusedContent };

export function askMeshiAboutContent(detail: MeshiPromptDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MeshiPromptDetail>(MESHI_PROMPT_EVENT, { detail }));
}
