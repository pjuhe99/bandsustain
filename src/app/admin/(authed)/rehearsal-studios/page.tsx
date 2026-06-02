import Link from "next/link";
import { listStudios } from "@/lib/playground/rehearsal/studios";

export const dynamic = "force-dynamic";

export default async function RehearsalStudiosListPage() {
  const studios = await listStudios({});
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Rehearsal Studios</h1>
        <Link href="/admin/rehearsal-studios/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">
          + 새로 추가
        </Link>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr><th className="py-2">이름</th><th className="py-2 w-32">지역</th><th className="py-2 w-24">가격</th>
            <th className="py-2 w-20">인원</th><th className="py-2 w-24">상태</th><th className="py-2 w-16 text-right">동작</th></tr>
        </thead>
        <tbody>
          {studios.map((s) => (
            <tr key={s.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{s.name}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{s.regionName ?? "—"}</td>
              <td className="py-3">{s.hourlyPriceMin ? `${s.hourlyPriceMin.toLocaleString("ko-KR")}~` : "—"}</td>
              <td className="py-3">{s.maxCapacity ?? "—"}</td>
              <td className="py-3">{s.status}</td>
              <td className="py-3 text-right">
                <Link href={`/admin/rehearsal-studios/${s.id}`}
                  className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
