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
        "/content-hub",
        "/explore",
        "/feature-requests",
        "/feed",
        "/feedback",
        "/flow",
        "/innovation",
        "/marketplace",
        "/mesh",
        "/meshi-voice",
        "/meshpro",
        "/messages",
        "/notifications",
        "/onboarding",
        "/privacy-controls",
        "/profile",
        "/search",
        "/settings",
        "/spaces",
        "/super-app",
        "/vault",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
