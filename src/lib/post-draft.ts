export type PostAudience = "public" | "friends" | "private" | "community";
export type PostDraftText = {
  content: string;
  tags: string;
  mediaUrl: string;
  linkUrl: string;
  visibility: PostAudience;
};

export function readPostDraft(raw: string | null, inCommunity: boolean): PostDraftText | null {
  if (!raw || raw.length > 12000) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft.version !== 1 || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > 7 * 86400000) return null;
    if (![draft.content, draft.tags, draft.mediaUrl, draft.linkUrl].every((value) => typeof value === "string")) return null;
    if (!["public", "friends", "private", ...(inCommunity ? ["community"] : [])].includes(draft.visibility)) return null;
    return { content: draft.content.slice(0, 500), tags: draft.tags.slice(0, 400), mediaUrl: draft.mediaUrl.slice(0, 2048), linkUrl: draft.linkUrl.slice(0, 2048), visibility: draft.visibility };
  } catch {
    return null;
  }
}
