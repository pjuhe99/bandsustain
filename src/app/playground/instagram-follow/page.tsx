import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
import InstagramFollowClient from "@/components/playground/instagram/InstagramFollowClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "인스타 맞팔 분석기",
  description:
    "인스타그램 데이터 파일 하나로 나를 맞팔하지 않는 계정과 팔로우 시작일을 확인해보세요.",
  path: "/playground/instagram-follow",
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export default function InstagramFollowPage() {
  if (!isInstagramFollowEnabled()) notFound();
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20 page-fade-in">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link href="/playground" className="underline underline-offset-4 hover:text-[var(--color-text)]">
          Playground
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">인스타 맞팔 분석기</span>
      </nav>
      <div className="max-w-xl">
        <InstagramFollowClient />
      </div>
    </section>
  );
}
