"use client";
import { useState } from "react";
import { useScrollLock } from "@/lib/useScrollLock";
import type { Visibility } from "@/lib/playground/visibility";

export function ShareSheet({
  shareToken, title, visibility, onVisibilityChange, onClose,
}: {
  shareToken: string;
  title: string;
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  onClose: () => void;
}) {
  useScrollLock(true);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/playground/p/${shareToken}`
    : `/playground/p/${shareToken}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function kakao() {
    const Kakao = (window as { Kakao?: { isInitialized: () => boolean; Share?: { sendDefault: (args: object) => void } } }).Kakao;
    if (Kakao && Kakao.isInitialized() && Kakao.Share) {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: title || "Pedalboard",
          description: "내 페달보드 레이아웃",
          imageUrl: `${window.location.origin}/playground/p/${shareToken}/opengraph-image`,
          link: { mobileWebUrl: url, webUrl: url },
        },
      });
    } else if (navigator.share) {
      navigator.share({ url });
    } else {
      copy();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-[var(--color-bg)] w-full md:max-w-md p-6 border-t md:border border-[var(--color-border-strong)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl">레이아웃 공유</h2>
          <button onClick={onClose} aria-label="닫기" className="text-sm underline">닫기</button>
        </div>

        <fieldset className="mb-4">
          <legend className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">공유 범위</legend>
          {(["private", "unlisted", "public"] as Visibility[]).map((v) => (
            <label key={v} className="flex items-start gap-2 py-1.5 text-sm">
              <input type="radio" name="visibility" checked={visibility === v}
                onChange={() => onVisibilityChange(v)} />
              <span>
                {v === "private" && <>🔒 나만 — URL 있어도 안 보임</>}
                {v === "unlisted" && <>🔗 URL 아는 사람</>}
                {v === "public" && <>🌐 공개 — 갤러리에 노출</>}
              </span>
            </label>
          ))}
        </fieldset>

        {visibility !== "private" && (
          <>
            <div className="border border-[var(--color-border)] px-3 py-2 text-xs font-mono break-all mb-3">{url}</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copy}
                className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">
                {copied ? "복사됨" : "URL 복사"}
              </button>
              <button onClick={kakao}
                className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[#FEE500] text-black border border-[#FEE500]">
                카톡 공유
              </button>
            </div>
          </>
        )}
        {visibility === "private" && (
          <p className="text-xs text-[var(--color-text-muted)]">private 상태에서는 공유 URL 이 비활성화됩니다.</p>
        )}
      </div>
    </div>
  );
}
