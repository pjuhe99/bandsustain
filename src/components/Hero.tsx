import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-[--color-bg] text-[--color-text]">
      <div className="max-w-4xl mx-auto px-6 md:px-12 pt-20 md:pt-32 pb-16 md:pb-20 text-center">
        <p className="text-xs md:text-sm font-medium uppercase tracking-[0.25em] text-[--color-accent] mb-6">
          Now playing
        </p>
        <h1 className="font-display font-black uppercase leading-[1.02] tracking-tight text-5xl md:text-7xl mb-6">
          bandsustain
        </h1>
        <p className="text-lg md:text-2xl font-medium max-w-2xl mx-auto mb-4">
          Music, stories, and experiments.
        </p>
        <p className="text-sm md:text-base text-[--color-text-muted] max-w-xl mx-auto mb-10">
          A new home built from the ground up — no noise, just signal.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16 md:mb-20">
          <Link
            href="/music"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold uppercase tracking-wider border border-[--color-text] bg-transparent text-[--color-text] hover:bg-[--color-text] hover:text-[--color-bg] transition-colors"
          >
            Explore Music
          </Link>
          <Link
            href="/live"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold uppercase tracking-wider border border-[--color-accent] bg-[--color-accent] text-[--color-accent-ink] hover:opacity-90 transition-colors"
          >
            Live Schedule
          </Link>
        </div>

        {/* Video/feature embed placeholder */}
        <div className="aspect-video bg-[--color-bg-muted] flex items-center justify-center group cursor-pointer">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[--color-bg] border border-[--color-border-strong] flex items-center justify-center group-hover:bg-[--color-text] transition-colors">
            <span className="block w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-[--color-text] group-hover:border-l-[--color-bg] ml-1 transition-colors" />
          </div>
        </div>
      </div>
    </section>
  );
}
