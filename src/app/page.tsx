import Hero from "@/components/Hero";
import NewsCard from "@/components/NewsCard";
import SongGrid from "@/components/SongGrid";
import { sortedByDateDesc as sortedNewsDesc } from "@/data/news";
import { sortedByReleaseDesc } from "@/data/songs";
import Link from "next/link";

export default function Home() {
  const featured = sortedByReleaseDesc().slice(0, 3);
  const latestNews = sortedNewsDesc().slice(0, 3);

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
            {latestNews.map((n) => (
              <NewsCard key={n.id} item={n} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
