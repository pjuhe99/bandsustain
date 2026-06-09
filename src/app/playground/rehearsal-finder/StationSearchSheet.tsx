"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useScrollLock } from "@/lib/useScrollLock";
import { searchStations, type MetroStation } from "@/lib/playground/rehearsal/metroStations";
import LineBadge from "./LineBadge";

export default function StationSearchSheet({
  open, onClose, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (s: MetroStation) => void;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchStations(query), [query]);

  // 열려 있는 동안 배경 스크롤 락 (배경 흐름에서 제거 → 터치 체이닝 방지)
  useScrollLock(open);
  // 열릴 때: 검색어 초기화 + 포커스
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => { clearTimeout(t); };
  }, [open]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.max(0, Math.min(h + 1, results.length - 1))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { if (results[highlight]) { e.preventDefault(); onSelect(results[highlight]); } }
    else if (e.key === "Escape") { onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
      role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex w-full max-h-[85vh] flex-col rounded-t-2xl bg-[var(--color-bg)] shadow-xl sm:max-w-md sm:max-h-[70vh] sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="font-display font-bold">출발지 역 선택</h3>
          <button type="button" aria-label="닫기" onClick={onClose} className="px-2 text-[var(--color-text-muted)]">✕</button>
        </div>
        <div className="p-4 pb-2">
          <input ref={inputRef} value={query} placeholder="역명 검색 (예: 강남, ㄱㄴ)" inputMode="text"
            className="w-full border border-[var(--color-border-strong)] px-3 py-2 text-sm"
            role="combobox" aria-expanded={true} aria-autocomplete="list"
            onChange={(e) => { setQuery(e.target.value); setHighlight(0); }} onKeyDown={onKeyDown} />
        </div>
        <div role="listbox" className="h-[50vh] sm:h-80 shrink-0 overflow-auto overscroll-contain px-2 pb-3">
          {query.trim() === "" ? (
            <p className="px-2 py-2 text-xs text-[var(--color-text-muted)]">역명을 입력하세요</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[var(--color-text-muted)]">검색 결과 없음</p>
          ) : (
            results.map((s, i) => (
              <button key={s.id} type="button" role="option" aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)} onClick={() => onSelect(s)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm ${i === highlight ? "bg-[var(--color-surface,#f3f3f3)]" : ""}`}>
                <span>{s.name}{s.ambiguous ? <span className="text-[var(--color-text-muted)]"> ({s.area})</span> : null}</span>
                <span className="flex flex-wrap justify-end gap-1">{s.lines.map((l) => <LineBadge key={l} line={l} />)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
