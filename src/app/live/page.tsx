import type { Metadata } from "next";
import {
  getUpcomingEvents,
  getPastEventsByYear,
  formatLiveDate,
  formatLiveDateWithYear,
  type LiveEvent,
} from "@/lib/live";

export const dynamic = "force-dynamic";

const description = "Band Sustain 공연 일정 — 예정 공연과 지나간 라이브.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = {
  title: "Live",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/live",
    title: "Live — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "Live" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Live — Band Sustain",
    description,
    images: [ogImage],
  },
};

export default async function LivePage() {
  const [upcoming, pastByYear] = await Promise.all([
    getUpcomingEvents(),
    getPastEventsByYear(),
  ]);
  const hasUpcoming = upcoming.length > 0;
  const pastYears = [...pastByYear.keys()];
  const hasPast = pastYears.length > 0;

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-12 md:mb-16">
        Live
      </h1>

      {!hasUpcoming && !hasPast && (
        <p className="text-[var(--color-text-muted)]">Coming soon.</p>
      )}

      {hasUpcoming && (
        <section className="mb-16 md:mb-24">
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-6 pb-3 border-b border-[var(--color-border)]">
            Upcoming Shows
          </h2>
          <ul>
            {upcoming.map((ev) => (
              <EventRow key={ev.id} event={ev} showYear />
            ))}
          </ul>
        </section>
      )}

      {hasPast && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-6 pb-3 border-b border-[var(--color-border)]">
            Past Shows
          </h2>
          {pastYears.map((year) => (
            <div key={year} className="mb-10 md:mb-14">
              <h3 className="font-display font-black text-2xl md:text-3xl mb-4">{year}</h3>
              <ul>
                {pastByYear.get(year)!.map((ev) => (
                  <EventRow key={ev.id} event={ev} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {hasUpcoming && !hasPast && (
        <p className="text-[var(--color-text-muted)] mt-12">지나간 공연 기록 준비 중.</p>
      )}
    </section>
  );
}

function EventRow({ event, showYear = false }: { event: LiveEvent; showYear?: boolean }) {
  return (
    <li className="grid grid-cols-1 md:grid-cols-[180px_1fr_140px_44px] md:items-baseline gap-2 md:gap-6 py-5 border-b border-[var(--color-border)]">
      <div className="font-display font-bold text-lg md:text-xl tracking-wide">
        {showYear ? formatLiveDateWithYear(event.eventDate) : formatLiveDate(event.eventDate)}
      </div>
      <div>
        <div className="font-medium">{event.venue}</div>
        <div className="text-sm text-[var(--color-text-muted)]">{event.city}</div>
      </div>
      <div className="md:text-right">
        {event.ticketUrl ? (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
          >
            Tickets
          </a>
        ) : null}
      </div>
      <div className="md:text-right">
        {event.videoUrl ? (
          <a
            href={event.videoUrl}
            target="_blank"
            rel="noopener"
            aria-label="Watch video"
            title="Watch video"
            className="inline-flex items-center justify-center w-11 h-11 border border-[var(--color-border-strong)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            <PlayIcon />
          </a>
        ) : null}
      </div>
    </li>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
      <path d="M0 0L14 8L0 16Z" fill="currentColor" />
    </svg>
  );
}
