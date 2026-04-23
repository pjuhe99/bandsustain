import Link from "next/link";
import HeroCarousel from "./HeroCarousel";

export default function Hero() {
  return (
    <section className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="max-w-4xl mx-auto px-6 md:px-12 pt-20 md:pt-32 pb-12 md:pb-16 text-center">
        <p className="text-xs md:text-sm font-medium uppercase tracking-[0.25em] text-[var(--color-accent)] mb-6">
          Now playing
        </p>
        <h1 className="font-display font-black uppercase leading-[1.02] tracking-tight text-4xl sm:text-6xl md:text-7xl mb-6">
          SUSTAIN
        </h1>
        <p className="text-lg md:text-2xl font-medium max-w-2xl mx-auto mb-4">
          Music, stories, and experiments.
        </p>
        <p className="text-sm md:text-base text-[var(--color-text-muted)] max-w-xl mx-auto mb-10">
          A new home built from the ground up — no noise, just signal.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/songs"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold uppercase tracking-wider border border-[var(--color-text)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            Explore Music
          </Link>
          <Link
            href="/live"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold uppercase tracking-wider border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 transition-colors"
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
