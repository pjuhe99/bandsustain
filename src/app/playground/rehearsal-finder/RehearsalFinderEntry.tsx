"use client";
import { useState } from "react";
import RehearsalFinderClient from "./RehearsalFinderClient";
import RehearsalFilterClient from "./RehearsalFilterClient";

type Mode = "select" | "recommend" | "filter";

export default function RehearsalFinderEntry() {
  const [mode, setMode] = useState<Mode>("select");

  if (mode === "select") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => setMode("recommend")}
          className="border border-[var(--color-border-strong)] p-6 text-left hover:bg-[var(--color-bg-muted)]">
          <span className="font-display font-bold text-lg">멤버 위치 기반으로 찾기</span>
          <span className="mt-2 block text-sm text-[var(--color-text-muted)]">멤버들의 출발 역을 입력하면 이동시간 순으로 추천해드려요.</span>
        </button>
        <button type="button" onClick={() => setMode("filter")}
          className="border border-[var(--color-border-strong)] p-6 text-left hover:bg-[var(--color-bg-muted)]">
          <span className="font-display font-bold text-lg">조건으로 필터링하기</span>
          <span className="mt-2 block text-sm text-[var(--color-text-muted)]">지역·악기·가격 등 원하는 조건으로 합주실을 골라보세요.</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => setMode("select")}
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">← 다른 방법으로 찾기</button>
      {mode === "recommend" ? <RehearsalFinderClient /> : <RehearsalFilterClient />}
    </div>
  );
}
