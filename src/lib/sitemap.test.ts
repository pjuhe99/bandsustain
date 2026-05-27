import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicSitemap } from "./sitemap";

// MetadataRoute.Sitemap types lastModified as string | Date | undefined;
// our builder always sets Date, so normalize for assertions.
const iso = (v: string | Date | undefined) =>
  (v instanceof Date ? v : new Date(v as string)).toISOString();

test("buildPublicSitemap returns approved public routes and freshness metadata", () => {
  const now = new Date("2026-05-18T10:00:00.000Z");
  const items = buildPublicSitemap({
    siteUrl: "https://bandsustain.com",
    now,
    news: [{ id: 7, date: new Date("2026-05-10T00:00:00.000Z") }],
    songs: [{ releasedAt: new Date("2026-05-12T00:00:00.000Z") }],
    liveEvents: [
      { published: false, updatedAt: new Date("2026-05-17T00:00:00.000Z") },
      { published: true, updatedAt: new Date("2026-05-15T00:00:00.000Z") },
    ],
  });

  const urls = items.map((item) => item.url);

  assert.deepEqual(urls, [
    "https://bandsustain.com/",
    "https://bandsustain.com/songs",
    "https://bandsustain.com/news",
    "https://bandsustain.com/columns",
    "https://bandsustain.com/live",
    "https://bandsustain.com/members",
    "https://bandsustain.com/quote",
    "https://bandsustain.com/playground",
    "https://bandsustain.com/playground/kim-yeongmin-bot",
    "https://bandsustain.com/news/7",
  ]);

  // [0] home: max(latestNews=05-10, latestSong=05-12, latestLive(published)=05-15) = 05-15
  assert.equal(iso(items[0]?.lastModified), "2026-05-15T00:00:00.000Z");
  // [1] songs: latestSongDate = 05-12
  assert.equal(iso(items[1]?.lastModified), "2026-05-12T00:00:00.000Z");
  // [2] news: latestNewsDate = 05-10
  assert.equal(iso(items[2]?.lastModified), "2026-05-10T00:00:00.000Z");
  // [4] live: latestLiveDate(published) = 05-15
  assert.equal(iso(items[4]?.lastModified), "2026-05-15T00:00:00.000Z");
  // [7] playground: now
  assert.equal(iso(items[7]?.lastModified), now.toISOString());
  // [9] news/7: 05-10
  assert.equal(iso(items[9]?.lastModified), "2026-05-10T00:00:00.000Z");
});

test("buildPublicSitemap includes /columns and published column detail URLs", () => {
  const now = new Date("2026-05-27T00:00:00.000Z");
  const result = buildPublicSitemap({
    siteUrl: "https://bandsustain.com",
    now,
    news: [],
    songs: [],
    liveEvents: [],
    columns: [
      { id: 7, lastModified: new Date("2026-05-20T00:00:00.000Z") },
      { id: 9, lastModified: new Date("2026-05-25T00:00:00.000Z") },
    ],
  });
  const urls = result.map((e) => e.url);
  assert.ok(urls.includes("https://bandsustain.com/columns"));
  assert.ok(urls.includes("https://bandsustain.com/columns/7"));
  assert.ok(urls.includes("https://bandsustain.com/columns/9"));
});
