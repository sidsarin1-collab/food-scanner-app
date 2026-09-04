import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

// Public pages only -- admin/login and API routes are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/how-we-evaluate-ingredients`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/regulatory-sources`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
