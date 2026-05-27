import Link from "next/link";
import { getAllTopicsForAdmin } from "@/lib/columns";
import PublishedToggle from "@/components/admin/PublishedToggle";
import ConfirmActionButton from "@/components/admin/ConfirmActionButton";
import { toggleTopicVisible, deleteTopic } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminTopicsPage() {
  const topics = await getAllTopicsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <h1 className="font-display font-black uppercase text-3xl">주제</h1>
        <div className="flex gap-2">
          <Link href="/admin/columns" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">← 글 목록</Link>
          <Link href="/admin/columns/topics/new" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">+ 새 주제</Link>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2">제목</th>
            <th className="py-2 w-28">연결 멤버</th>
            <th className="py-2 w-16 text-right">정렬</th>
            <th className="py-2 w-24">노출</th>
            <th className="py-2 w-28 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((t) => (
            <tr key={t.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{t.title}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{t.authorName ?? "—"}</td>
              <td className="py-3 text-right tabular-nums">{t.sortOrder}</td>
              <td className="py-3">
                <PublishedToggle
                  published={t.visible}
                  toggleAction={async () => { "use server"; await toggleTopicVisible(t.id); }}
                />
              </td>
              <td className="py-3 text-right">
                <div className="flex gap-2 justify-end">
                  <Link href={`/admin/columns/topics/${t.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
                  <ConfirmActionButton
                    label="삭제"
                    confirm="이 주제와 하위 글·댓글이 모두 삭제됩니다. 계속할까요?"
                    action={async () => { "use server"; await deleteTopic(t.id); }}
                  />
                </div>
              </td>
            </tr>
          ))}
          {topics.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-[var(--color-text-muted)]">아직 주제가 없습니다.</td></tr>
          )}
        </tbody>
      </table></div>
    </div>
  );
}
