export const meshBrand = {
  name: "Mesh.me",
  legalName: "mesh.me",
  domain: "mesh.me",
  motto: "Your World, Your Way",
  productCategory: "privacy-first social media and digital identity hub",
  shortDescription: "One private home for your social world.",
  description:
    "Mesh.me is a privacy-first social media platform and digital identity hub that unifies your posts, messages, analytics, privacy controls, and online identity in one place.",
  openGraphDescription:
    "Enter one private hub for your posts, messages, analytics, privacy controls, and digital identity. Your World, Your Way.",
  trustLine: "Private. Secure. No ads. No data selling.",
  entryPrompt: "Who are you?",
  meshi: {
    name: "Meshi",
    description:
      "Meshi is the simple two-eyed companion that represents the user across Mesh.me.",
    visualRule:
      "Simple bubble body, two eyes, no mouth, minimal accessories, hands only when holding something.",
  },
  tone: {
    voice: "calm, clear, personal, direct, and consumer-first",
    do: [
      "Use short, concrete language.",
      "Make privacy and control visible.",
      "Explain platform permissions without fear tactics.",
      "Keep Meshi warm without making the product childish.",
    ],
    avoid: [
      "Corporate jargon.",
      "Ad-tech language.",
      "Manipulative urgency.",
      "Overexplaining obvious interface actions.",
    ],
  },
  colors: {
    ink: "#0f141b",
    surface: "#151b24",
    surfaceRaised: "#1b2430",
    white: "#f7f9fc",
    muted: "#9aa7b8",
    meshBlue: "#58a6ff",
    meshBlueLight: "#79b8ff",
    privacyGreen: "#22c55e",
    warningAmber: "#f59e0b",
    dangerRed: "#ef4444",
  },
  assets: {
    favicon: "/meshi-favicon.svg",
    icon: "/meshi-icon.svg",
    logo: "/meshi-logo.svg",
    ogImage: "/opengraph-image",
    twitterImage: "/twitter-image",
  },
} as const;

export function getSiteUrl() {
  const fallback = "https://www.meshs.me";
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
        process.env.VERCEL_URL?.trim()
      : undefined;

  if (!raw) return fallback;

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function getBrandTitle(pageTitle?: string) {
  return pageTitle ? `${pageTitle} | ${meshBrand.name}` : `${meshBrand.name} | ${meshBrand.motto}`;
}
