import { adminListHof } from "@/lib/playground/instagram/hofDb";
import { followDayCount } from "@/lib/playground/instagram/followDays";
import { hideEntry, showEntry } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminInstagramFollowPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || null;
  const rows = await adminListHof(q);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-black">Instagram Follow 명예의 전당</h1>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="닉네임 검색"
          className="border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <button type="submit" className="border border-[var(--color-text)] px-4 py-2 text-sm">
          검색
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-strong)] text-left text-[var(--color-text-muted)]">
              <th className="py-2 pr-2">ID</th>
              <th className="py-2 pr-2">닉네임</th>
              <th className="py-2 pr-2">팔로우 시작일</th>
              <th className="py-2 pr-2">일수</th>
              <th className="py-2 pr-2">등록일</th>
              <th className="py-2 pr-2">IP해시(앞10)</th>
              <th className="py-2 pr-2">상태</th>
              <th className="py-2">동작</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--color-border)]">
                <td className="py-2 pr-2">{r.id}</td>
                <td className="py-2 pr-2">{r.nickname}</td>
                <td className="py-2 pr-2">{r.sustainFollowedAt}</td>
                <td className="py-2 pr-2">{followDayCount(r.sustainFollowedAt) ?? "-"}</td>
                <td className="py-2 pr-2">{r.createdAt}</td>
                <td className="py-2 pr-2 font-mono text-xs">{r.ipHashPrefix}…</td>
                <td className="py-2 pr-2">{r.isVisible ? "공개" : "숨김"}</td>
                <td className="py-2">
                  <form action={r.isVisible ? hideEntry : showEntry}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="underline underline-offset-4">
                      {r.isVisible ? "숨김" : "복구"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">기록이 없어요.</p>
      )}
    </div>
  );
}
