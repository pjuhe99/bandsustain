"use client";

import { useState } from "react";
import { useScrollLock } from "@/lib/useScrollLock";
import { encodeShare } from "@/lib/bandName/share";
import type { GeneratedBandName } from "@/lib/bandName/types";

type KakaoShare = {
  isInitialized: () => boolean;
  Share?: { sendDefault: (args: object) => void };
};

export default function BandNameShareSheet({
  result,
  onClose,
}: {
  result: GeneratedBandName;
  onClose: () => void;
}) {
  useScrollLock(true);
  const [copied, setCopied] = useState(false);

  const token = encodeShare({ name: result.name, scene: result.scene, mood: result.mood });
  const origin = typeof window !== "undefined" ? window.location.origin : "https://bandsustain.com";
  const url = `${origin}/playground/band-name-generator/share/${token}`;
  // 카톡 피드는 와이드 이미지를 잘라 보여줘서 정사각형 전용 이미지를 쓴다.
  const kakaoImageUrl = `${url}/kakao-image`;
  const description = `${result.tags.join(" · ")} · 밴드 이름 생성기`;
  const canWebShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 거부됨 — 조용히 실패
    }
  };

  const kakao = () => {
    const Kakao = (window as unknown as { Kakao?: KakaoShare }).Kakao;
    if (Kakao && Kakao.isInitialized() && Kakao.Share) {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: result.name,
          description,
          imageUrl: kakaoImageUrl,
          imageWidth: 1200,
          imageHeight: 1200,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [
          { title: "이름 보기", link: { mobileWebUrl: url, webUrl: url } },
        ],
      });
    } else if (canWebShare) {
      navigator.share({ title: result.name, text: description, url }).catch(() => {});
    } else {
      copy();
    }
  };

  const webShare = () => {
    navigator.share({ title: result.name, text: description, url }).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="밴드 이름 공유"
    >
      <div
        className="bg-[var(--color-bg)] w-full md:max-w-md p-6 border-t md:border border-[var(--color-border-strong)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl">이름 공유</h2>
          <button onClick={onClose} aria-label="닫기" className="text-sm underline underline-offset-4">
            닫기
          </button>
        </div>

        <p className="font-display font-black text-3xl md:text-4xl leading-tight break-keep [overflow-wrap:anywhere] mb-2">
          {result.name}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {result.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 text-[11px] uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="border border-[var(--color-border)] px-3 py-2 text-xs font-mono break-all mb-4 text-[var(--color-text-muted)]">
          {url}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copy}
            className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            {copied ? "복사됨" : "링크 복사"}
          </button>
          <button
            onClick={kakao}
            className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[#FEE500] text-black border border-[#FEE500] hover:opacity-90 transition-opacity"
          >
            카톡 공유
          </button>
        </div>

        {canWebShare && (
          <button
            onClick={webShare}
            className="mt-2 w-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:opacity-90 transition-opacity"
          >
            다른 앱으로 공유
          </button>
        )}
      </div>
    </div>
  );
}
