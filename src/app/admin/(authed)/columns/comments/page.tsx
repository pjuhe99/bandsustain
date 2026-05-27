import Link from "next/link";
import { getAllCommentsForAdmin } from "@/lib/columns";
import { formatColumnDate } from "@/lib/columnsFormat";
import PublishedToggle from "@/components/admin/PublishedToggle";
import ConfirmActionButton from "@/components/admin/ConfirmActionButton";
import { toggleCommentVisibleAdmin, deleteCommentAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  const comments = await getAllCommentsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <h1 className="font-display font-black uppercase text-3xl">댓글</h1>
        <Link href="/admin/columns" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">← 글 목록</Link>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-36">글</th>
            <th className="py-2 w-24">닉네임</th>
            <th className="py-2 w-28">IP</th>
            <th className="py-2">내용</th>
            <th className="py-2 w-24">작성일</th>
            <th className="py-2 w-24">노출</th>
            <th className="py-2 w-16 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {comments.map((c) => (
            <tr key={c.id} className="border-b border-[var(--color-border)] align-top">
              <td className="py-3">
                <Link href={`/columns/${c.postId}`} target="_blank" className="underline underline-offset-2 text-[var(--color-text-muted)]">{c.postTitle}</Link>
              </td>
              <td className="py-3">{c.nickname}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">{c.ip}</td>
              <td className="py-3 whitespace-pre-wrap break-words">{c.body}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">{formatColumnDate(c.createdAt)}</td>
              <td className="py-3">
                <PublishedToggle
                  published={c.visible}
                  toggleAction={async () => { "use server"; await toggleCommentVisibleAdmin(c.id); }}
                />
              </td>
              <td className="py-3 text-right">
                <ConfirmActionButton
                  label="삭제"
                  confirm="이 댓글을 영구 삭제할까요?"
                  action={async () => { "use server"; await deleteCommentAdmin(c.id); }}
                />
              </td>
            </tr>
          ))}
          {comments.length === 0 && (
            <tr><td colSpan={7} className="py-6 text-[var(--color-text-muted)]">아직 댓글이 없습니다.</td></tr>
          )}
        </tbody>
      </table></div>
    </div>
  );
}
