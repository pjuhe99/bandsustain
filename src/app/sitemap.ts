import type { MetadataRoute } from "next";
import { listAllLiveEvents } from "@/lib/live";
import { getPublishedNews } from "@/lib/news";
import { getPublishedPosts } from "@/lib/columns";
import { buildPublicSitemap } from "@/lib/sitemap";
import { getPublishedSongs } from "@/lib/songs";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, songs, liveEvents, posts] = await Promise.all([
    getPublishedNews(),
    getPublishedSongs(),
    listAllLiveEvents(),
    getPublishedPosts(),
  ]);

  return buildPublicSitemap({
    siteUrl: SITE_URL,
    now: new Date(),
    news,
    songs,
    liveEvents,
    columns: posts.map((p) => ({ id: p.id, lastModified: p.publishedAt ?? p.createdAt })),
  });
}
