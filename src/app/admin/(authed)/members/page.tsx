import Link from "next/link";
import Image from "next/image";
import { getAllMembersForAdmin } from "@/lib/members";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedMember, swapMemberOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function MembersListPage() {
  const members = await getAllMembersForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Members</h1>
        <Link
          href="/admin/members/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새로 추가
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-16">사진</th>
            <th className="py-2">이름</th>
            <th className="py-2">포지션</th>
            <th className="py-2 w-20 text-right">순서</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-32 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => {
            const isFirst = i === 0;
            const isLast = i === members.length - 1;
            return (
              <tr key={m.id} className="border-b border-[var(--color-border)]">
                <td className="py-3">
                  <div className="relative w-12 h-12 bg-[var(--color-bg-muted)]">
                    <Image src={m.photoUrl} alt={m.nameKr} fill className="object-cover" sizes="48px" />
                  </div>
                </td>
                <td className="py-3">
                  <div className="font-medium">{m.nameKr}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{m.nameEn}</div>
                </td>
                <td className="py-3 text-[var(--color-text-muted)]">{m.position}</td>
                <td className="py-3 text-right tabular-nums">{m.displayOrder}</td>
                <td className="py-3">
                  <PublishedToggle
                    published={m.published}
                    toggleAction={async () => {
                      "use server";
                      await togglePublishedMember(m.id);
                    }}
                  />
                </td>
                <td className="py-3 text-right">
                  <form className="inline-flex items-center gap-1" action={async () => {
                    "use server";
                    await swapMemberOrder(m.id, "up");
                  }}>
                    <button type="submit" disabled={isFirst} className="px-2 py-1 text-xs border border-[var(--color-border)] disabled:opacity-30">▲</button>
                  </form>
                  <form className="inline-flex items-center gap-1 ml-1" action={async () => {
                    "use server";
                    await swapMemberOrder(m.id, "down");
                  }}>
                    <button type="submit" disabled={isLast} className="px-2 py-1 text-xs border border-[var(--color-border)] disabled:opacity-30">▼</button>
                  </form>
                  <Link href={`/admin/members/${m.id}`} className="ml-2 px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
