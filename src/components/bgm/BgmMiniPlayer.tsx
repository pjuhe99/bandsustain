"use client";

import { useBgm } from "./BgmProvider";

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M6 6h2v12H6zM20 6l-10 6 10 6V6z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M16 6h2v12h-2zM4 6l10 6-10 6V6z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function BgmMiniPlayer() {
  const { started, playing, currentTitle, toggle, next, prev, stop } = useBgm();

  if (!started) return null;

  return (
    <div className="fixed z-40 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80">
      <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md shadow-lg pl-4 pr-2 py-2">
        <span className="flex-1 min-w-0 truncate text-sm font-medium">{currentTitle}</span>
        <button
          onClick={prev}
          aria-label="이전 곡"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          <PrevIcon />
        </button>
        <button
          onClick={toggle}
          aria-label={playing ? "일시정지" : "재생"}
          className="w-9 h-9 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          onClick={next}
          aria-label="다음 곡"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          <NextIcon />
        </button>
        <button
          onClick={stop}
          aria-label="플레이어 닫기"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
