import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

const LAST_MODIFIED = new Date("2026-10-27T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: {
    path: string;
    priority: number;
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.7, changeFrequency: "monthly" },
    { path: "/terms", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
    { path: "/login", priority: 0.8, changeFrequency: "monthly" },
  ];

  return pages.map((page) => ({
    url: `${APP_URL}${page.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
