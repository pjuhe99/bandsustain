import type { MetadataRoute } from "next";

type SitemapNewsItem = {
  id: number;
  date: Date;
};

type SitemapSongItem = {
  releasedAt: Date;
};

type SitemapLiveEvent = {
  published: boolean;
  updatedAt: Date;
};

type BuildPublicSitemapInput = {
  siteUrl: string;
  now: Date;
  news: SitemapNewsItem[];
  songs: SitemapSongItem[];
  liveEvents: SitemapLiveEvent[];
};

function maxDate(dates: Array<Date | undefined>): Date | undefined {
  const validDates = dates.filter((value): value is Date => value instanceof Date);
  if (validDates.length === 0) return undefined;

  return validDates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest,
  );
}

export function buildPublicSitemap({
  siteUrl,
  now,
  news,
  songs,
  liveEvents,
}: BuildPublicSitemapInput): MetadataRoute.Sitemap {
  const latestNewsDate = news[0]?.date;
  const latestSongDate = songs[0]?.releasedAt;
  const latestLiveDate = maxDate(
    liveEvents
      .filter((event) => event.published)
      .map((event) => event.updatedAt),
  );
  const homeLastModified = maxDate([
    latestNewsDate,
    latestSongDate,
    latestLiveDate,
  ]) ?? now;

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: homeLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/songs`,
      lastModified: latestSongDate ?? now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/news`,
      lastModified: latestNewsDate ?? now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/live`,
      lastModified: latestLiveDate ?? now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/members`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/quote`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/playground`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${siteUrl}/playground/kim-yeongmin-bot`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  const newsPages: MetadataRoute.Sitemap = news.map((item) => ({
    url: `${siteUrl}/news/${item.id}`,
    lastModified: item.date,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...newsPages];
}
