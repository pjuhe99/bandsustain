// src/app/playground/mbti-band-casting/share/[data]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { GENRES, POSITIONS } from "@/lib/mbtiCasting/data";
import { recommendBandCasting } from "@/lib/mbtiCasting/engine";
import { decodeCasting } from "@/lib/mbtiCasting/share";
import { BAND_NAME_KR_FULL, SITE_URL } from "@/lib/seo";

type Props = { params: Promise<{ data: string }> };

const CASTING_PATH = "/playground/mbti-band-casting";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await params;
  const input = decodeCasting(data);

  if (!input) {
    return {
      title: `MBTI 밴드 캐스팅 | ${BAND_NAME_KR_FULL}`,
      description: "MBTI와 음악 취향으로 보는 내 밴드 캐릭터.",
      alternates: { canonical: `${SITE_URL}${CASTING_PATH}` },
    };
  }

  const result = recommendBandCasting(input);
  const position = POSITIONS[result.primaryPosition].label;
  const title = `${result.title} — MBTI 밴드 캐스팅`;
  const description = `${input.mbti} · ${GENRES[input.genre].label} — 내 밴드 포지션은 '${position}'. ${result.description}`;
  const url = `${SITE_URL}${CASTING_PATH}/share/${data}`;

  return {
    title: `${title} | ${BAND_NAME_KR_FULL}`,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, locale: "ko_KR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CastingSharePage({ params }: Props) {
  const { data } = await params;
  const input = decodeCasting(data);

  if (!input) {
    return (
      <section className="max-w-3xl mx-auto px-6 md:px-12 py-24 text-center page-fade-in">
        <h1 className="font-display font-black text-3xl md:text-4xl">결과를 찾을 수 없어요</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">공유 링크가 올바르지 않은 것 같아요. 직접 캐스팅해보세요.</p>
        <Link href={CASTING_PATH} className={buttonClasses("primary", "mt-8")}>캐스팅 시작하기</Link>
      </section>
    );
  }

  const result = recommendBandCasting(input);
  const primary = POSITIONS[result.primaryPosition];

  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-20 md:py-28 text-center page-fade-in">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent)] font-semibold mb-6">MBTI 밴드 캐스팅</p>

      <div className="flex flex-wrap gap-2 justify-center mb-6">
        <span className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-semibold bg-[var(--color-text)] text-[var(--color-bg)]">{input.mbti}</span>
        <span className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">{GENRES[input.genre].label}</span>
      </div>

      <p className="text-sm text-[var(--color-text-muted)] mb-3">{primary.icon} {primary.label}</p>
      <h1 className="font-display font-black text-3xl sm:text-4xl md:text-6xl leading-[1.05] tracking-tight break-keep [overflow-wrap:anywhere]">
        {result.title}
      </h1>
      <p className="mt-5 text-base md:text-lg text-[var(--color-text-muted)] leading-relaxed max-w-xl mx-auto">{result.description}</p>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {result.moodTags.map((tag) => (
          <span key={tag} className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">{tag}</span>
        ))}
      </div>

      <ul className="mt-10 text-left max-w-xl mx-auto grid grid-cols-1 gap-2">
        {result.songs.map((song) => (
          <li key={song.id} className="border border-[var(--color-border)] p-3 flex items-center justify-between gap-3">
            <span className="min-w-0 break-keep [overflow-wrap:anywhere]"><span className="font-medium">{song.title}</span> <span className="text-[var(--color-text-muted)] text-sm">/ {song.artist}</span></span>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.06em] border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-muted)]">{song.difficultyLabel}</span>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={CASTING_PATH} className={buttonClasses("accent")}>나도 캐스팅해보기</Link>
        <Link href="/playground" className={buttonClasses("secondary")}>플레이그라운드 둘러보기</Link>
      </div>

      <p className="mt-12 text-xs text-[var(--color-text-muted)] leading-relaxed">{result.disclaimer}</p>
    </section>
  );
}
