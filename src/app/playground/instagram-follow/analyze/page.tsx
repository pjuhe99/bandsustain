import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
import InstagramFollowClient from "@/components/playground/instagram/InstagramFollowClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "언팔 수사 & 팔로우 기간 분석",
  description:
    "인스타그램 데이터 파일 하나로 서스테인 팔로우 기간과 나를 맞팔하지 않는 계정을 확인해보세요.",
  path: "/playground/instagram-follow/analyze",
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export default function InstagramFollowAnalyzePage() {
  if (!isInstagramFollowEnabled()) notFound();
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-12 md:py-20 page-fade-in">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link href="/playground" className="underline underline-offset-4 hover:text-[var(--color-text)]">
          Playground
        </Link>
        <span aria-hidden>›</span>
        <Link
          href="/playground/instagram-follow"
          className="underline underline-offset-4 hover:text-[var(--color-text)]"
        >
          찐팬 랭킹 & 언팔 수사대
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">언팔 수사 & 기록 분석</span>
      </nav>
      <div className="mx-auto max-w-xl">
        <InstagramFollowClient />
      </div>
    </section>
  );
}
