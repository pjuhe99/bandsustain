import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { playgroundFeatures, type PlaygroundFeature } from "@/lib/playground";

const description =
  "서스테인이 만든 작은 놀이터. 이상하고 귀엽고 쓸데없지만 묘하게 즐거운 것들을 모아둔 공간입니다.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = {
  title: "Playground",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/playground",
    title: "Playground — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "Playground" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playground — Band Sustain",
    description,
    images: [ogImage],
  },
};

export default function PlaygroundPage() {
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-12 md:mb-16">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl">
          Playground
        </h1>
        <p className="mt-6 text-lg text-[var(--color-text-muted)] max-w-2xl leading-relaxed">
          {description}
        </p>
      </header>

      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {playgroundFeatures.map((f) => (
          <PlaygroundCard key={f.slug} feature={f} />
        ))}
      </ul>
    </section>
  );
}

function PlaygroundCard({ feature }: { feature: PlaygroundFeature }) {
  const { title, description: body, cta, href, eyebrow } = feature;

  return (
    <li className="border border-[var(--color-border)] p-6 md:p-8 flex flex-col gap-4">
      {eyebrow && (
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display font-bold text-2xl md:text-3xl leading-tight">
        {title}
      </h2>
      <p className="text-[var(--color-text-muted)] flex-1 leading-relaxed">
        {body}
      </p>
      {href ? (
        <Link href={href} className={buttonClasses("primary", "self-start")}>
          {cta}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)] self-start">
          <span
            className="inline-block w-2 h-2 bg-[var(--color-border-strong)]"
            aria-hidden
          />
          곧 공개
        </span>
      )}
    </li>
  );
}
