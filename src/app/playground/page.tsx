import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { buildPageMetadata } from "@/lib/seo";
import { playgroundFeatures, type PlaygroundFeature } from "@/lib/playground";

const description =
  "?쒖뒪?뚯씤??留뚮뱺 ?묒? ??댄꽣. ?댁긽?섍퀬 洹?쎄퀬 ?몃뜲?놁?留?臾섑븯寃?利먭굅??寃껊뱾??紐⑥븘??怨듦컙?낅땲??";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "플레이그라운드",
  path: "/playground",
  description,
  keywords: ["서스테인 플레이그라운드", "밴드 서스테인 콘텐츠", "Band Sustain playground"],
  ogImage,
});

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
          怨?怨듦컻
        </span>
      )}
    </li>
  );
}
