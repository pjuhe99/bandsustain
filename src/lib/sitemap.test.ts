import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicSitemap } from "./sitemap";

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
    "https://bandsustain.com/live",
    "https://bandsustain.com/members",
    "https://bandsustain.com/quote",
    "https://bandsustain.com/playground",
    "https://bandsustain.com/playground/kim-youngmin-bot",
    "https://bandsustain.com/news/7",
  ]);

  assert.equal(items[0]?.lastModified?.toISOString(), "2026-05-15T00:00:00.000Z");
  assert.equal(items[1]?.lastModified?.toISOString(), "2026-05-12T00:00:00.000Z");
  assert.equal(items[2]?.lastModified?.toISOString(), "2026-05-10T00:00:00.000Z");
  assert.equal(items[3]?.lastModified?.toISOString(), "2026-05-15T00:00:00.000Z");
  assert.equal(items[6]?.lastModified?.toISOString(), now.toISOString());
  assert.equal(items[8]?.lastModified?.toISOString(), "2026-05-10T00:00:00.000Z");
});
