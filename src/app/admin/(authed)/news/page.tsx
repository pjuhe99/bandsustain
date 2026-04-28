import Link from "next/link";
import Image from "next/image";
import { getAllNewsForAdmin, formatNewsDate } from "@/lib/news";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedNews } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewsListPage() {
  const items = await getAllNewsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">News</h1>
        <Link
          href="/admin/news/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새로 추가
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-16">썸네일</th>
            <th className="py-2">헤드라인</th>
            <th className="py-2 w-32">카테고리</th>
            <th className="py-2 w-32">날짜</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-20 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.id} className="border-b border-[var(--color-border)]">
              <td className="py-3">
                <div className="relative w-12 h-12 bg-[var(--color-bg-muted)]">
                  <Image src={n.heroImage} alt={n.headline} fill className="object-cover" sizes="48px" />
                </div>
              </td>
              <td className="py-3 font-medium">{n.headline}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{n.category}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">{formatNewsDate(n.date)}</td>
              <td className="py-3">
                <PublishedToggle
                  published={n.published}
                  toggleAction={async () => {
                    "use server";
                    await togglePublishedNews(n.id);
                  }}
                />
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/news/${n.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
