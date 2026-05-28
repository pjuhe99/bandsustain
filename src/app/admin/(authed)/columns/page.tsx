import Link from "next/link";
import { getAllPostsForAdmin } from "@/lib/columns";
import { formatColumnDate } from "@/lib/columnsFormat";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePostPublished } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminColumnsPage() {
  const posts = await getAllPostsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <h1 className="font-display font-black uppercase text-3xl">Columns</h1>
        <div className="flex gap-2">
          <Link href="/admin/columns/topics" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">주제 관리</Link>
          <Link href="/admin/columns/comments" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">댓글 관리</Link>
          <Link href="/admin/columns/new" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">+ 새 글</Link>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2">제목</th>
            <th className="py-2 w-40">주제</th>
            <th className="py-2 w-24">작성자</th>
            <th className="py-2 w-28">공개일</th>
            <th className="py-2 w-16 text-right">조회</th>
            <th className="py-2 w-16 text-right">댓글</th>
            <th className="py-2 w-24 pl-6">공개</th>
            <th className="py-2 w-16 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{p.title}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{p.topicTitle}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{p.authorName ?? "—"}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">{p.publishedAt ? formatColumnDate(p.publishedAt) : "—"}</td>
              <td className="py-3 text-right tabular-nums">{p.viewCount}</td>
              <td className="py-3 text-right tabular-nums">{p.commentCount}</td>
              <td className="py-3 pl-6">
                <PublishedToggle
                  published={p.published}
                  toggleAction={async () => { "use server"; await togglePostPublished(p.id); }}
                />
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/columns/${p.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
          {posts.length === 0 && (
            <tr><td colSpan={8} className="py-6 text-[var(--color-text-muted)]">아직 글이 없습니다.</td></tr>
          )}
        </tbody>
      </table></div>
    </div>
  );
}
