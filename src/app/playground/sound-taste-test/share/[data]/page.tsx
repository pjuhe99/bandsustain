import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { createTestResult } from "@/lib/soundTaste/engine";
import { decodeShareProfile } from "@/lib/soundTaste/share";
import { BAND_NAME_KR_FULL, SITE_URL } from "@/lib/seo";

type Props = { params: Promise<{ data: string }> };

const TEST_PATH = "/playground/sound-taste-test";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await params;
  const profile = decodeShareProfile(data);

  if (!profile) {
    return {
      title: `사운드 취향 테스트 | ${BAND_NAME_KR_FULL}`,
      description:
        "장르 이름 대신, 마음이 끌리는 장면과 소리를 골라보세요. 16개의 선택 끝에 당신과 닮은 밴드 음악을 추천해드려요.",
      alternates: { canonical: `${SITE_URL}${TEST_PATH}` },
    };
  }

  const result = createTestResult(profile);
  const title = `${result.mainGenre.resultTitle} — 사운드 취향 테스트`;
  const description = `내 사운드 타입은 '${result.mainGenre.resultTitle}' (${result.mainGenre.name}). 16문항으로 당신과 닮은 밴드 음악을 찾아보세요.`;
  const url = `${SITE_URL}${TEST_PATH}/share/${data}`;

  return {
    title: `${title} | ${BAND_NAME_KR_FULL}`,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, locale: "ko_KR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export default async function SoundTasteSharePage({ params }: Props) {
  const { data } = await params;
  const profile = decodeShareProfile(data);

  if (!profile) {
    return (
      <section className="max-w-3xl mx-auto px-6 md:px-12 py-24 text-center page-fade-in">
        <h1 className="font-display font-black text-3xl md:text-4xl">
          결과를 찾을 수 없어요
        </h1>
        <p className="mt-4 text-[var(--color-text-muted)]">
          공유 링크가 올바르지 않은 것 같아요. 직접 테스트를 해보세요.
        </p>
        <Link href={TEST_PATH} className={buttonClasses("primary", "mt-8")}>
          테스트 하러 가기
        </Link>
      </section>
    );
  }

  const { mainGenre, subGenres, tags, recommendedTracks } = createTestResult(profile);

  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24 page-fade-in">
      <div className="overflow-hidden border border-[var(--color-border)]">
        <div
          className={`bg-gradient-to-br ${mainGenre.visual.gradient} px-6 py-10 md:py-12 flex flex-col items-center text-center`}
        >
          <span className="text-5xl md:text-6xl drop-shadow-sm" aria-hidden>
            {mainGenre.visual.icon}
          </span>
        </div>
        <div className="px-6 py-8 md:px-8 md:py-10 text-center">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold mb-3">
            누군가의 사운드 타입
          </p>
          <h1 className="font-display font-black text-2xl md:text-4xl leading-tight break-keep">
            {mainGenre.resultTitle}
          </h1>
          <p className="mt-4 text-base md:text-lg text-[var(--color-text-muted)] leading-relaxed break-keep">
            {mainGenre.description}
          </p>
          {tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2 justify-center">
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="text-sm border border-[var(--color-text)] px-3 py-1 font-medium"
                >
                  #{tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-10 text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold">
        가까운 사운드
      </p>
      <p className="mt-2 font-display font-bold text-lg break-keep">
        {mainGenre.name}
        <span className="text-[var(--color-text-muted)] font-normal">
          {" "}
          · {subGenres.map((g) => g.name).join(" · ")}
        </span>
      </p>

      <p className="mt-8 text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold">
        추천곡
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {recommendedTracks.map((track) => (
          <li
            key={track.id}
            className="flex items-center justify-between gap-3 border border-[var(--color-border)] px-4 py-3"
          >
            <span className="min-w-0 break-keep">
              <span className="font-bold">{track.artist}</span>
              <span className="text-[var(--color-text-muted)]"> — {track.title}</span>
            </span>
            <a
              href={youtubeSearchUrl(track.searchQuery)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs whitespace-nowrap border border-[var(--color-border)] px-3 py-1.5 hover:border-[var(--color-text)] hover:bg-[var(--color-bg-muted)] transition-colors"
            >
              들어보기 ↗
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={TEST_PATH} className={buttonClasses("accent")}>
          나도 테스트 해보기
        </Link>
        <Link href="/playground" className={buttonClasses("secondary")}>
          플레이그라운드 둘러보기
        </Link>
      </div>

      <p className="mt-14 text-center text-sm text-[var(--color-text-muted)]">
        {BAND_NAME_KR_FULL} · 내 귀는 어떤 밴드 사운드에 반응할까?
      </p>
    </section>
  );
}
