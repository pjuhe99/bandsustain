"use client";
import { useRef, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { findStationById, stationLabel } from "@/lib/playground/rehearsal/metroStations";
import { EQUIPMENT_LABELS } from "@/lib/playground/rehearsal/types";
import StationSearchSheet from "./StationSearchSheet";
import LineBadge from "./LineBadge";

type MemberForm = { id: number; nickname: string; stationId: string | null };

type ResultItem = {
  rankNo: number;
  studio: {
    name: string; regionName: string | null; areaLabel: string | null;
    bookingUrl: string | null; mapUrl: string | null;
    hourlyPriceMin: number | null; hourlyPriceMax: number | null;
    hasParking: boolean; parkingNote: string | null;
    equipment: { equipmentType: string }[];
  };
  avgMinutes: number; maxMinutes: number; reason: string;
  memberRoutes: { nickname: string; route: { travelMinutes: number } }[];
};

export default function RehearsalFinderClient() {
  const [members, setMembers] = useState<MemberForm[]>([
    { id: 0, nickname: "", stationId: null },
    { id: 1, nickname: "", stationId: null },
  ]);
  const nextId = useRef(2);
  const [openMemberId, setOpenMemberId] = useState<number | null>(null);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null); setLoading(true); setResults(null);
    try {
      const memberPayload = members
        .map((m) => ({ m, st: m.stationId ? findStationById(m.stationId) : null }))
        .filter((x) => x.m.nickname.trim() && x.st)
        .map(({ m, st }) => ({
          nickname: m.nickname,
          originText: stationLabel(st!),
          originLat: st!.lat,
          originLng: st!.lng,
          originType: "station",
        }));
      if (memberPayload.length === 0) { setError("닉네임과 역이 채워진 멤버가 최소 1명 필요합니다."); return; }
      const res = await fetch("/api/playground/rehearsal/recommend", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ members: memberPayload }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "추천 실패"); return; }
      setResults(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      {/* 멤버 입력 */}
      <div>
        <h2 className="font-display font-bold text-xl mb-3">멤버 출발지 (최대 10명)</h2>
        <div className="space-y-3">
          {members.map((m, idx) => {
            const st = m.stationId ? findStationById(m.stationId) : null;
            return (
              <div key={m.id}
                className={`flex items-stretch gap-3 sm:gap-4 border p-3 sm:p-4 ${st ? "border-[var(--color-border-strong)]" : "border-[var(--color-border)]"}`}>
                {/* 인덱스 번호 (선택 시 accent) */}
                <div className={`font-display font-black tabular-nums leading-none text-2xl sm:text-3xl w-7 sm:w-9 shrink-0 ${st ? "text-[var(--color-accent)]" : "text-[var(--color-border)]"}`}>
                  {String(idx + 1).padStart(2, "0")}
                </div>
                {/* 필드: 닉네임(밑줄) + 역 선택 */}
                <div className="flex-1 min-w-0 space-y-2">
                  <input placeholder="닉네임" value={m.nickname}
                    className="w-full border-0 border-b border-[var(--color-border)] bg-transparent px-0 py-1 text-sm focus:border-[var(--color-text)] focus:outline-none"
                    onChange={(e) => setMembers(members.map((x) => x.id === m.id ? { ...x, nickname: e.target.value } : x))} />
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setOpenMemberId(m.id)}
                      className={`flex-1 min-w-0 border px-3 py-2 text-sm text-left ${st ? "border-[var(--color-border-strong)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                      {st ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {stationLabel(st)}
                          {st.lines.map((l) => <LineBadge key={l} line={l} />)}
                        </span>
                      ) : "역 선택"}
                    </button>
                    {st && (
                      <button type="button" aria-label="역 선택 해제" className="px-1.5 py-2 text-xs text-[var(--color-text-muted)] shrink-0 hover:text-[var(--color-text)]"
                        onClick={() => setMembers(members.map((x) => x.id === m.id ? { ...x, stationId: null } : x))}>해제</button>
                    )}
                  </div>
                </div>
                {/* 멤버 삭제 */}
                <button type="button" aria-label="멤버 삭제" className="shrink-0 self-start text-lg leading-none text-[var(--color-text-muted)] hover:text-red-600"
                  onClick={() => setMembers(members.filter((x) => x.id !== m.id))}>✕</button>
              </div>
            );
          })}
        </div>
        {members.length < 10 && (
          <button type="button"
            className="mt-3 w-full border border-dashed border-[var(--color-border-strong)] py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]"
            onClick={() => setMembers([...members, { id: nextId.current++, nickname: "", stationId: null }])}>+ 멤버 추가</button>
        )}
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">※ 멤버별로 [역 선택]을 눌러 가까운 지하철 역을 검색·선택하세요(초성 검색 가능). 좌표는 자동으로 채워집니다.</p>
      </div>

      <button type="button" onClick={submit} disabled={loading} className={buttonClasses("accent")}>
        {loading ? "추천 중…" : "합주실 추천받기"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && (
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl">추천 결과 {results.length}곳</h2>
          {results.length === 0 && <p className="text-[var(--color-text-muted)]">조건에 맞는 합주실이 없어요.</p>}
          {results.map((r) => (
            <div key={r.rankNo} className="border border-[var(--color-border)] p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display font-bold text-lg">{r.rankNo}. {r.studio.name}</h3>
                <span className="text-sm text-[var(--color-text-muted)]">{r.studio.regionName ?? r.studio.areaLabel ?? ""}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-accent)]">{r.reason}</p>
              <p className="mt-2 text-sm">평균 이동 {Math.round(r.avgMinutes)}분 · 최대 {Math.round(r.maxMinutes)}분
                {r.studio.hourlyPriceMin
                  ? ` · 시간당 ${r.studio.hourlyPriceMin.toLocaleString("ko-KR")}${r.studio.hourlyPriceMax && r.studio.hourlyPriceMax !== r.studio.hourlyPriceMin ? `~${r.studio.hourlyPriceMax.toLocaleString("ko-KR")}` : "~"}원`
                  : ""}
                {r.studio.hasParking ? " · 주차 가능" : ""}</p>
              {r.studio.equipment.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.studio.equipment.map((eq, i) => (
                    <span key={i} className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                      {EQUIPMENT_LABELS[eq.equipmentType as keyof typeof EQUIPMENT_LABELS] ?? eq.equipmentType}
                    </span>
                  ))}
                </div>
              )}
              <ul className="mt-2 text-xs text-[var(--color-text-muted)] flex flex-wrap gap-x-4">
                {r.memberRoutes.map((mr, i) => <li key={i}>{mr.nickname}: {mr.route.travelMinutes}분</li>)}
              </ul>
              <div className="mt-3 flex gap-3 text-sm">
                {r.studio.mapUrl && <a href={r.studio.mapUrl} target="_blank" rel="noreferrer" className="underline">지도</a>}
                {r.studio.bookingUrl && <a href={r.studio.bookingUrl} target="_blank" rel="noreferrer" className="underline">예약</a>}
              </div>
            </div>
          ))}
        </div>
      )}
      <StationSearchSheet
        open={openMemberId !== null}
        onClose={() => setOpenMemberId(null)}
        onSelect={(s) => {
          setMembers(members.map((x) => x.id === openMemberId ? { ...x, stationId: s.id } : x));
          setOpenMemberId(null);
        }}
      />
    </div>
  );
}
