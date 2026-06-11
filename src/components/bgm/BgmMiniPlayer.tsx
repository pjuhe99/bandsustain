"use client";

import { useEffect, useRef, useState } from "react";
import { useBgm } from "./BgmProvider";

// 제목이 영역을 넘칠 때만 마키로 흐른다. 넘치지 않으면 정적 표시.
// 측정은 항상 렌더되는 invisible 스팬으로 해서 overflow 상태가
// 양방향(길어짐/짧아짐) 모두 갱신되게 한다.
function MarqueeTitle({ title }: { title: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [textWidth, setTextWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const text = measureRef.current;
    if (!container || !text) return;
    const measure = () => {
      const w = text.scrollWidth;
      setTextWidth(w);
      setOverflowing(w > container.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [title]);

  // 한 사이클 = 제목 폭 + 갭(pr-8=32px). 속도 일정(~25px/s), 최소 8초.
  const duration = Math.max(8, Math.round((textWidth + 32) / 25));

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 overflow-hidden">
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute whitespace-nowrap text-sm font-medium"
      >
        {title}
      </span>
      {overflowing ? (
        <div
          className="bgm-marquee flex w-max"
          style={{ "--bgm-marquee-duration": `${duration}s` } as React.CSSProperties}
        >
          <span className="whitespace-nowrap pr-8 text-sm font-medium">{title}</span>
          <span className="whitespace-nowrap pr-8 text-sm font-medium" aria-hidden="true">
            {title}
          </span>
        </div>
      ) : (
        <span className="block truncate text-sm font-medium">{title}</span>
      )}
    </div>
  );
}

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

function NoteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
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

  // 시작 전엔 같은 자리에 상시 플로팅 음표 버튼 — 재생을 시작하면 바로 교체되고,
  // 바를 X 로 닫으면 다시 이 버튼으로 돌아온다.
  if (!started) {
    return (
      <button
        onClick={toggle}
        aria-label="배경음악 재생"
        className="fixed z-40 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 sm:right-6 sm:bottom-6 w-12 h-12 flex items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md shadow-lg text-[var(--color-text)] hover:text-[var(--color-accent)]"
      >
        <NoteIcon />
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="BGM 플레이어"
      className="fixed z-40 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80"
    >
      <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md shadow-lg pl-4 pr-1 py-1">
        <MarqueeTitle title={currentTitle} />
        <button
          onClick={prev}
          aria-label="이전 곡"
          className="w-11 h-11 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          <PrevIcon />
        </button>
        <button
          onClick={toggle}
          aria-label={playing ? "일시정지" : "재생"}
          className="w-11 h-11 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          onClick={next}
          aria-label="다음 곡"
          className="w-11 h-11 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          <NextIcon />
        </button>
        <button
          onClick={stop}
          aria-label="플레이어 닫기"
          className="w-11 h-11 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
