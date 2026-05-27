// src/app/playground/mbti-band-casting/CastingShareSheet.tsx
"use client";

import { useState } from "react";
import { GENRES, POSITIONS } from "@/lib/mbtiCasting/data";
import type { BandCastingInput, BandCastingResult } from "@/lib/mbtiCasting/engine";
import { encodeCasting } from "@/lib/mbtiCasting/share";

type KakaoShare = {
  isInitialized: () => boolean;
  Share?: { sendDefault: (args: object) => void };
};

export default function CastingShareSheet({
  input,
  result,
  onClose,
}: {
  input: BandCastingInput;
  result: BandCastingResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const token = encodeCasting(input);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://bandsustain.com";
  const url = `${origin}/playground/mbti-band-casting/share/${token}`;
  const kakaoImageUrl = `${url}/kakao-image`;
  const description = `${GENRES[input.genre].label} · ${POSITIONS[result.primaryPosition].label} · MBTI 밴드 캐스팅`;
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
          title: result.title,
          description,
          imageUrl: kakaoImageUrl,
          imageWidth: 1200,
          imageHeight: 1200,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: "결과 보기", link: { mobileWebUrl: url, webUrl: url } }],
      });
    } else if (canWebShare) {
      navigator.share({ title: result.title, text: description, url }).catch(() => {});
    } else {
      copy();
    }
  };

  const webShare = () => {
    navigator.share({ title: result.title, text: description, url }).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="캐스팅 결과 공유"
    >
      <div
        className="bg-[var(--color-bg)] w-full md:max-w-md p-6 border-t md:border border-[var(--color-border-strong)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl">결과 공유</h2>
          <button onClick={onClose} aria-label="닫기" className="text-sm underline underline-offset-4">닫기</button>
        </div>

        <p className="font-display font-black text-2xl md:text-3xl leading-tight break-keep [overflow-wrap:anywhere] mb-2">
          {result.title}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {result.moodTags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 text-[11px] uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">
              {tag}
            </span>
          ))}
        </div>

        <div className="border border-[var(--color-border)] px-3 py-2 text-xs font-mono break-all mb-4 text-[var(--color-text-muted)]">
          {url}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={copy} className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">
            {copied ? "복사됨" : "링크 복사"}
          </button>
          <button onClick={kakao} className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[#FEE500] text-black border border-[#FEE500] hover:opacity-90 transition-opacity">
            카톡 공유
          </button>
        </div>

        {canWebShare && (
          <button onClick={webShare} className="mt-2 w-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:opacity-90 transition-opacity">
            다른 앱으로 공유
          </button>
        )}
      </div>
    </div>
  );
}
