import Link from "next/link";
import { listStudios } from "@/lib/playground/rehearsal/studios";
import StudioDeleteButton from "@/components/admin/StudioDeleteButton";
import { deleteRehearsalStudio } from "./actions";

export const dynamic = "force-dynamic";

const SOURCES = [
  { v: "", label: "전체 출처" },
  { v: "notion-import", label: "노션" },
  { v: "naver-map-import", label: "네이버" },
  { v: "manual", label: "수동/기타" },
];

export default async function RehearsalStudiosListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const source = sp.source ?? "";
  const noinfo = sp.noinfo === "1";
  let studios = await listStudios({});
  if (q) studios = studios.filter((s) => s.name.includes(q));
  if (source === "manual") studios = studios.filter((s) => s.sourceNote !== "notion-import" && s.sourceNote !== "naver-map-import");
  else if (source) studios = studios.filter((s) => s.sourceNote === source);
  if (noinfo) studios = studios.filter((s) => s.rooms.length === 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-black uppercase text-3xl">Rehearsal Studios</h1>
        <Link href="/admin/rehearsal-studios/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">
          + 새로 추가
        </Link>
      </div>

      <form method="get" className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <input name="q" defaultValue={q} placeholder="이름 검색" className="border border-[var(--color-border-strong)] px-3 py-2" />
        <select name="source" defaultValue={source} className="border border-[var(--color-border-strong)] px-3 py-2">
          {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5"><input type="checkbox" name="noinfo" value="1" defaultChecked={noinfo} /> 방 정보 없는 곳만</label>
        <button type="submit" className="border border-[var(--color-border-strong)] px-4 py-2">필터</button>
        <span className="text-[var(--color-text-muted)]">{studios.length}곳</span>
      </form>

      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr><th className="py-2">이름</th><th className="py-2 w-32">지역</th><th className="py-2 w-36">가격</th>
            <th className="py-2 w-16">방</th><th className="py-2 w-24">출처</th><th className="py-2 w-24">상태</th><th className="py-2 w-28 text-right">동작</th></tr>
        </thead>
        <tbody>
          {studios.map((s) => (
            <tr key={s.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 font-medium">{s.name}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{s.areaLabel ?? s.regionName ?? "—"}</td>
              <td className="py-3">
                {s.hourlyPriceMin
                  ? `${s.hourlyPriceMin.toLocaleString("ko-KR")}${s.hourlyPriceMax && s.hourlyPriceMax !== s.hourlyPriceMin ? `~${s.hourlyPriceMax.toLocaleString("ko-KR")}` : ""}원`
                  : <span className="text-[var(--color-text-muted)]">정보 없음</span>}
              </td>
              <td className="py-3">{s.rooms.length > 0 ? s.rooms.length : <span className="text-[var(--color-text-muted)]">—</span>}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{s.sourceNote === "notion-import" ? "노션" : s.sourceNote === "naver-map-import" ? "네이버" : "수동"}</td>
              <td className="py-3">{s.status}</td>
              <td className="py-3 text-right space-x-1.5">
                <Link href={`/admin/rehearsal-studios/${s.id}`}
                  className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
                <StudioDeleteButton name={s.name} action={deleteRehearsalStudio.bind(null, s.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
