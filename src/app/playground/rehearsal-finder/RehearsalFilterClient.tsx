"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import StudioCard, { type CardStudio } from "./StudioCard";
import StudioDetailModal from "./StudioDetailModal";
import type { RegionFacet } from "@/lib/playground/rehearsal/studios";

const PRICE_BUCKETS = [
  { v: "u15", label: "~15,000" }, { v: "15_20", label: "15,000~20,000" },
  { v: "20_25", label: "20,000~25,000" }, { v: "o25", label: "25,000~" },
] as const;
const CAPACITIES = [4, 6, 8, 10, 15, 20];

const chip = (on: boolean) =>
  `rounded px-2.5 py-1 text-xs border ${on ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border-strong)]"}`;
// 구 칩: 시(city) 칩과 구분되도록 알약(rounded-full) 모양 + 선택 시 윤곽-채움(outline-fill) 스타일.
const chipGu = (on: boolean) =>
  `rounded-full px-2.5 py-1 text-xs border ${on ? "bg-[var(--color-bg-muted)] text-[var(--color-text)] border-[var(--color-text)] font-medium" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`;

export default function RehearsalFilterClient({ facets }: { facets: RegionFacet[] }) {
  const [province, setProvince] = useState<string | null>(null);
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [priceBucket, setPriceBucket] = useState<string | null>(null);
  const [capacityMin, setCapacityMin] = useState<number | null>(null);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [rentalOnly, setRentalOnly] = useState(false);
  const [results, setResults] = useState<{ studios: CardStudio[]; noInfo: CardStudio[] } | null>(null);
  const [detailStudio, setDetailStudio] = useState<CardStudio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }
  const selectedFacet = facets.find((f) => f.province === province) ?? null;

  async function apply() {
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/playground/rehearsal/filter", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ province, subRegions, priceBucket, capacityMin, parkingOnly, rentalOnly }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "필터 실패"); return; }
      setResults({ studios: data.studios, noInfo: data.noInfo });
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider mb-1.5 text-[var(--color-text-muted)]">지역</label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(province === null)} onClick={() => { setProvince(null); setSubRegions([]); }}>전체</button>
            {facets.map((f) => (
              <button key={f.province} type="button" className={chip(province === f.province)}
                onClick={() => { setProvince(f.province); setSubRegions([]); }}>{f.province} ({f.count})</button>
            ))}
          </div>
          {selectedFacet && selectedFacet.subs.length > 0 && (
            <div className="mt-2 border-l-2 border-[var(--color-border-strong)] pl-3">
              <span className="block text-[11px] text-[var(--color-text-muted)] mb-1.5">↳ {selectedFacet.province} 안에서 선택 (여러 개 가능)</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedFacet.subs.map((s) => (
                  <button key={s.name} type="button" className={chipGu(subRegions.includes(s.name))} onClick={() => setSubRegions(toggle(subRegions, s.name))}>{s.name} ({s.count})</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider mb-1.5 text-[var(--color-text-muted)]">가격대(시간당)</label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(priceBucket === null)} onClick={() => setPriceBucket(null)}>전체</button>
            {PRICE_BUCKETS.map((b) => (
              <button key={b.v} type="button" className={chip(priceBucket === b.v)} onClick={() => setPriceBucket(b.v)}>{b.label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5 text-[var(--color-text-muted)]">최소 인원</label>
            <select value={capacityMin ?? ""} onChange={(e) => setCapacityMin(e.target.value ? Number(e.target.value) : null)}
              className="border border-[var(--color-border-strong)] px-3 py-2 text-sm">
              <option value="">상관없음</option>
              {CAPACITIES.map((c) => <option key={c} value={c}>{c}인 이상</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={parkingOnly} onChange={(e) => setParkingOnly(e.target.checked)} />주차 가능</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rentalOnly} onChange={(e) => setRentalOnly(e.target.checked)} />악기대여</label>
        </div>
      </div>

      <button type="button" onClick={apply} disabled={loading} className={buttonClasses("accent")}>
        {loading ? "찾는 중…" : "이 조건으로 찾기"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && (
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl">조건에 맞는 합주실 {results.studios.length}곳</h2>
          {results.studios.length === 0 && <p className="text-[var(--color-text-muted)]">조건에 맞는 곳이 없어요. 필터를 완화해보세요.</p>}
          {results.studios.map((s, i) => <StudioCard key={i} studio={s} onDetail={setDetailStudio} />)}
          {results.noInfo.length > 0 && (
            <details className="border border-dashed border-[var(--color-border-strong)] p-4">
              <summary className="cursor-pointer text-sm text-[var(--color-text-muted)]">
                조건 확인이 안 되는 {results.noInfo.length}곳 (가격 정보 없음) — 펼쳐보기
              </summary>
              <div className="mt-3 space-y-4">
                {results.noInfo.map((s, i) => <StudioCard key={i} studio={s} onDetail={setDetailStudio} />)}
              </div>
            </details>
          )}
        </div>
      )}
      <StudioDetailModal studio={detailStudio} onClose={() => setDetailStudio(null)} />
    </div>
  );
}
