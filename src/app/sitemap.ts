import type { MetadataRoute } from "next";
import { listAllLiveEvents } from "@/lib/live";
import { getPublishedNews } from "@/lib/news";
import { buildPublicSitemap } from "@/lib/sitemap";
import { getPublishedSongs } from "@/lib/songs";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, songs, liveEvents] = await Promise.all([
    getPublishedNews(),
    getPublishedSongs(),
    listAllLiveEvents(),
  ]);

  return buildPublicSitemap({
    siteUrl: SITE_URL,
    now: new Date(),
    news,
    songs,
    liveEvents,
  });
}
