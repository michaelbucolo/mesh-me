export type AdultVerificationStatus = "unverified" | "pending" | "verified" | "rejected" | "expired";

export type AdultVerificationSnapshot = {
  nsfwEnabled?: boolean | null;
  adultVerificationStatus?: string | null;
  adultVerificationExpiresAt?: Date | string | null;
};

export type NsfwPolicy = {
  minAge: number;
  requiresIdVerification: boolean;
  stateSpecificRequirement: boolean;
  reason: string;
};

const ADULT_VERIFICATION_STATES = new Set([
  "AL", "AZ", "AR", "FL", "GA", "ID", "IN", "KS", "KY", "LA", "MS", "MO",
  "MT", "NE", "NC", "ND", "OH", "OK", "SC", "SD", "TN", "TX", "UT", "VA", "WY",
]);

const NSFW_TERMS = [
  "nsfw",
  "porn",
  "pornography",
  "explicit",
  "sexually explicit",
  "adult content",
  "nude",
  "nudity",
  "onlyfans",
  "xxx",
];

export function normalizeUsState(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && /^[A-Z]{2}$/.test(trimmed) ? trimmed : "";
}

export function getNsfwPolicyForRegion(region?: string | null): NsfwPolicy {
  const state = normalizeUsState(region);
  const stateSpecificRequirement = ADULT_VERIFICATION_STATES.has(state);

  return {
    minAge: 18,
    requiresIdVerification: true,
    stateSpecificRequirement,
    reason: stateSpecificRequirement
      ? "Your state has adult-content age-verification requirements. Mesh.me requires verification before NSFW can be enabled."
      : "Mesh.me requires adult verification before NSFW can be enabled, even where state law is less specific.",
  };
}

export function isAdultVerificationActive(user: AdultVerificationSnapshot | null | undefined) {
  if (!user) return false;
  if (user.adultVerificationStatus !== "verified") return false;
  if (!user.adultVerificationExpiresAt) return true;
  return new Date(user.adultVerificationExpiresAt).getTime() > Date.now();
}

export function canViewNsfw(user: AdultVerificationSnapshot | null | undefined) {
  return Boolean(user?.nsfwEnabled && isAdultVerificationActive(user));
}

export function nsfwHiddenWhere(user: AdultVerificationSnapshot | null | undefined) {
  return canViewNsfw(user) ? {} : { isNsfw: false };
}

export function classifyContentSafety(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  const isNsfw = NSFW_TERMS.some((term) => text.includes(term));
  return {
    isNsfw,
    contentRating: isNsfw ? "adult" : "general",
  };
}
