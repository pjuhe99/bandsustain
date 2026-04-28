import Link from "next/link";
import { getAllQuotesForAdmin } from "@/lib/quotes";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedQuote } from "./actions";

export const dynamic = "force-dynamic";

export default async function QuotesListPage() {
  const quotes = await getAllQuotesForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Quotes</h1>
        <Link
          href="/admin/quotes/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새로 추가
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-40">인물</th>
            <th className="py-2">인용문</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-20 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{q.attribution ?? "—"}</td>
              <td className="py-3 text-[var(--color-text-muted)]">
                {q.text.length > 80 ? q.text.slice(0, 79) + "…" : q.text}
              </td>
              <td className="py-3">
                <PublishedToggle
                  published={q.published === 1}
                  toggleAction={async () => {
                    "use server";
                    await togglePublishedQuote(q.id);
                  }}
                />
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/quotes/${q.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
