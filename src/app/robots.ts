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
        "/admin",
        "/analytics",
        "/communities",
        "/connected-accounts",
        "/content-hub",
        "/explore",
        "/feed",
        "/feedback",
        "/innovation",
        "/marketplace",
        "/mesh",
        "/meshi-voice",
        "/meshpro",
        "/messages",
        "/notifications",
        "/onboarding",
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
