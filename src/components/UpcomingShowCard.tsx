import Link from "next/link";
import { formatLiveDateWithYear, type LiveEvent } from "@/lib/live";

type Props = {
  event: Pick<LiveEvent, "id" | "eventDate" | "venue" | "city" | "ticketUrl">;
};

export default function UpcomingShowCard({ event }: Props) {
  return (
    <section className="border-t border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-10">
        <article className="border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-6 py-6 md:px-8 md:py-7">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
            Upcoming Show
          </p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div className="max-w-2xl">
              <p className="font-display font-black text-2xl md:text-3xl uppercase tracking-tight">
                {event.venue}
              </p>
              <p className="mt-2 text-sm md:text-base text-[var(--color-text-muted)] break-keep">
                {formatLiveDateWithYear(event.eventDate)} · {event.city}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/live"
                className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
              >
                See live schedule
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
