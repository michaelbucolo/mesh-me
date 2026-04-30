export type MeChatAttachmentType = "image" | "video" | "audio" | "file" | "link";

export type MeChatAttachment = {
  id: string;
  type: MeChatAttachmentType;
  url: string;
  name?: string;
};

export type MeChatReaction = {
  emoji: string;
  userId: string;
  createdAt: string;
};

export type MeChatLinkPreview = {
  url: string;
  host: string;
  title: string;
  description?: string;
};

export type MeChatMessageMetadata = {
  attachments?: MeChatAttachment[];
  reactions?: MeChatReaction[];
  replyToMessageId?: string;
  linkPreview?: MeChatLinkPreview;
};

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/i;
const ALLOWED_ATTACHMENT_TYPES = new Set<MeChatAttachmentType>(["image", "video", "audio", "file", "link"]);

export function parseMeChatMetadata(raw: string | null | undefined): MeChatMessageMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as MeChatMessageMetadata;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return {
      attachments: normalizeAttachments(parsed.attachments),
      reactions: normalizeReactions(parsed.reactions),
      replyToMessageId: typeof parsed.replyToMessageId === "string" ? parsed.replyToMessageId : undefined,
      linkPreview: normalizeLinkPreview(parsed.linkPreview),
    };
  } catch {
    return {};
  }
}

export function serializeMeChatMetadata(metadata: MeChatMessageMetadata): string | null {
  const normalized: MeChatMessageMetadata = {
    attachments: normalizeAttachments(metadata.attachments),
    reactions: normalizeReactions(metadata.reactions),
    replyToMessageId: typeof metadata.replyToMessageId === "string" && metadata.replyToMessageId.trim()
      ? metadata.replyToMessageId.trim()
      : undefined,
    linkPreview: normalizeLinkPreview(metadata.linkPreview),
  };

  const cleaned = Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    }),
  );

  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

export function extractFirstUrl(value: string) {
  const match = value.match(URL_PATTERN);
  return match?.[1]?.replace(/[),.;!?]+$/, "") || null;
}

export function buildLinkPreview(content: string, sourceUrl?: string | null, sourcePlatform = "web"): MeChatLinkPreview | undefined {
  const url = sourceUrl || extractFirstUrl(content);
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
    const host = parsed.hostname.replace(/^www\./, "");
    return {
      url: parsed.toString(),
      host,
      title: sourcePlatform === "web" ? host : `${sourcePlatform} source`,
      description: "Source-linked preview. Opens at the original platform or website.",
    };
  } catch {
    return undefined;
  }
}

export function toggleMessageReaction(
  metadata: MeChatMessageMetadata,
  emoji: string,
  userId: string,
): MeChatMessageMetadata {
  const cleanedEmoji = emoji.trim().slice(0, 12);
  if (!cleanedEmoji) return metadata;

  const reactions = normalizeReactions(metadata.reactions);
  const existingIndex = reactions.findIndex((reaction) => reaction.emoji === cleanedEmoji && reaction.userId === userId);
  if (existingIndex >= 0) {
    reactions.splice(existingIndex, 1);
  } else {
    reactions.push({
      emoji: cleanedEmoji,
      userId,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    ...metadata,
    reactions,
  };
}

export function normalizeAttachments(value: unknown): MeChatAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): MeChatAttachment | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const rawUrl = typeof record.url === "string" ? record.url.trim() : "";
      if (!rawUrl) return null;
      try {
        const parsed = new URL(rawUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) return null;
        const requestedType = typeof record.type === "string" ? record.type.toLowerCase() : "link";
        const type = ALLOWED_ATTACHMENT_TYPES.has(requestedType as MeChatAttachmentType)
          ? requestedType as MeChatAttachmentType
          : "link";
        const name = typeof record.name === "string" ? record.name.trim().slice(0, 120) : undefined;
        return {
          id: typeof record.id === "string" && record.id.trim() ? record.id.trim().slice(0, 80) : cryptoSafeId(parsed.toString()),
          type,
          url: parsed.toString(),
          name,
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is MeChatAttachment => Boolean(item))
    .slice(0, 6);
}

function normalizeReactions(value: unknown): MeChatReaction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): MeChatReaction | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const emoji = typeof record.emoji === "string" ? record.emoji.trim().slice(0, 12) : "";
      const userId = typeof record.userId === "string" ? record.userId.trim() : "";
      const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
      return emoji && userId ? { emoji, userId, createdAt } : null;
    })
    .filter((item): item is MeChatReaction => Boolean(item))
    .slice(0, 80);
}

function normalizeLinkPreview(value: unknown): MeChatLinkPreview | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url.trim() : "";
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
    const host = typeof record.host === "string" && record.host.trim()
      ? record.host.trim().slice(0, 120)
      : parsed.hostname.replace(/^www\./, "");
    const title = typeof record.title === "string" && record.title.trim()
      ? record.title.trim().slice(0, 160)
      : host;
    const description = typeof record.description === "string" && record.description.trim()
      ? record.description.trim().slice(0, 220)
      : undefined;
    return {
      url: parsed.toString(),
      host,
      title,
      description,
    };
  } catch {
    return undefined;
  }
}

function cryptoSafeId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `attachment-${hash.toString(16)}`;
}
