import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { excerpt, formatNewsDate, getPublishedNews } from "@/lib/news";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const description =
  "밴드 서스테인 뉴스 페이지. 공연 소식, 새 음악, 멤버 이야기와 플레이그라운드 업데이트를 한곳에서 확인하세요.";
const ogImage = "/news/news01-hero.png";

export const metadata: Metadata = buildPageMetadata({
  title: "뉴스",
  path: "/news",
  description,
  keywords: ["서스테인 뉴스", "밴드 서스테인 소식", "Band Sustain news"],
  ogImage,
});

export default async function NewsPage() {
  const items = await getPublishedNews();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-12 md:mb-16">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          News
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          News you probably shouldn't trust
          <br />
          믿지는 마시고, 읽어는 보세요
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
