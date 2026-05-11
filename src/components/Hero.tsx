import Link from "next/link";
import HeroCarousel from "./HeroCarousel";

export default function Hero() {
  return (
    <section className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="max-w-4xl mx-auto px-6 md:px-12 pt-20 md:pt-28 pb-12 md:pb-16 text-center">
        <h1 className="font-display font-black uppercase leading-[1.02] tracking-tight text-4xl sm:text-6xl md:text-7xl mb-8">
          SUSTAIN
        </h1>
        <p className="text-lg md:text-2xl font-medium break-keep max-w-2xl mx-auto mb-4">
          오래 남는 소리, 계속 이어지는 감정
        </p>
        <p className="text-sm md:text-base leading-relaxed break-keep text-[var(--color-text-muted)] max-w-xl mx-auto mb-10">
          감성적인 멜로디와 선명한 밴드 사운드로 순간의 마음을 오래 남기는 음악을 만듭니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/songs"
            className="inline-flex items-center justify-center px-9 py-3.5 text-sm font-semibold uppercase tracking-wider border border-[var(--color-accent)] bg-transparent text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)] transition-colors duration-200"
          >
            Explore Music
          </Link>
          <Link
            href="/live"
            className="inline-flex items-center justify-center px-9 py-3.5 text-sm font-semibold uppercase tracking-wider border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:bg-transparent hover:text-[var(--color-accent)] transition-colors duration-200"
          >
            Live Schedule
          </Link>
        </div>
      </div>

      <div className="pb-16 md:pb-20">
        <HeroCarousel />
      </div>
    </section>
  );
}
