import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { decodeShare, shareTagsFor } from "@/lib/bandName/share";
import { BAND_NAME_KR_FULL, SITE_URL } from "@/lib/seo";

type Props = { params: Promise<{ data: string }> };

const GENERATOR_PATH = "/playground/band-name-generator";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await params;
  const payload = decodeShare(data);

  // opengraph-image 는 이 세그먼트에 colocate 되어 Next 가 자동으로 og:image /
  // twitter:image 에 붙인다. 여기서는 제목/설명/canonical 만 채운다.
  if (!payload) {
    return {
      title: `밴드 이름 생성기 | ${BAND_NAME_KR_FULL}`,
      description: "장르와 분위기를 고르면 어딘가 진짜 있을 것 같은 밴드 이름을 만들어드려요.",
      alternates: { canonical: `${SITE_URL}${GENERATOR_PATH}` },
    };
  }

  const tags = shareTagsFor(payload);
  const title = `${payload.name} — 밴드 이름 생성기`;
  const description = `'${payload.name}' (${tags.join(" · ")}) — 우리 밴드, 이름부터 만들어볼까요? 장르와 분위기를 고르면 어딘가 진짜 있을 것 같은 밴드 이름을 만들어드려요.`;
  const url = `${SITE_URL}${GENERATOR_PATH}/share/${data}`;

  return {
    title: `${title} | ${BAND_NAME_KR_FULL}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BandNameSharePage({ params }: Props) {
  const { data } = await params;
  const payload = decodeShare(data);

  if (!payload) {
    return (
      <section className="max-w-3xl mx-auto px-6 md:px-12 py-24 text-center page-fade-in">
        <h1 className="font-display font-black text-3xl md:text-4xl">이름을 찾을 수 없어요</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">
          공유 링크가 올바르지 않은 것 같아요. 직접 새 이름을 만들어보세요.
        </p>
        <Link href={GENERATOR_PATH} className={buttonClasses("primary", "mt-8")}>
          이름 만들러 가기
        </Link>
      </section>
    );
  }

  const tags = shareTagsFor(payload);

  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-20 md:py-28 text-center page-fade-in">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent)] font-semibold mb-6">
        밴드 이름 생성기
      </p>

      <p className="text-sm text-[var(--color-text-muted)] mb-3">당신의 밴드 이름은…</p>
      <h1 className="font-display font-black text-5xl md:text-7xl leading-[1.05] tracking-tight break-keep">
        {payload.name}
      </h1>

      <div className="mt-7 flex flex-wrap gap-2 justify-center">
        {tags.map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={GENERATOR_PATH} className={buttonClasses("accent")}>
          나도 이름 만들어보기
        </Link>
        <Link href="/playground" className={buttonClasses("secondary")}>
          플레이그라운드 둘러보기
        </Link>
      </div>

      <p className="mt-14 text-sm text-[var(--color-text-muted)]">
        {BAND_NAME_KR_FULL} · 우리 밴드, 이름부터 만들어볼까요?
      </p>
    </section>
  );
}
