type PresenceSource = {
  id: string;
  platform?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
};

export function getPostPresenceKey(source: PresenceSource | null | undefined) {
  if (!source) return null;
  const platform = source.platform?.toLowerCase();
  const sourceType = source.sourceType?.toLowerCase();

  if (source.sourceId && (sourceType === "platform" || (platform && platform !== "meshme"))) {
    return `platform:${source.sourceId}`;
  }

  if (source.sourceId && sourceType === "mesh") {
    return `mesh:${source.sourceId}`;
  }

  if (source.id.startsWith("platform-")) return `platform:${source.id.slice("platform-".length)}`;
  if (source.id.startsWith("friend-platform-")) return `platform:${source.id.slice("friend-platform-".length)}`;
  if (source.id.startsWith("post-")) return `mesh:${source.id.slice("post-".length)}`;
  if (source.id.startsWith("friend-native-post-")) {
    const parts = source.id.split("-");
    return parts.length > 4 ? `mesh:${parts.slice(4).join("-")}` : `mesh:${source.id}`;
  }

  return `mesh:${source.id}`;
}
