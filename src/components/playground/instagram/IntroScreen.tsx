"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { loadHistory, type HistoryEntry } from "@/lib/playground/instagram/history";

const TRUST_CARDS = [
  { title: "로그인 없이 안전하게", body: "계정 아이디와 비밀번호를 입력하지 않아요." },
  { title: "공식 데이터로 정확하게", body: "인스타그램에서 직접 내려받은 파일을 분석해요." },
  { title: "업로드 후 바로 분석", body: "팔로워와 팔로잉 관계를 빠르게 확인해요." },
];

const FEATURES = [
  "1. 나만 팔로우하고 있는 계정 찾기",
  "2. 팔로워·팔로잉 날짜 확인",
  "3. @band_sustain 팔로우 기간 확인 및 명예의 전당 등록",
];

export default function IntroScreen(props: { onStart: () => void; onSkipToUpload: () => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  // loadHistory reads localStorage — must run client-side only
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHistory(loadHistory()); }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">서스테인 팔로우 명예의 전당</p>
        <h1 className="font-display text-3xl md:text-4xl font-black leading-tight">
          내 인스타 맞팔 현황,
          <br />
          파일 하나로 확인해 드려요
        </h1>
        <p className="text-[var(--color-text-muted)]">
          내가 팔로우하지만 나를 팔로우하지 않는 계정을 찾고,
          <br className="hidden md:block" /> 서로 언제부터 팔로우했는지도 확인해 보세요.
        </p>
      </header>

      <ul className="space-y-1 text-sm">
        {FEATURES.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <div className="grid gap-3 md:grid-cols-3">
        {TRUST_CARDS.map((c) => (
          <div key={c.title} className="border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold">{c.title}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
        <p>· 인스타그램 아이디와 비밀번호를 입력하지 않습니다.</p>
        <p>· 업로드한 ZIP 파일은 기기에서만 분석합니다.</p>
        <p>· 팔로워 및 팔로잉 목록은 서버에 저장하지 않습니다.</p>
        <p>· 명예의 전당 등록을 선택한 경우에만 필요한 일부 정보가 서버로 전송됩니다.</p>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" className={buttonClasses("accent", "w-full")} onClick={props.onStart}>
          시작하기
        </button>
        <button
          type="button"
          className={buttonClasses("secondary", "w-full")}
          onClick={() => setShowHistory((v) => !v)}
        >
          지난 분석 내역
        </button>
        <button
          type="button"
          className="text-center text-sm text-[var(--color-text-muted)] underline underline-offset-4"
          onClick={props.onSkipToUpload}
        >
          이미 ZIP 파일이 있어요 → 바로 업로드
        </button>
        <Link
          href="/playground/instagram-follow"
          className="text-center text-sm underline underline-offset-4"
        >
          서스테인 팔로우 명예의 전당 보기
        </Link>
      </div>

      {showHistory && (
        <div className="border border-[var(--color-border)] p-4 text-sm">
          {history.length === 0 && <p className="text-[var(--color-text-muted)]">아직 분석 내역이 없어요.</p>}
          {history.map((h) => (
            <p key={h.analyzedAt} className="py-1">
              {new Date(h.analyzedAt).toLocaleDateString("ko-KR")} · 팔로워 {h.followerCount} · 팔로잉{" "}
              {h.followingCount} · 맞팔 아님 {h.notFollowingMeBackCount} ·{" "}
              {h.sustainFollowing ? "서스테인 팔로우 중" : "서스테인 미팔로우"}
            </p>
          ))}
          {history.length > 0 && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              분석 일시와 요약 수치만 이 브라우저에 저장돼요. 전체 목록은 저장하지 않아요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
