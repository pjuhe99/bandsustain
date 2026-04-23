import Hero from "@/components/Hero";
import SongGrid from "@/components/SongGrid";
import { sortedByReleaseDesc } from "@/data/songs";
import Link from "next/link";

const news = [
  {
    id: 1,
    category: "News",
    title: "Announcing the first studio session recordings",
    date: "Apr 22, 2026",
  },
  {
    id: 2,
    category: "Tour",
    title: "Spring run — small rooms across the peninsula",
    date: "Apr 15, 2026",
  },
  {
    id: 3,
    category: "Studio",
    title: "Behind the scenes: building the mix",
    date: "Apr 03, 2026",
  },
];

export default function Home() {
  const featured = sortedByReleaseDesc().slice(0, 3);

  return (
    <>
      <Hero />

      {/* Featured Releases */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="flex items-end justify-between mb-10 md:mb-12">
          <div>
            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tight">
              Featured Releases
            </h2>
            <p className="text-[var(--color-text-muted)] mt-2">Latest and upcoming.</p>
          </div>
          <Link
            href="/songs"
            className="hidden md:inline text-sm underline underline-offset-4"
          >
            View all →
          </Link>
        </div>
        <SongGrid items={featured} />
      </section>

      {/* News */}
      <section className="border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
          <div className="flex items-end justify-between mb-10 md:mb-12">
            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tight">
              Latest News
            </h2>
            <Link
              href="/news"
              className="hidden md:inline text-sm underline underline-offset-4"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {news.map((n) => (
              <article key={n.id} className="flex flex-col border-t border-[var(--color-text)] pt-4">
                <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
                  {n.category} · {n.date}
                </p>
                <h3 className="font-semibold text-lg md:text-xl mb-4 underline underline-offset-4 decoration-1 hover:decoration-2">
                  <a href="#">{n.title}</a>
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
