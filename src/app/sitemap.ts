import type { MetadataRoute } from "next";
import { getPublishedNews } from "@/lib/news";
import { getPublishedSongs } from "@/lib/songs";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, songs] = await Promise.all([
    getPublishedNews(),
    getPublishedSongs(),
  ]);

  const lastNewsDate = news[0]?.date ?? new Date();
  const lastSongDate = songs[0]?.releasedAt ?? new Date();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/songs`, lastModified: lastSongDate, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/news`, lastModified: lastNewsDate, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/live`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/members`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/quote`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const newsPages: MetadataRoute.Sitemap = news.map((n) => ({
    url: `${SITE_URL}/news/${n.id}`,
    lastModified: n.date,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...newsPages];
}
