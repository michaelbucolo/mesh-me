const MAX_INLINE_IMAGE_URL_LENGTH = 12_000;

export function compactImageUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("data:image/") && value.length > MAX_INLINE_IMAGE_URL_LENGTH) return null;
  return value;
}

export function compactUserAvatar<T extends { avatarUrl?: string | null }>(user: T): T {
  return {
    ...user,
    avatarUrl: compactImageUrl(user.avatarUrl),
  };
}

export function compactUserImages<T extends { avatarUrl?: string | null; bannerUrl?: string | null }>(user: T): T {
  return {
    ...user,
    avatarUrl: compactImageUrl(user.avatarUrl),
    bannerUrl: compactImageUrl(user.bannerUrl),
  };
}

export function compactMediaItems<T extends { url?: string | null; thumbnailUrl?: string | null }>(items: T[]) {
  return items
    .map((item) => ({
      ...item,
      url: compactImageUrl(item.url),
      thumbnailUrl: compactImageUrl(item.thumbnailUrl),
    }))
    .filter((item) => item.url || item.thumbnailUrl);
}
