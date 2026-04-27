import type { Metadata } from "next";
import { getPublishedQuotes } from "@/lib/quotes";
import QuoteRow from "@/components/QuoteRow";

// 빌드 시점 pre-render 차단 — DB 미접속 환경에서도 pnpm build 가 성공해야 함.
// 저트래픽 탭이라 per-request DB 쿼리는 비용 문제 없음.
export const dynamic = "force-dynamic";

const description =
  "These are words that don't really help in life — 삶에 별로 도움은 되지 않을 명언들";
const ogImage = "/slides/hero-c28a7f43.jpg";

export const metadata: Metadata = {
  title: "Quote",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/quote",
    title: "Quote — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "Quote" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quote — Band Sustain",
    description,
    images: [ogImage],
  },
};

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
          삶에 별로 도움은 되지 않을 명언들
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
