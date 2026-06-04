"use client";
import { useMemo, useRef, useState } from "react";
import {
  getLines, searchStations, type MetroStation,
} from "@/lib/playground/rehearsal/metroStations";
import { lineColor } from "@/lib/playground/rehearsal/metroLineColors";

const ALL_LINES = getLines();

function LineBadge({ line }: { line: string }) {
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
      style={{ backgroundColor: lineColor(line) }}>{line}</span>
  );
}

export default function StationPicker({
  query, invalid, onQueryChange, onSelect,
}: {
  query: string;
  invalid: boolean;
  onQueryChange: (q: string) => void;
  onSelect: (s: MetroStation) => void;
}) {
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchStations(query, selectedLines), [query, selectedLines]);

  function toggleLine(line: string) {
    setSelectedLines((cur) => (cur.includes(line) ? cur.filter((l) => l !== line) : [...cur, line]));
  }

  function pick(s: MetroStation) {
    onSelect(s);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { if (results[highlight]) { e.preventDefault(); pick(results[highlight]); } }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const inputCls = "border px-3 py-2 text-sm w-full";

  return (
    <div ref={boxRef} className="relative"
      onBlur={(e) => { if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      {/* 호선 칩 */}
      <div className="mb-1 flex flex-wrap gap-1">
        <button type="button" onClick={() => setSelectedLines([])}
          className={`rounded px-2 py-0.5 text-[11px] border ${selectedLines.length === 0 ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border-strong)]"}`}>
          전체
        </button>
        {ALL_LINES.map((line) => {
          const on = selectedLines.includes(line);
          return (
            <button key={line} type="button" onClick={() => toggleLine(line)}
              className="rounded px-2 py-0.5 text-[11px] font-bold border"
              style={on
                ? { backgroundColor: lineColor(line), color: "#fff", borderColor: lineColor(line) }
                : { color: lineColor(line), borderColor: lineColor(line) }}>
              {line}
            </button>
          );
        })}
      </div>

      {/* 검색 입력 */}
      <input
        value={query}
        placeholder="역명 검색 (예: 강남)"
        className={`${inputCls} ${invalid ? "border-red-500" : "border-[var(--color-border-strong)]"}`}
        onChange={(e) => { onQueryChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox" aria-expanded={open} aria-autocomplete="list" inputMode="text"
      />

      {/* 드롭다운 */}
      {open && (
        <div role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto border border-[var(--color-border-strong)] bg-[var(--color-bg)] shadow-lg">
          {query.trim() === "" ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">역명을 입력하세요</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">검색 결과 없음</p>
          ) : (
            results.map((s, i) => (
              <button key={s.id} type="button" role="option" aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)} onClick={() => pick(s)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${i === highlight ? "bg-[var(--color-surface,#f3f3f3)]" : ""}`}>
                <span>{s.name}{s.ambiguous ? <span className="text-[var(--color-text-muted)]"> ({s.area})</span> : null}</span>
                <span className="flex flex-wrap justify-end gap-1">{s.lines.map((l) => <LineBadge key={l} line={l} />)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
