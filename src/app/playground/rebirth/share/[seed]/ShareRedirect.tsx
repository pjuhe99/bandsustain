"use client";

import { useEffect } from "react";

export default function ShareRedirect({ seed }: { seed: string }) {
  useEffect(() => {
    window.location.replace(`/playground/rebirth?r=${encodeURIComponent(seed)}`);
  }, [seed]);

  return <main className="mx-auto max-w-2xl px-6 py-28 text-center text-sm text-[var(--color-text-muted)]">공유한 환생 결과를 불러오는 중입니다…</main>;
}
