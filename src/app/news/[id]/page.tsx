import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { excerpt, formatNewsDate, news } from "@/data/news";

export function generateStaticParams() {
  return news.map((n) => ({ id: n.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = news.find((n) => n.id === id);
  if (!item) return {};

  const description = excerpt(item.body, 200);
  const url = `https://bandsustain.com/news/${item.id}`;

  return {
    title: item.headline,
    description,
    openGraph: {
      type: "article",
      siteName: "Band Sustain",
      url,
      title: item.headline,
      description,
      images: [{ url: item.heroImage, alt: item.headline }],
      locale: "ko_KR",
      publishedTime: item.date,
    },
    twitter: {
      card: "summary_large_image",
      title: item.headline,
      description,
      images: [item.heroImage],
    },
  };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = news.find((n) => n.id === id);
  if (!item) notFound();

  const paragraphs = item.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const midIndex = item.midImage
    ? Math.max(0, Math.floor(paragraphs.length / 2) - 1)
    : -1;

  return (
    <article className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <nav className="text-sm text-[var(--color-text-muted)] mb-8">
        <Link href="/" className="underline underline-offset-4">
          Home
        </Link>
        <span className="mx-2">›</span>
        <Link href="/news" className="underline underline-offset-4">
          News
        </Link>
      </nav>

      <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
        {item.category} · {formatNewsDate(item.date)}
      </p>
      <h1 className="font-display font-black uppercase tracking-tight leading-[1.05] text-3xl md:text-5xl mb-10 md:mb-12">
        {item.headline}
      </h1>

      <figure className="relative aspect-[3/2] bg-[var(--color-bg-muted)] mb-12 md:mb-16 overflow-hidden flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        {item.heroImage ? (
          <Image
            src={item.heroImage}
            alt={item.headline}
            fill
            priority
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        ) : (
          <span>Hero image</span>
        )}
      </figure>

      <div className="text-base md:text-lg leading-[1.75]">
        {paragraphs.map((p, i) => (
          <div key={i}>
            <p className="mb-6">{p}</p>
            {item.midImage && i === midIndex && (
              <figure className="relative aspect-[3/2] bg-[var(--color-bg-muted)] my-10 md:my-12 overflow-hidden flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                <Image
                  src={item.midImage}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 768px, 100vw"
                  className="object-cover"
                />
              </figure>
            )}
          </div>
        ))}
      </div>

      <nav className="mt-16 md:mt-20 pt-6 border-t border-[var(--color-border)]">
        <Link href="/news" className="text-sm underline underline-offset-4">
          ← Back to News
        </Link>
      </nav>
    </article>
  );
}
