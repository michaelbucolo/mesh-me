import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/account",
        "/admin",
        "/analytics",
        "/billing",
        "/communities",
        "/connected-accounts",
        "/explore",
        "/feed",
        "/mesh",
        "/meshpro",
        "/messages",
        "/notifications",
        "/onboarding",
        "/privacy-controls",
        "/profile",
        "/search",
        "/settings",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
