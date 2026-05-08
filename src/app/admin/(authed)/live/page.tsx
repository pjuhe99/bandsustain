import Link from "next/link";
import { listAllLiveEvents, todayKST, formatLiveDate } from "@/lib/live";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedLive } from "./actions";

export const dynamic = "force-dynamic";

export default async function LiveListPage() {
  const items = await listAllLiveEvents();
  const today = todayKST();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Live</h1>
        <Link
          href="/admin/live/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새 공연 등록
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <tr>
              <th className="py-2 w-28">날짜</th>
              <th className="py-2 w-24">상태</th>
              <th className="py-2">공연장</th>
              <th className="py-2 w-32">도시</th>
              <th className="py-2 w-16 text-center">티켓</th>
              <th className="py-2 w-16 text-center">영상</th>
              <th className="py-2 w-24">공개</th>
              <th className="py-2 w-20 text-right">동작</th>
            </tr>
          </thead>
          <tbody>
            {items.map((ev) => {
              const isUpcoming = ev.eventDate >= today;
              return (
                <tr key={ev.id} className="border-b border-[var(--color-border)]">
                  <td className="py-3 tabular-nums font-mono text-xs">{ev.eventDate}</td>
                  <td className="py-3 text-xs uppercase tracking-wider">
                    {isUpcoming ? (
                      <span className="text-[var(--color-text)]">Upcoming</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">Past</span>
                    )}
                  </td>
                  <td className="py-3 font-medium">
                    <span className="text-[var(--color-text-muted)] text-xs mr-2">
                      {formatLiveDate(ev.eventDate)}
                    </span>
                    {ev.venue}
                  </td>
                  <td className="py-3 text-[var(--color-text-muted)]">{ev.city}</td>
                  <td className="py-3 text-center">{ev.ticketUrl ? "✓" : "—"}</td>
                  <td className="py-3 text-center">{ev.videoUrl ? "▶" : "—"}</td>
                  <td className="py-3">
                    <PublishedToggle
                      published={ev.published}
                      toggleAction={async () => {
                        "use server";
                        await togglePublishedLive(ev.id, ev.published);
                      }}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/admin/live/${ev.id}`}
                      className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]"
                    >
                      편집
                    </Link>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--color-text-muted)]">
                  등록된 공연이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
