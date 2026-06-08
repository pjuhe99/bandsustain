import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsal/rehearsalFlag";
import RehearsalFinderEntry from "./RehearsalFinderEntry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "합주실 추천",
  path: "/playground/rehearsal-finder",
  description: "멤버 출발 위치 또는 지역·가격 조건으로 합주실을 찾아보세요.",
  keywords: ["합주실 추천", "밴드 합주실"],
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export default function RehearsalFinderPage() {
  if (!isRehearsalFinderEnabled()) notFound();
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20">
      <header className="mb-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">합주실 추천</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">멤버 출발 위치로 추천받거나, 지역·가격 조건으로 직접 골라 합주실을 찾아보세요.</p>
      </header>
      <RehearsalFinderEntry />
    </section>
  );
}
