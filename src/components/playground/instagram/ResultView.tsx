"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import type { AnalysisResult } from "@/lib/playground/instagram/types";
import AccountList, { type TabKey } from "./AccountList";
import SustainCard from "./SustainCard";

const TABS: { key: TabKey; label: string }[] = [
  { key: "notFollowingMeBack", label: "나를 맞팔하지 않음" },
  { key: "iDoNotFollowBack", label: "내가 맞팔하지 않음" },
  { key: "mutuals", label: "맞팔" },
  { key: "followers", label: "팔로워" },
  { key: "following", label: "팔로잉" },
];

export default function ResultView({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const [tab, setTab] = useState<TabKey>("notFollowingMeBack");
  const r = result.relations;
  const counts: Record<TabKey, number> = {
    notFollowingMeBack: r.notFollowingMeBack.length,
    iDoNotFollowBack: r.iDoNotFollowBack.length,
    mutuals: r.mutuals.length,
    followers: r.followers.length,
    following: r.following.length,
  };

  return (
    <div className="space-y-6">
      {/* 부분 데이터/파싱 실패 안내 */}
      {!result.hasFollowing && (
        <p className="border border-[var(--color-border-strong)] p-3 text-xs">
          팔로잉 파일을 찾지 못해 맞팔 여부는 정확히 계산할 수 없어요. 팔로워 목록만 표시합니다.
        </p>
      )}
      {!result.hasFollowers && (
        <p className="border border-[var(--color-border-strong)] p-3 text-xs">
          팔로워 파일을 찾지 못해 관계 비교는 할 수 없어요. 팔로잉 목록만 표시합니다.
        </p>
      )}
      {result.parseFailedCount > 0 && (
        <p className="border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)]">
          인스타그램 파일 형식이 변경되어 {result.parseFailedCount}개 항목을 읽지 못했어요. 읽은 항목은 모두 표시합니다.
        </p>
      )}

      {/* 대표 강조 문구 + 요약 카드 */}
      {result.hasFollowers && result.hasFollowing && (
        <h2 className="font-display text-2xl font-black leading-snug">
          내가 팔로우하지만
          <br />
          나를 팔로우하지 않는 계정은{" "}
          <span className="text-[var(--color-accent)]">{counts.notFollowingMeBack.toLocaleString()}명</span>
          이에요.
        </h2>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ["팔로워", counts.followers],
          ["팔로잉", counts.following],
          ["맞팔", counts.mutuals],
          ["나를 맞팔 안 함", counts.notFollowingMeBack],
          ["내가 맞팔 안 함", counts.iDoNotFollowBack],
        ].map(([label, n]) => (
          <div key={label as string} className="border border-[var(--color-border)] p-3 text-center">
            <p className="font-display text-xl font-black">{(n as number).toLocaleString()}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
          </div>
        ))}
      </div>

      <SustainCard sustain={result.sustain} />

      {/* 결과 탭 */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`border px-3 py-1.5 text-xs ${
              tab === t.key
                ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {t.label} {counts[t.key].toLocaleString()}
          </button>
        ))}
      </div>

      <AccountList key={tab} accounts={r[tab]} tab={tab} />

      <button type="button" className={buttonClasses("secondary", "w-full")} onClick={onReset}>
        새 파일로 다시 분석하기
      </button>
    </div>
  );
}
