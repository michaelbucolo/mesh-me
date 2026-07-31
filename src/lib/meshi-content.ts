// Focused-content helpers shared by the Meshi companion and the surfaces that
// hand it content. Post cards mark themselves with `data-meshi-content-*`
// attributes; these functions read that contract in one place so the float,
// the fullscreen detector, and the post ⋯ menu can never drift apart on it.

import type { MeshiContext } from "@/lib/meshi-shared";

export type FocusedContent = NonNullable<MeshiContext["focusedContent"]>;

export type MeshiContentMode = "summary" | "fact-check" | "verify";

export function getFocusedContentFromElement(element: Element | null): FocusedContent | null {
  const card = element?.closest?.("[data-meshi-content-card='true']") as HTMLElement | null;
  if (!card) return null;

  const mediaTypes = (card.dataset.meshiContentMedia || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const mediaSignals = (card.dataset.meshiContentMediaSignals || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: card.dataset.meshiContentId,
    platform: card.dataset.meshiContentPlatform || "meshme",
    author: card.dataset.meshiContentAuthor,
    text: card.dataset.meshiContentText,
    mediaTypes,
    externalUrl: card.dataset.meshiContentUrl,
    contentRating: card.dataset.meshiContentRating || "general",
    mediaSignals,
  };
}

export function getVisibleFocusedContent(): FocusedContent | null {
  if (typeof document === "undefined") return null;
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-meshi-content-card='true']"));
  const viewportHeight = window.innerHeight || 1;
  const targetY = viewportHeight * 0.45;
  let bestCard: HTMLElement | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.width <= 0 || rect.height <= 0) return;
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(viewportHeight, rect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - targetY);
    const score = visibleHeight - centerDistance * 0.35;
    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  });

  return getFocusedContentFromElement(bestCard);
}

export function areFocusedContentEqual(a: FocusedContent | null, b: FocusedContent | null) {
  if (!a && !b) return true;
  return Boolean(a && b && a.id === b.id && a.platform === b.platform && a.text === b.text);
}

export function getFocusedContentPrompt(content: FocusedContent, mode: MeshiContentMode) {
  const source = content.platform ? ` from ${content.platform}` : "";
  if (mode === "summary") return `Summarize the visible post${source}.`;
  if (mode === "verify") return `Check the visible post${source} for possible synthetic or digitally created photo or video signals.`;
  return `Fact-check the visible post${source}. Point out what is verified, what needs a source, and what I should be careful about.`;
}
