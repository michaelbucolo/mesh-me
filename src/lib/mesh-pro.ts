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
    price: "$39.99",
    interval: "year",
    detail: "Best value for creators and power users.",
    savings: "Save 33%",
  },
} as const;

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
