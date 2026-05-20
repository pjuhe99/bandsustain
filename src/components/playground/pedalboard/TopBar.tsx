"use client";
import Link from "next/link";

export function TopBar({
  title, dirty, savedAt, onTitleChange, onShareClick,
}: {
  title: string; dirty: boolean; savedAt: string | null;
  onTitleChange: (next: string) => void;
  onShareClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-4 md:px-6 py-3 flex items-center gap-3">
      <Link href="/playground/pedalboard-planner"
        className="text-sm font-semibold uppercase tracking-wider underline">
        ← 다른 보드
      </Link>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1 text-base font-semibold bg-transparent border-0 border-b border-transparent focus:border-[var(--color-text)] focus:outline-none"
        aria-label="레이아웃 제목"
      />
      <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
        {dirty ? "저장 중…" : savedAt ? `저장됨 · ${savedAt}` : ""}
      </span>
      <button onClick={onShareClick}
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">
        공유
      </button>
    </header>
  );
}
