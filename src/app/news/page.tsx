import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { excerpt, formatNewsDate, getPublishedNews } from "@/lib/news";

export const dynamic = "force-dynamic";

const description = "All the news that matters — 안 중요해도 씁니다";
const ogImage = "/news/news01-hero.png";

export const metadata: Metadata = {
  title: "News",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/news",
    title: "News — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "News" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "News — Band Sustain",
    description,
    images: [ogImage],
  },
};

export default async function NewsPage() {
  const items = await getPublishedNews();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-12 md:mb-16">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          News
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          All the news that matters
          <br />
          안 중요해도 씁니다
        </p>
      </header>

      <ul className="divide-y divide-[var(--color-border)]">
        {items.map((n) => (
          <li key={n.id} className="py-10 md:py-14 first:pt-0">
            <Link
              href={`/news/${n.id}`}
              className="group flex flex-col md:flex-row gap-6 md:gap-10"
            >
              <div className="relative md:w-[35%] aspect-[3/2] bg-[var(--color-bg-muted)] shrink-0 overflow-hidden flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                {n.heroImage ? (
                  <Image
                    src={n.heroImage}
                    alt={n.headline}
                    fill
                    sizes="(min-width: 768px) 35vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <span>Hero image</span>
                )}
              </div>
              <div className="flex-1 flex flex-col">
                <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
                  {n.category} · {formatNewsDate(n.date)}
                </p>
                <h2 className="font-display font-bold text-2xl md:text-3xl uppercase tracking-tight mb-4 group-hover:underline underline-offset-4 decoration-2">
                  {n.headline}
                </h2>
                <p className="text-[var(--color-text-muted)] mb-4 leading-[1.6]">
                  {excerpt(n.body, 200)}
                </p>
                <span className="text-sm underline underline-offset-4 mt-auto">
                  Read the article →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
