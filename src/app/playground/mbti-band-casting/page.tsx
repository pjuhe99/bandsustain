// src/app/playground/mbti-band-casting/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import MbtiBandCasting from "./MbtiBandCasting";

const description =
  "MBTI와 음악 취향을 고르면 내가 밴드 멤버라면 어떤 포지션일지, 어울리는 커버곡과 첫 장비까지 추천해드려요. 재미로 보는 밴드 캐릭터 발견 놀이.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "MBTI 밴드 캐스팅",
  path: "/playground/mbti-band-casting",
  description,
  keywords: ["MBTI 밴드", "밴드 포지션 테스트", "MBTI 밴드 캐스팅", "밴드 멤버 추천"],
  ogImage,
});

export default function MbtiBandCastingPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24 page-fade-in">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link href="/playground" className="underline underline-offset-4 hover:text-[var(--color-text)]">
          Playground
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">MBTI 밴드 캐스팅</span>
      </nav>

      <header className="mb-10 md:mb-14 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent)] font-semibold mb-4">
          이상한 도구
        </p>
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl leading-[1.05]">
          MBTI 밴드 캐스팅
        </h1>
        <p className="mt-6 text-xl md:text-2xl font-display font-bold text-[var(--color-text)]">
          내 MBTI가 밴드 멤버가 된다면?
        </p>
        <p className="mt-3 text-lg text-[var(--color-text-muted)] leading-relaxed">
          포지션부터 커버곡, 첫 장비까지 추천받아보세요.
        </p>
      </header>

      <MbtiBandCasting />
    </section>
  );
}
