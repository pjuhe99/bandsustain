import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import RebirthExperience from "./RebirthExperience";

const description =
  "2026년 전 세계 출생과 인구 통계로 태어날 국가와 도시를 정하고, 지역 경제와 소득·소비 분포로 가정의 출발점까지 뽑아보세요.";

export const metadata: Metadata = buildPageMetadata({
  title: "다시 태어난다면",
  path: "/playground/rebirth",
  description,
  keywords: ["다시 태어난다면", "랜덤 출생 국가", "랜덤 도시", "세계 소득 분포", "환생 시뮬레이터"],
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export default function RebirthPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 page-fade-in md:px-12 md:py-24">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link href="/playground" className="underline underline-offset-4 hover:text-[var(--color-text)]">Playground</Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">다시 태어난다면</span>
      </nav>

      <header className="mb-10 max-w-3xl md:mb-14">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">통계로 뽑는 또 다른 삶</p>
        <h1 className="font-display text-4xl font-black uppercase leading-[1.05] tracking-tight md:text-6xl">다시 태어난다면</h1>
        <p className="mt-6 font-display text-xl font-bold md:text-2xl">수많은 우연 너머의 삶을 그려볼 때, 비로소 지금의 내가 기적처럼 다가오니까.</p>
        <p className="mt-3 text-base leading-relaxed text-[var(--color-text-muted)] md:text-lg">
          {description} 같은 나라, 같은 도시에서도 전혀 다른 삶이 시작될 수 있다는 것을 확률로 살펴보는 시뮬레이션입니다.
        </p>
      </header>

      <RebirthExperience />
    </section>
  );
}
