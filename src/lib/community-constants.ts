export const COMMUNITY_SPACE_TYPES = [
  {
    id: "creator",
    label: "Creator",
    description: "For audiences, updates, drops, and paid-community style spaces.",
  },
  {
    id: "friends",
    label: "Friends",
    description: "For small groups, shared posts, casual chat, and plans.",
  },
  {
    id: "family",
    label: "Family",
    description: "For private family updates, memories, and safer sharing.",
  },
  {
    id: "project",
    label: "Project",
    description: "For teams, clubs, events, and collaborative work.",
  },
] as const;

export function communityThreadTitle(communityId: string) {
  return `community:${communityId}`;
}
