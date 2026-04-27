import type { Quote } from "@/lib/quotes";
import QuotePortrait from "./QuotePortrait";
import CopyPermalink from "./CopyPermalink";

type Props = {
  quote: Quote;
  index: number;
};

export default function QuoteRow({ quote, index }: Props) {
  const reverse = index % 2 === 1;
  const topBorder = index === 0
    ? "border-t border-[var(--color-text)]"
    : "border-t border-[var(--color-border)]";
  const translationLang = quote.lang === "ko" ? "en" : "ko";

  return (
    <article
      id={`q${quote.id}`}
      lang={quote.lang}
      className={`group scroll-mt-24 ${topBorder} py-8 md:py-10 md:flex md:gap-8 md:items-center ${reverse ? "md:flex-row-reverse" : ""}`}
    >
      <div className="mb-4 md:mb-0 md:w-40 md:flex-shrink-0">
        <QuotePortrait
          portraitUrl={quote.portrait_url}
          attribution={quote.attribution}
        />
      </div>

      <div className={`md:flex-1 ${reverse ? "md:text-right" : ""}`}>
        <blockquote className="font-display font-extrabold text-xl md:text-2xl leading-[1.18] tracking-[-0.01em]">
          &ldquo;{quote.text}&rdquo;
        </blockquote>

        {quote.text_translated && (
          <p
            lang={translationLang}
            className="mt-3 text-sm md:text-base text-[var(--color-text-muted)]"
          >
            &ldquo;{quote.text_translated}&rdquo;
          </p>
        )}

        <div
          className={`mt-5 flex items-center gap-3 ${reverse ? "md:justify-end" : ""}`}
        >
          {quote.attribution && (
            <span className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              — {quote.attribution} —
            </span>
          )}
          <CopyPermalink quoteId={quote.id} />
        </div>
      </div>
    </article>
  );
}
