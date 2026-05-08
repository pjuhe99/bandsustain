import Link from "next/link";
import { getPool } from "@/lib/db";
import { countMembers } from "@/lib/members";
import { countSongs } from "@/lib/songs";
import { countNews } from "@/lib/news";
import { countQuotes } from "@/lib/quotes";
import { countLiveEvents } from "@/lib/live";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

type Recent = {
  resource: "members" | "songs" | "news" | "quotes" | "live";
  id: number;
  label: string;
  ts: Date;
};

async function getRecent(): Promise<Recent[]> {
  const pool = getPool();
  const [rows] = await pool.query<(RowDataPacket & {
    resource: Recent["resource"];
    id: number;
    label: string;
    ts: Date;
  })[]>(
    `SELECT * FROM (
      (SELECT 'members' AS resource, id, name_en AS label, updated_at AS ts FROM members)
      UNION ALL
      (SELECT 'songs' AS resource, id, title AS label, updated_at AS ts FROM songs)
      UNION ALL
      (SELECT 'news' AS resource, id, headline AS label, updated_at AS ts FROM news)
      UNION ALL
      (SELECT 'quotes' AS resource, id, COALESCE(attribution, LEFT(text, 40)) AS label, created_at AS ts FROM quotes)
      UNION ALL
      (SELECT 'live' AS resource, id,
              CONCAT(DATE_FORMAT(event_date, '%Y-%m-%d'), ' ', venue) AS label,
              updated_at AS ts FROM live_events)
    ) AS u ORDER BY ts DESC LIMIT 5`,
  );
  return rows.map((r) => ({
    resource: r.resource,
    id: r.id,
    label: r.label,
    ts: r.ts instanceof Date ? r.ts : new Date(r.ts),
  }));
}

const cards = [
  { resource: "members" as const, label: "Members" },
  { resource: "songs" as const, label: "Songs" },
  { resource: "news" as const, label: "News" },
  { resource: "quotes" as const, label: "Quotes" },
  { resource: "live" as const, label: "Live" },
];

export default async function DashboardPage() {
  const [m, s, n, q, l, recent] = await Promise.all([
    countMembers(),
    countSongs(),
    countNews(),
    countQuotes(),
    countLiveEvents(),
    getRecent(),
  ]);
  const counts = { members: m, songs: s, news: n, quotes: q, live: l };

  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl md:text-4xl mb-8">
        Dashboard
      </h1>
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        {cards.map((c) => (
          <Link
            key={c.resource}
            href={`/admin/${c.resource}`}
            className="border border-[var(--color-border)] p-5 hover:border-[var(--color-text)] transition-colors"
          >
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              {c.label}
            </p>
            <p className="font-display text-3xl font-bold">{counts[c.resource]}</p>
            <p className="mt-3 text-xs uppercase tracking-wider underline underline-offset-2">
              관리하기
            </p>
          </Link>
        ))}
      </section>
      <section>
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
          최근 수정 5건
        </h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <tr>
              <th className="py-2 font-medium">리소스</th>
              <th className="py-2 font-medium">제목</th>
              <th className="py-2 font-medium">수정일</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={`${r.resource}-${r.id}`} className="border-b border-[var(--color-border)]">
                <td className="py-3">
                  <span className="text-xs uppercase tracking-wider">{r.resource}</span>
                </td>
                <td className="py-3">
                  <Link
                    href={`/admin/${r.resource}/${r.id}`}
                    className="underline underline-offset-2"
                  >
                    {r.label}
                  </Link>
                </td>
                <td className="py-3 text-[var(--color-text-muted)]">
                  {r.ts.toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
