import assert from "node:assert/strict";
import test from "node:test";
import { buildPageMetadata, buildRootMetadata } from "./seo";

test("buildRootMetadata emphasizes the Korean band brand on the homepage", () => {
  const metadata = buildRootMetadata();

  assert.equal(metadata.title, "밴드 서스테인 | Band Sustain 공식 사이트");
  assert.equal(
    metadata.description,
    "밴드 서스테인(Band Sustain) 공식 사이트. 서스테인 음악, 공연 일정, 멤버 소개, 뉴스, 플레이그라운드 콘텐츠를 확인하세요.",
  );
  assert.deepEqual(metadata.keywords, [
    "서스테인",
    "밴드 서스테인",
    "Band Sustain",
    "Sustain",
    "서스테인 밴드",
    "bandsustain",
  ]);
});

test("buildPageMetadata adds canonical, branded titles, and page keywords", () => {
  const metadata = buildPageMetadata({
    title: "플레이그라운드",
    path: "/playground",
    description:
      "밴드 서스테인이 만든 실험적이고 재미있는 콘텐츠를 모아둔 플레이그라운드 페이지.",
    keywords: ["서스테인 플레이그라운드", "김영민 봇"],
    ogImage: "/slides/hero-b4d9e516.jpg",
  });

  assert.equal(metadata.title, "플레이그라운드 | 밴드 서스테인");
  assert.equal(metadata.alternates?.canonical, "https://bandsustain.com/playground");
  assert.deepEqual(metadata.keywords, [
    "서스테인",
    "밴드 서스테인",
    "Band Sustain",
    "Sustain",
    "서스테인 밴드",
    "bandsustain",
    "서스테인 플레이그라운드",
    "김영민 봇",
  ]);
  assert.equal(metadata.openGraph?.url, "https://bandsustain.com/playground");
  assert.equal(metadata.openGraph?.siteName, "밴드 서스테인 | Band Sustain");
  assert.deepEqual(metadata.twitter?.images, ["/slides/hero-b4d9e516.jpg"]);
});
