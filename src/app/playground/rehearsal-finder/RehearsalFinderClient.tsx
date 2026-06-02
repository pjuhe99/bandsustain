"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";

type Region = { id: number; displayName: string };
type EquipOption = { value: string; label: string };
type MemberForm = { nickname: string; originText: string; originLat: string; originLng: string };

type ResultItem = {
  rankNo: number;
  studio: { name: string; regionName: string | null; areaLabel: string | null; bookingUrl: string | null; mapUrl: string | null; hourlyPriceMin: number | null; equipment: { equipmentType: string }[] };
  avgMinutes: number; maxMinutes: number; reason: string;
  memberRoutes: { nickname: string; route: { travelMinutes: number } }[];
};

export default function RehearsalFinderClient({ regions, equipmentOptions }: { regions: Region[]; equipmentOptions: EquipOption[] }) {
  const [members, setMembers] = useState<MemberForm[]>([
    { nickname: "", originText: "", originLat: "", originLng: "" },
    { nickname: "", originText: "", originLat: "", originLng: "" },
  ]);
  const [transportMode, setTransportMode] = useState("transit");
  const [maxBudget, setMaxBudget] = useState("");
  const [requiredEquipment, setRequiredEquipment] = useState<string[]>([]);
  const [preferredRegionIds, setPreferredRegionIds] = useState<number[]>([]);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const input = "border border-[var(--color-border-strong)] px-3 py-2 text-sm";

  async function submit() {
    setError(null); setLoading(true); setResults(null);
    try {
      const payload = {
        transportMode,
        maxBudgetPerHour: maxBudget ? Number(maxBudget) : null,
        requiredEquipment,
        preferredRegionIds,
        members: members
          .filter((m) => m.nickname && m.originLat && m.originLng)
          .map((m) => ({
            nickname: m.nickname, originText: m.originText || m.nickname,
            originLat: Number(m.originLat), originLng: Number(m.originLng),
            originType: "manual", transportMode,
          })),
      };
      if (payload.members.length === 0) { setError("닉네임+좌표가 채워진 멤버가 최소 1명 필요합니다."); return; }
      const res = await fetch("/api/playground/rehearsal/recommend", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
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
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_1fr_1fr_40px] gap-2">
              <input placeholder="닉네임" value={m.nickname} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, nickname: e.target.value } : x))} />
              <input placeholder="출발지(메모)" value={m.originText} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, originText: e.target.value } : x))} />
              <input placeholder="위도" value={m.originLat} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, originLat: e.target.value } : x))} />
              <input placeholder="경도" value={m.originLng} className={input}
                onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, originLng: e.target.value } : x))} />
              <button type="button" className="text-red-600"
                onClick={() => setMembers(members.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        {members.length < 10 && (
          <button type="button" className="mt-2 text-sm border border-[var(--color-border-strong)] px-3 py-1"
            onClick={() => setMembers([...members, { nickname: "", originText: "", originLat: "", originLng: "" }])}>+ 멤버 추가</button>
        )}
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">※ 현재는 좌표(위도/경도)를 직접 입력합니다. (주소→좌표 변환은 추후)</p>
      </div>

      {/* 조건 */}
      <div className="grid md:grid-cols-3 gap-4">
        <div><label className="block text-xs uppercase tracking-wider mb-1">이동수단</label>
          <select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className={`${input} w-full`}>
            <option value="transit">대중교통</option><option value="car">자동차</option><option value="mixed">혼합</option>
          </select></div>
        <div><label className="block text-xs uppercase tracking-wider mb-1">시간당 예산(원)</label>
          <input value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} placeholder="예: 25000" className={`${input} w-full`} /></div>
        <div><label className="block text-xs uppercase tracking-wider mb-1">선호 지역</label>
          <select multiple value={preferredRegionIds.map(String)} className={`${input} w-full h-24`}
            onChange={(e) => setPreferredRegionIds(Array.from(e.target.selectedOptions).map((o) => Number(o.value)))}>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.displayName}</option>)}
          </select></div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider mb-1">필수 장비</label>
        <div className="flex flex-wrap gap-2">
          {equipmentOptions.map((e) => {
            const on = requiredEquipment.includes(e.value);
            return (
              <button key={e.value} type="button"
                onClick={() => setRequiredEquipment(on ? requiredEquipment.filter((x) => x !== e.value) : [...requiredEquipment, e.value])}
                className={`px-3 py-1 text-sm border ${on ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border-strong)]"}`}>
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" onClick={submit} disabled={loading} className={buttonClasses("accent")}>
        {loading ? "추천 중…" : "합주실 추천받기"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && (
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl">추천 결과 {results.length}곳</h2>
          {results.length === 0 && <p className="text-[var(--color-text-muted)]">조건에 맞는 합주실이 없어요. 예산/장비/지역 조건을 완화해보세요.</p>}
          {results.map((r) => (
            <div key={r.rankNo} className="border border-[var(--color-border)] p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display font-bold text-lg">{r.rankNo}. {r.studio.name}</h3>
                <span className="text-sm text-[var(--color-text-muted)]">{r.studio.regionName ?? r.studio.areaLabel ?? ""}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-accent)]">{r.reason}</p>
              <p className="mt-2 text-sm">평균 이동 {Math.round(r.avgMinutes)}분 · 최대 {Math.round(r.maxMinutes)}분
                {r.studio.hourlyPriceMin ? ` · 시간당 ${r.studio.hourlyPriceMin.toLocaleString("ko-KR")}원~` : ""}</p>
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
    </div>
  );
}
