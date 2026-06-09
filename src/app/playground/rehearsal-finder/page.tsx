import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsal/rehearsalFlag";
import { getRegionFacets } from "@/lib/playground/rehearsal/studios";
import RehearsalFinderEntry from "./RehearsalFinderEntry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "합주실 추천",
  path: "/playground/rehearsal-finder",
  description: "멤버 출발 위치 또는 지역·가격 조건으로 합주실을 찾아보세요.",
  keywords: ["합주실 추천", "밴드 합주실"],
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export default async function RehearsalFinderPage() {
  if (!isRehearsalFinderEnabled()) notFound();
  const regionFacets = await getRegionFacets();
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20">
      <header className="mb-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">
          합주실 추천
          <span className="ml-3 align-middle inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-[var(--color-accent)] text-[var(--color-accent-ink)]">
            BETA
          </span>
        </h1>
        <p className="mt-4 text-[var(--color-text-muted)]">멤버 출발 위치로 추천받거나, 지역·가격 조건으로 직접 골라 합주실을 찾아보세요.</p>
        <p className="mt-4 rounded border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
          🧪 아직 베타 기능이에요 — 추천 결과가 부정확하거나 빠진 합주실이 있을 수 있어요.
        </p>
      </header>
      <RehearsalFinderEntry regionFacets={regionFacets} />
    </section>
  );
}
