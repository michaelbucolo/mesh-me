import type { Prisma } from "@/generated/prisma/client";

/** Community access and a post's audience are independent requirements. */
export function nativePostAudienceWhere(
  viewerId: string,
  communityIds: string[],
  friendIds: string[],
): Prisma.PostWhereInput {
  return {
    OR: [
      { authorId: viewerId },
      {
        AND: [
          { OR: [{ communityId: null }, { community: { isPublic: true } }, { communityId: { in: communityIds } }] },
          {
            OR: [
              { visibility: "public" },
              { visibility: "friends", authorId: { in: friendIds } },
              { visibility: "community", communityId: { in: communityIds } },
            ],
          },
        ],
      },
    ],
  };
}
