import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/features`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // NO /roadmap ENTRY. There is no /roadmap route — `find src/app -ipath
    // "*roadmap*"` returns nothing, and the only other match in the repo is
    // scripts/roadmap-readiness.mjs, which is a build gate. This file was
    // advertising a 404 to every crawler that read it.
    //
    // A sitemap is a list of promises to search engines, and nothing in the
    // build checks that the promises resolve — which is exactly how this
    // survived. If a roadmap page is ever built, the entry comes back with it.
    {
      url: `${siteUrl}/trust`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/status`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/support`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/help`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
