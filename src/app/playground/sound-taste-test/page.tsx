import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import SoundTasteTest from "./SoundTasteTest";

const description =
  "장르 이름 대신 마음이 끌리는 장면과 소리를 고르면, 당신과 닮은 밴드 음악과 추천곡을 찾아드려요. 16문항 사운드 취향 테스트.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "사운드 취향 테스트",
  path: "/playground/sound-taste-test",
  description,
  keywords: [
    "사운드 취향 테스트",
    "밴드 음악 취향 테스트",
    "장르 추천 테스트",
    "음악 취향 테스트",
  ],
  ogImage,
});

export default function SoundTasteTestPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-12 md:py-20 page-fade-in">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link
          href="/playground"
          className="underline underline-offset-4 hover:text-[var(--color-text)]"
        >
          Playground
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">사운드 취향 테스트</span>
      </nav>

      <SoundTasteTest />
    </section>
  );
}
