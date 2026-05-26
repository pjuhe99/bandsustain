import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { loadBandNameDataset } from "@/lib/bandName/dataset";
import BandNameGenerator from "./BandNameGenerator";

const description =
  "장르와 분위기를 고르면 어딘가 진짜 있을 것 같은 밴드 이름을 만들어드려요. 단어 조합으로 즉석에서 짓는 인디밴드 작명기.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "밴드 이름 생성기",
  path: "/playground/band-name-generator",
  description,
  keywords: ["밴드 이름 생성기", "밴드 이름 짓기", "인디밴드 작명", "band name generator"],
  ogImage,
});

export default async function BandNameGeneratorPage() {
  const dataset = await loadBandNameDataset();
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 page-fade-in">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link href="/playground" className="underline underline-offset-4 hover:text-[var(--color-text)]">
          Playground
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">밴드 이름 생성기</span>
      </nav>

      <header className="mb-12 md:mb-16 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent)] font-semibold mb-4">
          이상한 도구
        </p>
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl leading-[1.05]">
          밴드 이름 생성기
        </h1>
        <p className="mt-6 text-xl md:text-2xl font-display font-bold text-[var(--color-text)]">
          우리 밴드, 이름부터 만들어볼까요?
        </p>
        <p className="mt-3 text-lg text-[var(--color-text-muted)] leading-relaxed">
          {description}
        </p>
      </header>

      <BandNameGenerator dataset={dataset} />
    </section>
  );
}
