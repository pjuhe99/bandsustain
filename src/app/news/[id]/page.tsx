import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { excerpt, formatNewsDate, getNewsById } from "@/lib/news";
import { buildNewsArticleSchema } from "@/lib/seo";
import { Fragment } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return {};
  const item = await getNewsById(numId);
  if (!item || !item.published) return {};

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
      publishedTime: formatNewsDate(item.date),
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
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const item = await getNewsById(numId);
  if (!item || !item.published) notFound();

  const paragraphs = item.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const midIndex = item.midImage
    ? Math.max(0, Math.floor(paragraphs.length / 2) - 1)
    : -1;

  return (
    <article className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <JsonLd data={buildNewsArticleSchema(item)} />
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
            <p className="mb-6">
              {p.split("\n").map((line, j, arr) => (
                <Fragment key={j}>
                  {line}
                  {j < arr.length - 1 && <br />}
                </Fragment>
              ))}
            </p>
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
