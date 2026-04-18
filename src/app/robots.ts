import type { MetadataRoute } from "next";

function getSiteUrl() {
  const fallback = "https://mesh.me";
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!raw) return fallback;

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/onboarding"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
