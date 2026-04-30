export const MESH_PRO_PRICING = {
  monthly: {
    id: "monthly",
    label: "Monthly",
    price: "$4.99",
    interval: "month",
    detail: "Best for trying Mesh Pro.",
    savings: null,
  },
  yearly: {
    id: "yearly",
    label: "Yearly",
    price: "$44.99",
    interval: "year",
    detail: "Best value for creators and power users.",
    savings: "Save 25%",
  },
} as const;

export const MESH_PRO_FEATURES = [
  "Premium creator analytics",
  "Custom Mesh branch visuals",
  "Expanded Meshi cosmetics",
  "Profile Pro badge",
  "Custom app themes",
  "Advanced privacy and security views",
  "Priority launch-readiness tools",
  "Zero ads and no data selling",
] as const;

export const MESH_PRO_ANALYTICS = [
  "Audience overlap across connected platforms",
  "Longer performance history",
  "Best-platform recommendations",
  "Exportable creator reports",
  "Profile and content conversion signals",
] as const;

export const MESH_PRO_CUSTOMIZATION = [
  "Custom Mesh connection colors",
  "Custom Mesh node styles",
  "Premium Meshi hats, hair, accessories, badges, and outfits",
  "Custom app theme colors",
  "Use Meshi as a personal profile badge",
] as const;

export const FREE_MESHI_OPTIONS = {
  hats: new Set(["none", "cap"]),
  faces: new Set(["happy", "thinking", "wink"]),
  colors: new Set(["blue", "purple", "green"]),
  hairs: new Set(["none"]),
  accessories: new Set(["none"]),
  eyes: new Set(["regular"]),
  badges: new Set(["none"]),
  outfits: new Set(["none"]),
} as const;

export function isFreeMeshiOption(group: keyof typeof FREE_MESHI_OPTIONS, value: string | null | undefined) {
  return FREE_MESHI_OPTIONS[group].has((value || "none").trim().toLowerCase());
}
