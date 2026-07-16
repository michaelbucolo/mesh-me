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
