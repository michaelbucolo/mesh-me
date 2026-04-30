export const featureRequestStatuses = [
  {
    value: "under_review",
    label: "Under review",
    description: "Fresh ideas the team is reviewing.",
  },
  {
    value: "planned",
    label: "Planned",
    description: "Accepted ideas queued for a future build.",
  },
  {
    value: "building",
    label: "Building",
    description: "Ideas actively being designed or implemented.",
  },
  {
    value: "released",
    label: "Released",
    description: "Finished ideas already available in Mesh.me.",
  },
] as const;

export type FeatureRequestStatus = (typeof featureRequestStatuses)[number]["value"];

export type FeatureRequestItem = {
  id: string;
  title: string;
  description: string;
  status: FeatureRequestStatus;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  voteCount: number;
  hasVoted: boolean;
  createdAt: string;
  updatedAt: string;
};

const featureRequestStatusValues = new Set<string>(featureRequestStatuses.map((status) => status.value));

export function isFeatureRequestStatus(value: string): value is FeatureRequestStatus {
  return featureRequestStatusValues.has(value);
}

export function getFeatureRequestStatusLabel(status: FeatureRequestStatus) {
  return featureRequestStatuses.find((item) => item.value === status)?.label ?? "Under review";
}
