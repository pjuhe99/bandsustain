"use client";
import { useState } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { SUSTAIN_INSTAGRAM_URL, SUSTAIN_USERNAME } from "@/lib/playground/instagram/config";
import { followDayCount, formatKoreanDate } from "@/lib/playground/instagram/followDays";
import type { AnalysisResult } from "@/lib/playground/instagram/types";
import HallOfFameForm from "./HallOfFameForm";

export default function SustainCard({ sustain }: { sustain: AnalysisResult["sustain"] }) {
  const [showForm, setShowForm] = useState(false);

  if (!sustain.following) {
    return (
      <div className="space-y-3 border-2 border-[var(--color-text)] p-5">
        <p className="text-sm">
          아직 <strong>@{SUSTAIN_USERNAME}</strong>을 팔로우하지 않고 있어요.
          <br />
          서스테인의 새로운 음악과 소식을 인스타그램에서 만나보세요!
        </p>
        <a
          href={SUSTAIN_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("accent", "w-full")}
        >
          서스테인 인스타그램 팔로우하기
        </a>
        <p className="text-xs text-[var(--color-text-muted)]">
          방금 팔로우했다면 인스타그램 데이터를 새로 내려받은 뒤 다시 분석해 주세요.
        </p>
      </div>
    );
  }

  const days = sustain.since ? followDayCount(sustain.since) : null;
  return (
    <div className="space-y-3 border-2 border-[var(--color-accent)] p-5">
      {days !== null && sustain.since ? (
        <p className="font-display text-lg font-black">
          서스테인과 함께한 지 <span className="text-[var(--color-accent)]">{days.toLocaleString()}일째</span>예요!
        </p>
      ) : (
        <p className="font-display text-lg font-black">@{SUSTAIN_USERNAME}을 팔로우하고 있어요!</p>
      )}
      <p className="text-sm text-[var(--color-text-muted)]">
        {sustain.since
          ? `${formatKoreanDate(sustain.since) ?? sustain.since}부터 @${SUSTAIN_USERNAME}을 팔로우하고 있어요.`
          : `팔로우 시작일은 확인할 수 없었어요. (${sustain.sinceRaw ?? "날짜 확인 불가"})`}
      </p>
      {sustain.since ? (
        showForm ? (
          <HallOfFameForm followedAtIso={sustain.since} />
        ) : (
          <button type="button" className={buttonClasses("accent", "w-full")} onClick={() => setShowForm(true)}>
            찐팬 랭킹에 등록하기
          </button>
        )
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          팔로우 시작일을 읽을 수 없어 찐팬 랭킹 등록은 어려워요.
        </p>
      )}
      <Link
        href="/playground/instagram-follow"
        className="block text-center text-sm underline underline-offset-4"
      >
        찐팬 랭킹 보러 가기
      </Link>
    </div>
  );
}
