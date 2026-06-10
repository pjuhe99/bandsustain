"use client";
import { useSyncExternalStore } from "react";

// 개발 환경 식별 리본. 호스트네임 기반이라 빌드/env 설정과 무관하게
// dev.* 도메인(및 로컬)에서만 보인다 — main 머지 후 PROD 에선 절대 노출되지 않음.
function isDevHost(hostname: string): boolean {
  return (
    hostname.startsWith("dev.") || hostname === "localhost" || hostname === "127.0.0.1"
  );
}

const subscribe = () => () => {};

export default function DevRibbon() {
  // SSR에선 false, hydration 직후 클라 호스트네임으로 판정 (mismatch 안전)
  const show = useSyncExternalStore(
    subscribe,
    () => isDevHost(window.location.hostname),
    () => false,
  );
  if (!show) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] overflow-hidden"
      style={{ width: 120, height: 120 }}
    >
      <div
        className="absolute bg-[#e02424] text-center font-display text-xs font-black uppercase tracking-[0.3em] text-white shadow-md"
        style={{
          width: 170,
          padding: "6px 0",
          transform: "rotate(-45deg)",
          left: -45,
          top: 32,
        }}
      >
        DEV
      </div>
    </div>
  );
}
