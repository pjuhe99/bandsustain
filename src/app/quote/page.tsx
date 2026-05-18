import type { Metadata } from "next";
import QuoteRow from "@/components/QuoteRow";
import { getPublishedQuotes } from "@/lib/quotes";
import { buildPageMetadata } from "@/lib/seo";

// Prevent build-time prerendering so production builds still work without a DB.
// This page is lightweight enough to render from the database per request.
export const dynamic = "force-dynamic";

const description =
  "밴드 서스테인 멤버들의 문장과 인용문을 모아둔 페이지. 공연장 바깥의 말과 분위기도 함께 남깁니다.";
const ogImage = "/slides/hero-c28a7f43.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "인용문",
  path: "/quote",
  description,
  keywords: ["서스테인 인용문", "밴드 서스테인 명언", "Band Sustain quotes"],
  ogImage,
});

export default async function QuotePage() {
  const quotes = await getPublishedQuotes();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-10 md:mb-12">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Quote
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          These are words that don&apos;t really help in life
          <br />
          그런데 이상하게 오래 남는 말들
        </p>
      </header>

      {quotes.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          Nothing quotable yet. / 아직 인용할 만한 말이 없습니다.
        </p>
      ) : (
        <div>
          {quotes.map((q, i) => (
            <QuoteRow key={q.id} quote={q} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
